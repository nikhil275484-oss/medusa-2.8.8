/**
 * @schema AdminGiftCardsResponse
 * type: object
 * description: The paginated list of gift cards.
 * x-schemaName: AdminGiftCardsResponse
 * required:
 *   - limit
 *   - offset
 *   - count
 *   - gift_cards
 * properties:
 *   limit:
 *     type: number
 *     title: limit
 *     description: The maximum number of gift cards to return.
 *   offset:
 *     type: number
 *     title: offset
 *     description: The number of gift cards to skip before retrieving the results.
 *   count:
 *     type: number
 *     title: count
 *     description: The total number of gift cards available.
 *   gift_cards:
 *     type: array
 *     description: The list of gift cards.
 *     items:
 *       $ref: "#/components/schemas/AdminGiftCard"
 *   estimate_count:
 *     type: number
 *     title: estimate_count
 *     description: The gift card's estimate count.
 *     x-featureFlag: index_engine
 * 
*/

