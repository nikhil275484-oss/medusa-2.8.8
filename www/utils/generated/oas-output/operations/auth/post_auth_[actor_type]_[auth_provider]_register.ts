/**
 * @oas [post] /auth/{actor_type}/{auth_provider}/register
 * operationId: PostActor_typeAuth_providerRegister
 * summary: Add Register to [actor_type]
 * description: Add a Register to a [actor_type]
 * x-authenticated: false
 * parameters:
 *   - name: actor_type
 *     in: path
 *     description: The [actor type]'s actor type.
 *     required: true
 *     schema:
 *       type: string
 *   - name: auth_provider
 *     in: path
 *     description: The [actor type]'s auth provider.
 *     required: true
 *     schema:
 *       type: string
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
 *       await sdk.auth.register(
 *         "customer",
 *         "emailpass",
 *         {
 *           email: "customer@gmail.com",
 *           password: "supersecret"
 *         }
 *       )
 * 
 *       // all subsequent requests will use the token in the header
 *       const { customer } = await sdk.store.customer.create({
 *         email: "customer@gmail.com",
 *         password: "supersecret"
 *       })
 *   - lang: Shell
 *     label: cURL
 *     source: curl -X POST '{backend_url}/auth/{actor_type}/{auth_provider}/register'
 * tags:
 *   - "[actor_type]"
 * responses:
 *   "200":
 *     description: OK
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

