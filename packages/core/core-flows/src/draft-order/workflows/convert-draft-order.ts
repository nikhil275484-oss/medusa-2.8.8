import {
  Modules,
  OrderStatus,
  OrderWorkflowEvents,
} from "@medusajs/framework/utils"
import {
  createStep,
  createWorkflow,
  StepResponse,
  WorkflowData,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk"
import { IOrderModuleService, OrderDTO } from "@medusajs/types"
import { emitEventStep, useRemoteQueryStep } from "../../common"
import { validateDraftOrderStep } from "../steps/validate-draft-order"

export const convertDraftOrderWorkflowId = "convert-draft-order"

/**
 * The details of the draft order to convert to an order.
 */
export interface ConvertDraftOrderWorkflowInput {
  /**
   * The ID of the draft order to convert to an order.
   */
  id: string
}

/**
 * The details of the draft order to convert to an order.
 */
export interface ConvertDraftOrderStepInput {
  /**
   * The ID of the draft order to convert to an order.
   */
  id: string
}

/**
 * This step converts a draft order to a pending order.
 */
export const convertDraftOrderStep = createStep(
  "convert-draft-order",
  async function ({ id }: ConvertDraftOrderStepInput, { container }) {
    const service = container.resolve<IOrderModuleService>(Modules.ORDER)

    const response = await service.updateOrders([
      {
        id,
        status: OrderStatus.PENDING,
        is_draft_order: false,
      },
    ])

    const order = response[0]

    return new StepResponse(order, {
      id,
    })
  },
  async function (prevData, { container }) {
    if (!prevData) {
      return
    }

    const service = container.resolve<IOrderModuleService>(Modules.ORDER)

    await service.updateOrders([
      {
        id: prevData.id,
        status: OrderStatus.DRAFT,
        is_draft_order: true,
      },
    ])
  }
)

/**
 * This workflow converts a draft order to a pending order. It's used by the
 * [Convert Draft Order to Order Admin API Route](https://docs.medusajs.com/api/admin#draft-orders_postdraftordersidconverttoorder).
 * 
 * You can use this workflow within your customizations or your own custom workflows, allowing you to wrap custom logic around
 * converting a draft order to a pending order.
 * 
 * @example
 * const { result } = await convertDraftOrderWorkflow(container)
 * .run({
 *   input: {
 *     id: "order_123",
 *   }
 * })
 * 
 * @summary
 * 
 * Convert a draft order to a pending order.
 */
export const convertDraftOrderWorkflow = createWorkflow(
  convertDraftOrderWorkflowId,
  function (
    input: WorkflowData<ConvertDraftOrderWorkflowInput>
  ): WorkflowResponse<OrderDTO> {
    const order = useRemoteQueryStep({
      entry_point: "orders",
      fields: ["id", "status", "is_draft_order"],
      variables: {
        id: input.id,
      },
      list: false,
      throw_if_key_not_found: true,
    }).config({ name: "order-query" })

    validateDraftOrderStep({ order })

    const updatedOrder = convertDraftOrderStep({ id: input.id })

    emitEventStep({
      eventName: OrderWorkflowEvents.PLACED,
      data: { id: updatedOrder.id },
    })

    return new WorkflowResponse(updatedOrder)
  }
)
