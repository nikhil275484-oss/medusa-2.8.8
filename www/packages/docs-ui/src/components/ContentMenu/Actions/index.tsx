"use client"

import Link from "next/link"
import React, { useMemo } from "react"
import { MarkdownIcon } from "../../Icons/Markdown"
import { useAiAssistant, useSiteConfig } from "../../../providers"
import { usePathname } from "next/navigation"
import { BroomSparkle } from "@medusajs/icons"
import { useChat } from "@kapaai/react-sdk"

export const ContentMenuActions = () => {
  const {
    config: { baseUrl, basePath },
  } = useSiteConfig()
  const pathname = usePathname()
  const { setChatOpened } = useAiAssistant()
  const { isGeneratingAnswer, isPreparingAnswer, submitQuery } = useChat()
  const loading = useMemo(
    () => isGeneratingAnswer || isPreparingAnswer,
    [isGeneratingAnswer, isPreparingAnswer]
  )
  const pageUrl = `${baseUrl}${basePath}${pathname}`

  const handleAiAssistantClick = () => {
    if (loading) {
      return
    }
    submitQuery(`Explain the page ${pageUrl}`)
    setChatOpened(true)
  }

  return (
    <div className="flex flex-col gap-docs_0.5">
      <Link
        className="flex items-center gap-docs_0.5 text-medusa-fg-subtle text-x-small-plus hover:text-medusa-fg-base"
        href={`${pageUrl}/index.html.md`}
      >
        <MarkdownIcon width={15} height={15} />
        View as Markdown
      </Link>
      <button
        className="appearance-none p-0 flex items-center gap-docs_0.5 text-medusa-fg-subtle text-x-small-plus hover:text-medusa-fg-base"
        onClick={handleAiAssistantClick}
      >
        <BroomSparkle width={15} height={15} />
        Explain with AI Assistant
      </button>
    </div>
  )
}
