import {
  ChangeActionType,
  MathBN,
  OrderChangeStatus,
} from "@medusajs/framework/utils"
import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { BigNumberInput, OrderChangeDTO, OrderDTO } from "@medusajs/types"
import { reserveInventoryStep } from "../../cart"
import {
  prepareConfirmInventoryInput,
  requiredOrderFieldsForInventoryConfirmation,
} from "../../cart/utils/prepare-confirm-inventory-input"
import { useRemoteQueryStep } from "../../common"
import {
  createOrUpdateOrderPaymentCollectionWorkflow,
  previewOrderChangeStep,
} from "../../order"
import { confirmOrderChanges } from "../../order/steps/confirm-order-changes"
import { deleteReservationsByLineItemsStep } from "../../reservation"
import { validateDraftOrderChangeStep } from "../steps/validate-draft-order-change"

export const confirmDraftOrderEditWorkflowId = "confirm-draft-order-edit"

export interface ConfirmDraftOrderEditWorkflowInput {
  /**
   * The ID of the draft order to confirm the edit for.
   */
  order_id: string
  /**
   * The ID of the user confirming the edit.
   */
  confirmed_by: string
}

/**
 * This workflow confirms a draft order edit. It's used by the
 * [Confirm Draft Order Edit Admin API Route](https://docs.medusajs.com/api/admin#draft-orders_postdraftordersideditconfirm).
 *
 * You can use this workflow within your customizations or your own custom workflows, allowing you to wrap custom logic around
 * confirming a draft order edit.
 *
 * @example
 * const { result } = await confirmDraftOrderEditWorkflow(container)
 * .run({
 *   input: {
 *     order_id: "order_123",
 *     confirmed_by: "user_123",
 *   }
 * })
 *
 * @summary
 *
 * Confirm a draft order edit.
 */
export const confirmDraftOrderEditWorkflow = createWorkflow(
  confirmDraftOrderEditWorkflowId,
  function (input: ConfirmDraftOrderEditWorkflowInput) {
    const order: OrderDTO = useRemoteQueryStep({
      entry_point: "orders",
      fields: [
        "id",
        "status",
        "is_draft_order",
        "version",
        "canceled_at",
        "items.id",
        "items.title",
        "items.variant_title",
        "items.variant_sku",
        "items.variant_barcode",
        "shipping_address.*",
      ],
      variables: { id: input.order_id },
      list: false,
      throw_if_key_not_found: true,
    }).config({ name: "order-query" })

    const orderChange: OrderChangeDTO = useRemoteQueryStep({
      entry_point: "order_change",
      fields: [
        "id",
        "status",
        "actions.id",
        "actions.order_id",
        "actions.return_id",
        "actions.action",
        "actions.details",
        "actions.reference",
        "actions.reference_id",
        "actions.internal_note",
      ],
      variables: {
        filters: {
          order_id: input.order_id,
          status: [OrderChangeStatus.PENDING, OrderChangeStatus.REQUESTED],
        },
      },
      list: false,
    }).config({ name: "order-change-query" })

    validateDraftOrderChangeStep({
      order,
      orderChange,
    })

    const orderPreview = previewOrderChangeStep(order.id)

    confirmOrderChanges({
      changes: [orderChange],
      orderId: order.id,
      confirmed_by: input.confirmed_by,
    })

    const orderItems = useRemoteQueryStep({
      entry_point: "order",
      fields: requiredOrderFieldsForInventoryConfirmation,
      variables: { id: input.order_id },
      list: false,
      throw_if_key_not_found: true,
    }).config({ name: "order-items-query" })

    const { variants, items, toRemoveReservationLineItemIds } = transform(
      { orderItems, previousOrderItems: order.items, orderPreview },
      ({ orderItems, previousOrderItems, orderPreview }) => {
        const allItems: any[] = []
        const allVariants: any[] = []

        const previousItemIds = (previousOrderItems || []).map(({ id }) => id)
        const currentItemIds = orderItems.items.map(({ id }) => id)

        const removedItemIds = previousItemIds.filter(
          (id) => !currentItemIds.includes(id)
        )

        const updatedItemIds: string[] = []

        orderItems.items.forEach((ordItem) => {
          const itemAction = orderPreview.items?.find(
            (item) =>
              item.id === ordItem.id &&
              item.actions?.find(
                (a) =>
                  a.action === ChangeActionType.ITEM_ADD ||
                  a.action === ChangeActionType.ITEM_UPDATE
              )
          )

          if (!itemAction) {
            return
          }

          const unitPrice: BigNumberInput =
            itemAction.raw_unit_price ?? itemAction.unit_price

          const compareAtUnitPrice: BigNumberInput | undefined =
            itemAction.raw_compare_at_unit_price ??
            itemAction.compare_at_unit_price

          const updateAction = itemAction.actions!.find(
            (a) => a.action === ChangeActionType.ITEM_UPDATE
          )

          if (updateAction) {
            updatedItemIds.push(ordItem.id)
          }

          const newQuantity: BigNumberInput =
            itemAction.raw_quantity ?? itemAction.quantity

          const reservationQuantity = MathBN.sub(
            newQuantity,
            ordItem.raw_fulfilled_quantity
          )

          allItems.push({
            id: ordItem.id,
            variant_id: ordItem.variant_id,
            quantity: reservationQuantity,
            unit_price: unitPrice,
            compare_at_unit_price: compareAtUnitPrice,
          })
          allVariants.push(ordItem.variant)
        })

        return {
          variants: allVariants,
          items: allItems,
          toRemoveReservationLineItemIds: [
            ...removedItemIds,
            ...updatedItemIds,
          ],
        }
      }
    )

    const formatedInventoryItems = transform(
      {
        input: {
          sales_channel_id: (orderItems as any).sales_channel_id,
          variants,
          items,
        },
      },
      prepareConfirmInventoryInput
    )

    deleteReservationsByLineItemsStep(toRemoveReservationLineItemIds)
    reserveInventoryStep(formatedInventoryItems)

    createOrUpdateOrderPaymentCollectionWorkflow.runAsStep({
      input: {
        order_id: order.id,
      },
    })

    return new WorkflowResponse(orderPreview)
  }
)
