curl -X POST '{backend_url}/admin/uploads/presigned-urls' \
-H 'Authorization: Bearer {access_token}' \
-H 'Content-Type: application/json' \
--data-raw '{
  "originalname": "{value}",
  "size": 43,
  "mime_type": "{value}"
}'