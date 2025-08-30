import { OpenAPIV3 } from "openapi-types"

declare type CodeSample = {
  lang: string
  label: string
  source: string
}

export declare type OpenApiOperation = Partial<OpenAPIV3.OperationObject> & {
  "x-authenticated"?: boolean
  "x-codeSamples"?: CodeSample[]
  "x-workflow"?: string
  "x-events"?: OasEvent[]
  "x-deprecated_message"?: string
  "x-version"?: string
  "x-featureFlag"?: string
  "x-ignoreCleanup"?: boolean
}

export declare type CommonCliOptions = {
  type: "all" | "oas" | "docs" | "dml" | "route-examples" | "events"
  generateExamples?: boolean
  tag?: string
}

export declare type OpenApiSchema = OpenAPIV3.SchemaObject & {
  "x-schemaName"?: string
  "x-featureFlag"?: string
}

export declare interface OpenApiTagObject extends OpenAPIV3.TagObject {
  "x-associatedSchema"?: OpenAPIV3.ReferenceObject
}

export declare interface OpenApiDocument extends OpenAPIV3.Document {
  tags?: OpenApiTagObject[]
}

export declare type DmlObject = Record<string, string>

export declare type DmlFile = {
  [k: string]: {
    filePath: string
    properties: DmlObject
  }
}

export declare type OasEvent = {
  name: string
  payload: string
  description?: string
  deprecated?: boolean
  deprecated_message?: string
  version?: string
}
