import Medusa from "@medusajs/js-sdk"

export const sdk = new Medusa({
  baseUrl: import.meta.env.VITE_BACKEND_URL || "/",
  debug: import.meta.env.DEV,
  auth: {
    type: "session",
  },
})

sdk.admin.draftOrder.addItems("order_123", {
  items: [
    {
      variant_id: "variant_123",
      quantity: 1,
    },
  ],
})
.then(({ draft_order_preview }) => {
  console.log(draft_order_preview)
})