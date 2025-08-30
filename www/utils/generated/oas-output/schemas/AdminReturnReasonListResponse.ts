/**
 * @schema AdminReturnReasonListResponse
 * type: object
 * description: The paginated list of return reasons.
 * x-schemaName: AdminReturnReasonListResponse
 * required:
 *   - limit
 *   - offset
 *   - count
 *   - return_reasons
 * properties:
 *   limit:
 *     type: number
 *     title: limit
 *     description: The maximum number of items returned.
 *   offset:
 *     type: number
 *     title: offset
 *     description: The number of items skipped before retrieving the returned items.
 *   count:
 *     type: number
 *     title: count
 *     description: The total number of items.
 *   return_reasons:
 *     type: array
 *     description: The list of return reasons.
 *     items:
 *       $ref: "#/components/schemas/AdminReturnReason"
 *   estimate_count:
 *     type: number
 *     title: estimate_count
 *     description: The estimated count retrieved from the PostgreSQL query planner, which may be inaccurate.
 *     x-featureFlag: index_engine
 * 
*/

