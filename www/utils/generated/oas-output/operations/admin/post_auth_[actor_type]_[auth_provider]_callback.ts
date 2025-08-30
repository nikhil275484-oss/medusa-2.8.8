/**
 * @oas [post] /auth/user/{auth_provider}/callback
 * operationId: PostActor_typeAuth_providerCallback
 * summary: Validate Authentication Callback
 * description: >
 *   This API route is used by your dashboard or frontend application when a third-party provider redirects to it after authentication. It validates the authentication with the third-party provider and, if successful, returns an authentication token.
 *   All query parameters received from the third-party provider, such as `code`, `state`, and `error`, must be passed as query parameters to this route.
 * 
 *   
 *   You can decode the JWT token using libraries like [react-jwt](https://www.npmjs.com/package/react-jwt) in the frontend. If the decoded data doesn't 
 *   have an `actor_id` property, then you must create a user, typically using the Accept Invite route passing the token in the request's Authorization header.
 * externalDocs:
 *   url: https://docs.medusajs.com/v2/resources/commerce-modules/auth/authentication-route#2-third-party-service-authenticate-flow
 *   description: Learn about third-party authentication flow.
 * x-authenticated: false
 * parameters:
 *   - name: auth_provider
 *     in: path
 *     description: The provider used for authentication.
 *     required: true
 *     schema:
 *       type: string
 *       example: "google"
 * x-codeSamples:
 *   - lang: JavaScript
 *     label: Google Provider
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
 *       await sdk.auth.callback(
 *         "user",
 *         "google",
 *         {
 *           code: "123",
 *           state: "456"
 *         }
 *       )
 *       
 *       // all subsequent requests will use the token in the header
 *       sdk.admin.invite.accept(
 *         {
 *           email: "user@gmail.com",
 *           first_name: "John",
 *           last_name: "Smith",
 *           invite_token: "12345..."
 *         },
 *       )
 *       .then(({ user }) => {
 *         console.log(user)
 *       })
 *   - lang: TypeScript
 *     label: GitHub Provider
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
 *       const authToken = await sdk.auth.callback(
 *         "user",
 *         "google",
 *         {
 *           code: "123",
 *           state: "456"
 *         }
 *       )
 *       
 *       // all subsequent requests will use the token in the header
 *       sdk.admin.invite.accept(
 *         {
 *           email: "user@gmail.com",
 *           first_name: "John",
 *           last_name: "Smith",
 *           invite_token: "12345..."
 *         },
 *       )
 *       .then(({ user }) => {
 *         console.log(user)
 *       })
 * tags:
 *   - Auth
 * responses:
 *   "200":
 *     description: OK
 *     content:
 *       application/json:
 *         schema:
 *           $ref: "#/components/schemas/AuthResponse"
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

