/**
 * @oas [get] /admin/tax-regions/{id}
 * operationId: GetTaxRegionsId
 * summary: Get a Tax Region
 * description: Retrieve a tax region by its ID. You can expand the tax region's relations or select the fields that should be returned.
 * x-authenticated: true
 * parameters:
 *   - name: id
 *     in: path
 *     description: The tax region's ID.
 *     required: true
 *     schema:
 *       type: string
 *   - name: fields
 *     in: query
 *     description: Comma-separated fields that should be included in the returned data. if a field is prefixed with `+` it will be added to the default fields, using `-` will remove it from the default
 *       fields. without prefix it will replace the entire default fields.
 *     required: false
 *     schema:
 *       type: string
 *       title: fields
 *       description: Comma-separated fields that should be included in the returned data. if a field is prefixed with `+` it will be added to the default fields, using `-` will remove it from the default
 *         fields. without prefix it will replace the entire default fields.
 *       externalDocs:
 *         url: "#select-fields-and-relations"
 *   - name: province_code
 *     in: query
 *     description: Filter by a tax region's province code.
 *     required: false
 *     schema:
 *       type: string
 *       title: province_code
 *       description: Filter by a tax region's province code.
 *   - name: provider_id
 *     in: query
 *     description: Filter by a tax provider ID to retrieve the tax regions using it.
 *     required: false
 *     schema:
 *       type: string
 *       title: provider_id
 *       description: Filter by a tax provider ID to retrieve the tax regions using it.
 *   - name: metadata
 *     in: query
 *     description: Filter by a tax region's metadata. Refer to the [Object Query Parameter](https://docs.medusajs.com/api/admin#object) section to learn how to filter by object fields.
 *     required: false
 *     schema:
 *       type: object
 *       description: Filter by a tax region's metadata. Refer to the [Object Query Parameter](https://docs.medusajs.com/api/admin#object) section to learn how to filter by object fields.
 * security:
 *   - api_token: []
 *   - cookie_auth: []
 *   - jwt_token: []
 * x-codeSamples:
 *   - lang: JavaScript
 *     label: JS SDK
 *     source: |-
 *       import Medusa from "@medusajs/js-sdk"
 * 
 *       export const sdk = new Medusa({
 *         baseUrl: import.meta.env.VITE_BACKEND_URL || "/",
 *         debug: import.meta.env.DEV,
 *         auth: {
 *           type: "session",
 *         },
 *       })
 * 
 *       sdk.admin.taxRegion.retrieve("txreg_123")
 *       .then(({ tax_region }) => {
 *         console.log(tax_region)
 *       })
 *   - lang: Shell
 *     label: cURL
 *     source: |-
 *       curl '{backend_url}/admin/tax-regions/{id}' \
 *       -H 'Authorization: Bearer {access_token}'
 * tags:
 *   - Tax Regions
 * responses:
 *   "200":
 *     description: OK
 *     content:
 *       application/json:
 *         schema:
 *           $ref: "#/components/schemas/AdminTaxRegionResponse"
 *   "400":
 *     $ref: "#/components/responses/400_error"
 *   "401":
 *     $ref: "#/components/responses/unauthorized"
 *   "404":
 *     $ref: "#/components/responses/not_found_error"
 *   "409":
 *     $ref: "#/components/responses/invalid_state_error"
 *   "422":
 *     $ref: "#/components/responses/invalid_request_error"
 *   "500":
 *     $ref: "#/components/responses/500_error"
 * 
*/

