import { createCollectionsWorkflow } from "@medusajs/core-flows"
import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { AdditionalData, HttpTypes } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  remoteQueryObjectFromString,
} from "@medusajs/framework/utils"
import { refetchCollection } from "./helpers"
import { AdminCreateCollectionType } from "./validators"

export const GET = async (
  req: AuthenticatedMedusaRequest<HttpTypes.AdminCollectionListParams>,
  res: MedusaResponse<HttpTypes.AdminCollectionListResponse>
) => {
  const remoteQuery = req.scope.resolve(ContainerRegistrationKeys.REMOTE_QUERY)

  const query = remoteQueryObjectFromString({
    entryPoint: "product_collection",
    variables: {
      filters: req.filterableFields,
      ...req.queryConfig.pagination,
    },
    fields: req.queryConfig.fields,
  })

  const { rows: collections, metadata } = await remoteQuery(query)

  res.json({
    collections,
    count: metadata.count,
    offset: metadata.skip,
    limit: metadata.take,
  })
}

export const POST = async (
  req: AuthenticatedMedusaRequest<AdminCreateCollectionType & AdditionalData>,
  res: MedusaResponse<HttpTypes.AdminCollectionResponse>
) => {
  const { additional_data, ...rest } = req.validatedBody

  const { result } = await createCollectionsWorkflow(req.scope).run({
    input: { collections: [rest], additional_data },
  })

  const collection = await refetchCollection(
    result[0].id,
    req.scope,
    req.queryConfig.fields
  )

  res.status(200).json({ collection })
}
