curl -X POST '{backend_url}/store/returns' \
-H 'x-publishable-api-key: {your_publishable_api_key}' \
-H 'Content-Type: application/json' \
--data-raw '{
  "order_id": "order_123",
  "items": [
    {
      "id": "id_XbfptxUVo2io9EI",
      "quantity": 7916429753974784,
      "reason_id": "{value}",
      "note": "{value}"
    }
  ],
  "return_shipping": {
    "option_id": "{value}",
    "price": 1068364080349184
  },
  "note": "{value}",
  "location_id": "{value}"
}'