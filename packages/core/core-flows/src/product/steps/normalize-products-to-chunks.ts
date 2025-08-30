import { parse, Parser } from "csv-parse"
import { HttpTypes, IFileModuleService } from "@medusajs/framework/types"
import {
  Modules,
  CSVNormalizer,
  productValidators,
} from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"

/**
 * The CSV file content to parse.
 */
export type NormalizeProductCsvV1StepInput = string

export const normalizeCsvToChunksStepId = "normalize-product-csv-to-chunks"

type Chunk = { id: string; toCreate: number; toUpdate: number }

/**
 * Processes a chunk of products by writing them to a file. Later the
 * file will be processed after the import has been confirmed.
 */
async function processChunk(
  file: IFileModuleService,
  fileKey: string,
  csvRows: ReturnType<(typeof CSVNormalizer)["preProcess"]>[],
  currentRowNumber: number
): Promise<Chunk> {
  const normalizer = new CSVNormalizer(csvRows)
  const products = normalizer.proccess(currentRowNumber)

  let create = Object.keys(products.toCreate).reduce<
    HttpTypes.AdminCreateProduct[]
  >((result, toCreateHandle) => {
    result.push(
      productValidators.CreateProduct.parse(
        products.toCreate[toCreateHandle]
      ) as HttpTypes.AdminCreateProduct
    )
    return result
  }, [])

  let update = Object.keys(products.toUpdate).reduce<
    HttpTypes.AdminUpdateProduct & { id: string }[]
  >((result, toUpdateId) => {
    result.push(
      productValidators.UpdateProduct.parse(products.toUpdate[toUpdateId])
    )
    return result
  }, [])

  const toCreate = create.length
  const toUpdate = update.length

  const { id } = await file.createFiles({
    filename: `${fileKey}.json`,
    content: JSON.stringify({ create, update }),
    mimeType: "application/json",
  })

  /**
   * Release products from the memory
   */
  create = []
  update = []

  return {
    id,
    toCreate,
    toUpdate,
  }
}

/**
 * Creates chunks by reading CSV rows from the stream
 */
async function createChunks(
  file: IFileModuleService,
  fileKey: string,
  stream: Parser
): Promise<Chunk[]> {
  /**
   * The row under process
   */
  let currentCSVRow = 0

  /**
   * Number of rows to process in a chunk. The rows count might go a little
   * up if there are more rows for the same product.
   */
  const rowsToRead = 1000

  /**
   * Current count of processed rows for a given chunk.
   */
  let rowsReadSoFar = 0

  /**
   * Validated chunks that have been written with the file
   * provider
   */
  const chunks: Chunk[] = []

  /**
   * Currently collected rows to be processed as one chunk
   */
  let rows: ReturnType<(typeof CSVNormalizer)["preProcess"]>[] = []

  /**
   * The unique value for the current row. We need this value to scan
   * more rows after rowsToRead threshold has reached, but the upcoming
   * rows are part of the same product.
   */
  let currentRowUniqueValue: string | undefined

  try {
    for await (const row of stream) {
      rowsReadSoFar++
      currentCSVRow++
      const normalizedRow = CSVNormalizer.preProcess(row, currentCSVRow)
      const rowValueValue =
        normalizedRow["product id"] || normalizedRow["product handle"]

      /**
       * Reached rows threshold
       */
      if (rowsReadSoFar > rowsToRead) {
        /**
         * The current row unique value is not same as the previous row's
         * unique value. Hence we can break the chunk here and process
         * it.
         */
        if (rowValueValue !== currentRowUniqueValue) {
          chunks.push(
            await processChunk(
              file,
              `${fileKey}-${chunks.length + 1}`,
              rows,
              currentCSVRow
            )
          )

          /**
           * Reset for new row
           */
          rows = [normalizedRow]
          rowsReadSoFar = 0
        } else {
          rows.push(normalizedRow)
        }
      } else {
        rows.push(normalizedRow)
      }

      currentRowUniqueValue = rowValueValue
    }

    /**
     * The file has finished and we have collected some rows that were
     * under the chunk rows size threshold.
     */
    if (rows.length) {
      chunks.push(
        await processChunk(
          file,
          `${fileKey}-${chunks.length + 1}`,
          rows,
          currentCSVRow
        )
      )
    }
  } catch (error) {
    if (!stream.destroyed) {
      stream.destroy()
    }

    /**
     * Cleanup in case of an error
     */
    await file.deleteFiles(chunks.map((chunk) => chunk.id).concat(fileKey))
    throw error
  }

  return chunks
}

/**
 * This step parses a CSV file holding products to import, returning the chunks
 * to be processed. Each chunk is written to a file using the file provider.
 *
 * @example
 * const data = normalizeCsvToChunksStep("products.csv")
 */
export const normalizeCsvToChunksStep = createStep(
  normalizeCsvToChunksStepId,
  async (fileKey: NormalizeProductCsvV1StepInput, { container }) => {
    return new Promise<
      StepResponse<{
        chunks: Chunk[]
        summary: Omit<Chunk, "id">
      }>
    >(async (resolve, reject) => {
      try {
        const file = container.resolve(Modules.FILE)
        const contents = await file.getDownloadStream(fileKey)
        const transformer = parse({
          columns: true,
          skip_empty_lines: true,
        })

        contents.on("error", reject)

        const chunks = await createChunks(
          file,
          fileKey,
          contents.pipe(transformer)
        )

        const summary = chunks.reduce<{ toCreate: number; toUpdate: number }>(
          (result, chunk) => {
            result.toCreate = result.toCreate + chunk.toCreate
            result.toUpdate = result.toUpdate + chunk.toUpdate
            return result
          },
          { toCreate: 0, toUpdate: 0 }
        )

        /**
         * Delete CSV file once we have the chunks
         */
        await file.deleteFiles(fileKey)

        resolve(
          new StepResponse({
            chunks,
            summary,
          })
        )
      } catch (error) {
        reject(error)
      }
    })
  }
)
