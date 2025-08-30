import { MDXRemote, MDXRemoteSerializeResult } from "next-mdx-remote/rsc"
import { serialize } from "next-mdx-remote/serialize"
import path from "path"
import { promises as fs } from "fs"
import { notFound } from "next/navigation"
import {
  typeListLinkFixerPlugin,
  localLinksRehypePlugin,
  workflowDiagramLinkFixerPlugin,
  prerequisitesLinkFixerPlugin,
  recmaInjectMdxDataPlugin,
} from "remark-rehype-plugins"
import MDXComponents from "@/components/MDXComponents"
import mdxOptions from "../../../mdx-options.mjs"
import { filesMap } from "../../../generated/files-map.mjs"
import { Metadata } from "next"
import { cache, Suspense } from "react"
import { Loading } from "docs-ui"

type PageProps = {
  params: Promise<{
    slug: string[]
  }>
}

export default async function ReferencesPage(props: PageProps) {
  const params = await props.params
  const { slug } = params

  const fileData = await loadFile(slug)

  if (!fileData) {
    return notFound()
  }

  const pluginOptions = {
    filePath: fileData.path,
    basePath: process.cwd(),
  }

  return (
    <Suspense fallback={<Loading />}>
      <div className="animate animate-fadeIn">
        <MDXRemote
          source={fileData.content}
          components={MDXComponents}
          options={{
            mdxOptions: {
              rehypePlugins: [
                ...mdxOptions.options.rehypePlugins,
                [
                  typeListLinkFixerPlugin,
                  {
                    ...pluginOptions,
                    checkLinksType: "md",
                  },
                ],
                [
                  workflowDiagramLinkFixerPlugin,
                  {
                    ...pluginOptions,
                    checkLinksType: "value",
                  },
                ],
                [
                  prerequisitesLinkFixerPlugin,
                  {
                    ...pluginOptions,
                    checkLinksType: "value",
                  },
                ],
                [localLinksRehypePlugin, pluginOptions],
              ],
              remarkPlugins: [...mdxOptions.options.remarkPlugins],
              recmaPlugins: [
                [
                  recmaInjectMdxDataPlugin,
                  { isRemoteMdx: true, mode: process.env.NODE_ENV },
                ],
              ],
            },
          }}
        />
      </div>
    </Suspense>
  )
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  // read route params
  const slug = (await params).slug
  const metadata: Metadata = {}

  const fileData = await loadFile(slug)

  if (!fileData) {
    return metadata
  }

  const pageTitleMatch = /#(?<title>[\w -]+)/.exec(fileData.content)

  if (!pageTitleMatch?.groups?.title) {
    return metadata
  }

  metadata.title = pageTitleMatch.groups.title
  metadata.keywords = (fileData.source.frontmatter?.keywords || []) as string[]

  return metadata
}

const loadFile = cache(
  async (
    slug: string[]
  ): Promise<
    | {
        content: string
        source: MDXRemoteSerializeResult
        path: string
      }
    | undefined
  > => {
    path.join(process.cwd(), "references")
    const monoRepoPath = path.resolve("..", "..", "..")

    const pathname = `/references/${slug.join("/")}`
    const slugChanges = (await import("../../../generated/slug-changes.mjs"))
      .slugChanges
    const fileDetails =
      slugChanges.find((f) => f.newSlug === pathname) ||
      filesMap.find((f) => f.pathname === pathname)
    if (!fileDetails) {
      return undefined
    }
    const fullPath = path.join(monoRepoPath, fileDetails.filePath)

    const fileContent = await fs.readFile(fullPath, "utf-8")
    const serialized = await serialize(fileContent, {
      parseFrontmatter: true,
    })
    return {
      content: fileContent,
      source: serialized,
      path: fullPath,
    }
  }
)
