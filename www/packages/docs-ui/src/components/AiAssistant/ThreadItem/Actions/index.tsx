import React, { useState } from "react"
import clsx from "clsx"
import { Badge, Button, Link, type ButtonProps } from "@/components"
import { ThumbDown, ThumbUp } from "@medusajs/icons"
import { AiAssistantThreadItem as AiAssistantThreadItemType } from "../../../../providers"
import { Reaction, useChat } from "@kapaai/react-sdk"

export type AiAssistantThreadItemActionsProps = {
  item: AiAssistantThreadItemType
}

export const AiAssistantThreadItemActions = ({
  item,
}: AiAssistantThreadItemActionsProps) => {
  const [feedback, setFeedback] = useState<Reaction | null>(null)
  const { addFeedback } = useChat()

  const handleFeedback = async (
    reaction: Reaction,
    question_id?: string | null
  ) => {
    try {
      if (!question_id || feedback) {
        return
      }
      setFeedback(reaction)
      addFeedback(question_id, reaction)
    } catch (error) {
      console.error("Error sending feedback:", error)
    }
  }

  return (
    <div className={clsx("flex gap-docs_0.75 justify-between items-center")}>
      {item.sources !== undefined && item.sources.length > 0 && (
        <div className="flex gap-[6px] items-center flex-wrap">
          {item.sources.map((source) => (
            <Badge key={source.source_url} variant="neutral">
              <Link href={source.source_url} className="!text-inherit">
                {source.title}
              </Link>
            </Badge>
          ))}
        </div>
      )}
      <div className="flex gap-docs_0.25 items-center text-medusa-fg-muted">
        {(feedback === null || feedback === "upvote") && (
          <ActionButton
            onClick={async () => handleFeedback("upvote", item.question_id)}
            className={clsx(feedback === "upvote" && "!text-medusa-fg-muted")}
          >
            <ThumbUp />
          </ActionButton>
        )}
        {(feedback === null || feedback === "downvote") && (
          <ActionButton
            onClick={async () => handleFeedback("downvote", item.question_id)}
            className={clsx(feedback === "downvote" && "!text-medusa-fg-muted")}
          >
            <ThumbDown />
          </ActionButton>
        )}
      </div>
    </div>
  )
}

const ActionButton = ({ children, className, ...props }: ButtonProps) => {
  return (
    <Button
      variant="transparent"
      className={clsx(
        "text-medusa-fg-muted hover:text-medusa-fg-muted",
        "hover:bg-medusa-bg-subtle-hover",
        "!p-[4.5px] rounded-docs_sm",
        className
      )}
      {...props}
    >
      {children}
    </Button>
  )
}
