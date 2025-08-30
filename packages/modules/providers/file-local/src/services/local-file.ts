import { FileTypes, LocalFileServiceOptions } from "@medusajs/framework/types"
import {
  AbstractFileProviderService,
  MedusaError,
} from "@medusajs/framework/utils"
import { createReadStream } from "fs"
import fs from "fs/promises"
import path from "path"
import type { Readable } from "stream"

export class LocalFileService extends AbstractFileProviderService {
  static identifier = "localfs"
  protected uploadDir_: string
  protected privateUploadDir_: string
  protected backendUrl_: string

  constructor(_, options: LocalFileServiceOptions) {
    super()
    this.uploadDir_ = options?.upload_dir || path.join(process.cwd(), "static")

    // Since there is no way to serve private files through a static server, we simply place them in `static`.
    // This means that the files will be available publicly if the filename is known. Since the local file provider
    // is for development only, this shouldn't be an issue. If you really want to use it in production (and you shouldn't)
    // You can change the private upload dir to `/private` but none of the functionalities where you use a presigned URL will work.
    this.privateUploadDir_ =
      options?.private_upload_dir || path.join(process.cwd(), "static")
    this.backendUrl_ = options?.backend_url || "http://localhost:9000/static"
  }

  async upload(
    file: FileTypes.ProviderUploadFileDTO
  ): Promise<FileTypes.ProviderFileResultDTO> {
    if (!file) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, `No file provided`)
    }

    if (!file.filename) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `No filename provided`
      )
    }

    const parsedFilename = path.parse(file.filename)
    const baseDir =
      file.access === "public" ? this.uploadDir_ : this.privateUploadDir_
    await this.ensureDirExists(baseDir, parsedFilename.dir)

    const fileKey = path.join(
      parsedFilename.dir,
      // We prepend "private" to the file key so deletions and presigned URLs can know which folder to look into
      `${file.access === "public" ? "" : "private-"}${Date.now()}-${
        parsedFilename.base
      }`
    )

    const filePath = this.getUploadFilePath(baseDir, fileKey)
    const fileUrl = this.getUploadFileUrl(fileKey)

    const content = Buffer.from(file.content as string, "binary")
    await fs.writeFile(filePath, content)

    return {
      key: fileKey,
      url: fileUrl,
    }
  }

  async delete(
    files: FileTypes.ProviderDeleteFileDTO | FileTypes.ProviderDeleteFileDTO[]
  ): Promise<void> {
    files = Array.isArray(files) ? files : [files]

    await Promise.all(
      files.map(async (file) => {
        const baseDir = file.fileKey.startsWith("private-")
          ? this.privateUploadDir_
          : this.uploadDir_

        const filePath = this.getUploadFilePath(baseDir, file.fileKey)
        try {
          await fs.access(filePath, fs.constants.W_OK)
          await fs.unlink(filePath)
        } catch (e) {
          // The file does not exist, we don't do anything
          if (e.code !== "ENOENT") {
            throw e
          }
        }
      })
    )

    return
  }

  async getDownloadStream(
    file: FileTypes.ProviderGetFileDTO
  ): Promise<Readable> {
    const baseDir = file.fileKey.startsWith("private-")
      ? this.privateUploadDir_
      : this.uploadDir_

    const filePath = this.getUploadFilePath(baseDir, file.fileKey)
    return createReadStream(filePath)
  }

  async getAsBuffer(file: FileTypes.ProviderGetFileDTO): Promise<Buffer> {
    const baseDir = file.fileKey.startsWith("private-")
      ? this.privateUploadDir_
      : this.uploadDir_

    const filePath = this.getUploadFilePath(baseDir, file.fileKey)
    return fs.readFile(filePath)
  }

  // The local file provider doesn't support presigned URLs for private files (i.e files not placed in /static).
  async getPresignedDownloadUrl(
    file: FileTypes.ProviderGetFileDTO
  ): Promise<string> {
    const isPrivate = file.fileKey.startsWith("private-")
    const baseDir = isPrivate ? this.privateUploadDir_ : this.uploadDir_

    const filePath = this.getUploadFilePath(baseDir, file.fileKey)

    try {
      await fs.access(filePath, fs.constants.F_OK)
    } catch {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        `File with key ${file.fileKey} not found`
      )
    }

    return this.getUploadFileUrl(file.fileKey)
  }

  /**
   * Returns the pre-signed URL that the client (frontend) can use to trigger
   * a file upload. In this case, the Medusa backend will implement the
   * "/upload" endpoint to perform the file upload.
   */
  async getPresignedUploadUrl(
    fileData: FileTypes.ProviderGetPresignedUploadUrlDTO
  ): Promise<FileTypes.ProviderFileResultDTO> {
    if (!fileData?.filename) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `No filename provided`
      )
    }

    return {
      url: "/admin/uploads",
      key: fileData.filename,
    }
  }

  private getUploadFilePath = (baseDir: string, fileKey: string) => {
    return path.join(baseDir, fileKey)
  }

  private getUploadFileUrl = (fileKey: string) => {
    const baseUrl = new URL(this.backendUrl_)
    baseUrl.pathname = path.join(baseUrl.pathname, fileKey)
    return baseUrl.href
  }

  private async ensureDirExists(baseDir: string, dirPath: string) {
    const relativePath = path.join(baseDir, dirPath)
    try {
      await fs.access(relativePath, fs.constants.F_OK)
    } catch (e) {
      await fs.mkdir(relativePath, { recursive: true })
    }

    return relativePath
  }
}
