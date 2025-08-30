import { buildEventNamesFromEntityName } from "../event-bus"
import { Modules } from "../modules-sdk"

const eventBaseNames: [
  "fulfillmentSet",
  "serviceZone",
  "geoZone",
  "shippingOption",
  "shippingOptionType",
  "shippingProfile",
  "shippingOptionRule",
  "fulfillment",
  "fulfillmentAddress",
  "fulfillmentItem",
  "fulfillmentLabel"
] = [
  "fulfillmentSet",
  "serviceZone",
  "geoZone",
  "shippingOption",
  "shippingOptionType",
  "shippingProfile",
  "shippingOptionRule",
  "fulfillment",
  "fulfillmentAddress",
  "fulfillmentItem",
  "fulfillmentLabel",
]

export const FulfillmentEvents = {
  ...buildEventNamesFromEntityName(eventBaseNames, Modules.FULFILLMENT),
  /**
   * @deprecated use `FulfillmentWorkflowEvents.SHIPMENT_CREATED` instead
   */
  SHIPMENT_CREATED: "shipment.created",
  /**
   * @deprecated use `FulfillmentWorkflowEvents.DELIVERY_CREATED` instead
   */
  DELIVERY_CREATED: "delivery.created",
}
