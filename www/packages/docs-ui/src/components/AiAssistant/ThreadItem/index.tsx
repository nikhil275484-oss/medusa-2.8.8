import clsx from "clsx"
import React, { useMemo } from "react"
import {
  AiAssistantIcon,
  CodeMdx,
  CodeMdxProps,
  DotsLoading,
  MarkdownContent,
  MDXComponents,
} from "@/components"
import { AiAssistantThreadItemActions } from "./Actions"
import { AiAssistantThreadItem as AiAssistantThreadItemType } from "../../../providers"
import { useChat } from "@kapaai/react-sdk"

export type AiAssistantThreadItemProps = {
  item: AiAssistantThreadItemType
}

export const AiAssistantThreadItem = ({ item }: AiAssistantThreadItemProps) => {
  const { error } = useChat()
  const showLoading = useMemo(() => {
    if (error?.length) {
      return false
    }

    return !item.question_id && item.content.length === 0
  }, [item, error])
  return (
    <div
      className={clsx(
        "p-docs_0.5 flex gap-docs_0.75 items-start",
        item.type === "question" && "justify-end",
        item.type === "answer" && "!pr-[20px]"
      )}
    >
      {item.type !== "question" && (
        <span className="w-[20px] block">
          <AiAssistantIcon />
        </span>
      )}
      <div
        className={clsx(
          "txt-small text-medusa-fg-base",
          item.type === "question" && [
            "rounded-docs_xl bg-medusa-tag-neutral-bg",
            "px-docs_0.75 py-docs_0.5 max-w-full md:max-w-[400px]",
          ],
          item.type !== "question" && "flex-1",
          item.type === "answer" && "text-pretty flex-1 max-w-[calc(100%-20px)]"
        )}
      >
        {item.type === "question" && (
          <MarkdownContent
            className="[&>*:last-child]:mb-0"
            allowedElements={["br", "p", "code", "pre"]}
            unwrapDisallowed={true}
            components={{
              ...MDXComponents,
              code: (props: CodeMdxProps) => {
                return (
                  <CodeMdx
                    {...props}
                    noCopy
                    noReport
                    forceNoTitle
                    noAskAi
                    inlineCodeProps={{
                      ...props.inlineCodeProps,
                      className: "!text-wrap !break-words",
                      variant: "grey-bg",
                    }}
                    collapsibleLines="11"
                    codeBlockProps={{
                      className: clsx(
                        "rounded-docs_lg p-[5px]",
                        props.className
                      ),
                      wrapperClassName: "rounded-docs_lg",
                      innerClassName: "border rounded-docs_lg",
                      overrideColors: {
                        bg: "bg-medusa-contrast-bg-subtle",
                        innerBg: "bg-medusa-contrast-bg-subtle",
                        innerBorder: "border-medusa-contrast-border-bot",
                      },
                    }}
                  />
                )
              },
            }}
          >
            {item.content}
          </MarkdownContent>
        )}
        {item.type === "answer" && (
          <div className="flex flex-col gap-docs_0.75">
            {showLoading && <DotsLoading />}
            <MarkdownContent
              className="[&>*:last-child]:mb-0"
              components={{
                ...MDXComponents,
                code: (props: CodeMdxProps) => {
                  return (
                    <CodeMdx
                      {...props}
                      noReport
                      noAskAi
                      wrapperClassName="mt-docs_1"
                    />
                  )
                },
              }}
              disallowedElements={["h1", "h2", "h3", "h4", "h5", "h6"]}
            >
              {item.content}
            </MarkdownContent>
            {item.question_id && <AiAssistantThreadItemActions item={item} />}
          </div>
        )}
        {item.type === "error" && (
          <span className="text-medusa-fg-error">{item.content}</span>
        )}
      </div>
    </div>
  )
}
