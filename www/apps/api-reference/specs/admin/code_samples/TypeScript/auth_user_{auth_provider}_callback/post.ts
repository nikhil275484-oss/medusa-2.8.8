import Medusa from "@medusajs/js-sdk"

export const sdk = new Medusa({
  baseUrl: import.meta.env.VITE_BACKEND_URL || "/",
  debug: import.meta.env.DEV,
  auth: {
    type: "session",
  },
})

const authToken = await sdk.auth.callback(
  "user",
  "google",
  {
    code: "123",
    state: "456"
  }
)

// all subsequent requests will use the token in the header
sdk.admin.invite.accept(
  {
    email: "user@gmail.com",
    first_name: "John",
    last_name: "Smith",
    invite_token: "12345..."
  },
)
.then(({ user }) => {
  console.log(user)
})