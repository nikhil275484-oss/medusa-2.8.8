curl -X POST '{backend_url}/admin/store-credit-accounts' \
-H 'Authorization: Bearer {access_token}' \
-H 'Content-Type: application/json' \
--data-raw '{
  "currency_code": "nzd",
  "customer_id": "{value}"
}'