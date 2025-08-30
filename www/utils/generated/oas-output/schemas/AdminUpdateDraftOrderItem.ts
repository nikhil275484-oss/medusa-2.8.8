/**
 * @schema AdminUpdateDraftOrderItem
 * type: object
 * description: The updates to make on a draft order's item.
 * x-schemaName: AdminUpdateDraftOrderItem
 * required:
 *   - quantity
 * properties:
 *   quantity:
 *     type: number
 *     title: quantity
 *     description: The item's quantity.
 *   unit_price:
 *     type: number
 *     title: unit_price
 *     description: The item's unit price.
 *   compare_at_unit_price:
 *     type: number
 *     title: compare_at_unit_price
 *     description: The original price of the item before a promotion or sale.
 *   internal_note:
 *     type: string
 *     title: internal_note
 *     description: A note viewed only by admin users about the item.
 * 
*/

