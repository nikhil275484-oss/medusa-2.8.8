"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
// @ts-expect-error can't install the types package because it doesn't support React v19
import { CSSTransition, SwitchTransition } from "react-transition-group"
import { Solutions } from "./Solutions"
import { ExtraData, useAnalytics } from "@/providers/Analytics"
import clsx from "clsx"
import {
  Button,
  TextArea,
  Label,
  DottedSeparator,
  RadioItem,
} from "@/components"
import { ChatBubbleLeftRight, ThumbDown, ThumbUp } from "@medusajs/icons"
import Link from "next/link"
import { useSiteConfig } from "../../providers"
import { RadioGroup } from "@medusajs/ui"

export type FeedbackProps = {
  event: string
  pathName: string
  reportLink?: string
  question?: string
  positiveBtn?: string
  negativeBtn?: string
  positiveQuestion?: string
  negativeQuestion?: string
  submitBtn?: string
  submitMessage?: string
  showPossibleSolutions?: boolean
  className?: string
  extraData?: ExtraData
  vertical?: boolean
  showDottedSeparator?: boolean
} & React.HTMLAttributes<HTMLDivElement>

const feedbackOptions = {
  positive: [
    "Easy to understand",
    "Accurate code and text",
    "Exactly what I was looking for",
    "Ease of use",
    "Other",
  ],
  negative: [
    "Difficult to understand",
    "Inaccurate code or text",
    "Didn't find what I was looking for",
    "Trouble using the documentation",
    "Other",
  ],
}

export const Feedback = ({
  event,
  pathName,
  reportLink: initReportLink,
  question = "Was this page helpful?",
  positiveBtn = "It was helpful",
  negativeBtn = "It wasn't helpful",
  positiveQuestion = "What did you like?",
  negativeQuestion = "What was the problem?",
  submitBtn = "Submit",
  submitMessage = "Thank you for helping improve our documentation!",
  showPossibleSolutions = true,
  className = "",
  extraData = {},
  vertical = false,
  showDottedSeparator = true,
}: FeedbackProps) => {
  const {
    config: { reportIssueLink },
  } = useSiteConfig()
  const reportLink = useMemo(() => {
    return initReportLink || reportIssueLink
  }, [initReportLink, reportIssueLink])
  const [showForm, setShowForm] = useState(false)
  const [submittedFeedback, setSubmittedFeedback] = useState(false)
  const [loading, setLoading] = useState(false)
  const inlineFeedbackRef = useRef<HTMLDivElement>(null)
  const inlineQuestionRef = useRef<HTMLDivElement>(null)
  const inlineMessageRef = useRef<HTMLDivElement>(null)
  const [positiveFeedback, setPositiveFeedback] = useState(false)
  const [message, setMessage] = useState("")
  const [feedbackOption, setFeedbackOption] = useState("")
  const nodeRef = submittedFeedback
    ? inlineMessageRef
    : showForm
      ? inlineQuestionRef
      : inlineFeedbackRef
  const { loaded, track } = useAnalytics()

  function handleFeedback(feedback: boolean) {
    if (!loaded) {
      return
    }
    setPositiveFeedback(feedback)
    setShowForm(true)
    submitFeedback(feedback)
  }

  function submitFeedback(feedback = false) {
    if (showForm) {
      setLoading(true)
    }
    track(
      event,
      {
        url: pathName,
        label: document.title,
        feedback:
          (feedback !== null && feedback) ||
          (feedback === null && positiveFeedback)
            ? "yes"
            : "no",
        message: message?.length ? message : null,
        os: window.navigator.userAgent,
        feedbackOption,
        ...extraData,
      },
      function () {
        if (showForm) {
          setLoading(false)
          resetForm()
        }
      }
    )
  }

  function resetForm() {
    setShowForm(false)
    setSubmittedFeedback(true)
  }

  useEffect(() => {
    setFeedbackOption("Other")
  }, [positiveFeedback])

  return (
    <div className={clsx(className)}>
      {showDottedSeparator && (
        <DottedSeparator wrapperClassName="!px-0 !my-docs_2" />
      )}
      <SwitchTransition mode="out-in">
        <CSSTransition
          key={
            showForm
              ? "show_form"
              : !submittedFeedback
                ? "feedback"
                : "submitted_feedback"
          }
          nodeRef={nodeRef}
          timeout={300}
          addEndListener={(done: () => void) => {
            nodeRef.current?.addEventListener("transitionend", done, false)
          }}
          classNames={{
            enter: "animate-fadeIn animation-fill-forwards animate-fast",
            exit: "animate-fadeOut animation-fill-forwards animate-fast",
          }}
        >
          <>
            {!showForm && !submittedFeedback && (
              <div
                className={clsx(
                  "flex gap-docs_0.5",
                  !vertical && "flex-col md:flex-row md:items-center",
                  vertical && "flex-col justify-center"
                )}
                ref={inlineFeedbackRef}
              >
                <Label className={"text-compact-small text-medusa-fg-base"}>
                  {question}
                </Label>
                <div
                  className={clsx(
                    "flex gap-docs_0.5",
                    "flex-col md:flex-row md:items-center"
                  )}
                >
                  <Button
                    onClick={() => handleFeedback(true)}
                    className={clsx(
                      "positive gap-[6px] !justify-start md:!justify-center",
                      "!px-docs_0.5 !py-docs_0.25 text-left md:text-center"
                    )}
                    variant="transparent-clear"
                  >
                    <ThumbUp className="text-medusa-fg-subtle" />
                    <span className="text-medusa-fg-base text-compact-small-plus flex-1">
                      {positiveBtn}
                    </span>
                  </Button>
                  <Button
                    onClick={() => handleFeedback(false)}
                    className={clsx(
                      "gap-[6px] !justify-start md:!justify-center",
                      "!px-docs_0.5 !py-docs_0.25 text-left md:text-center"
                    )}
                    variant="transparent-clear"
                  >
                    <ThumbDown className="text-medusa-fg-subtle" />
                    <span className="text-medusa-fg-base text-compact-small-plus flex-1">
                      {negativeBtn}
                    </span>
                  </Button>
                  {reportLink && (
                    <Button
                      variant="transparent-clear"
                      className={clsx(
                        "gap-[6px] relative",
                        "!px-docs_0.5 !py-docs_0.25",
                        "!justify-start md:!justify-center",
                        "text-left md:text-center"
                      )}
                    >
                      <ChatBubbleLeftRight className="text-medusa-fg-subtle" />
                      <span className="text-medusa-fg-base text-compact-small-plus flex-1">
                        Report Issue
                      </span>
                      <Link
                        href={reportLink}
                        className="absolute left-0 top-0 w-full h-full"
                      ></Link>
                    </Button>
                  )}
                </div>
              </div>
            )}
            {showForm && !submittedFeedback && (
              <div className="flex flex-col gap-docs_1" ref={inlineQuestionRef}>
                <Label>
                  {positiveFeedback ? positiveQuestion : negativeQuestion}
                </Label>
                <RadioGroup className="gap-docs_0.5">
                  {feedbackOptions[
                    positiveFeedback ? "positive" : "negative"
                  ].map((option) => (
                    <div
                      className="flex items-center gap-x-docs_0.5 cursor-pointer group"
                      key={option}
                      tabIndex={-1}
                      onClick={() => setFeedbackOption(option)}
                    >
                      <RadioItem
                        checked={feedbackOption === option}
                        value={option}
                        onChange={() => setFeedbackOption(option)}
                        className={clsx(
                          feedbackOption !== option &&
                            "group-hover:bg-medusa-bg-component-hover"
                        )}
                      />
                      <Label className="text-medusa-fg-base text-compact-small-plus">
                        {option}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
                <TextArea
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Please provide as many details as possible to help us improve the documentation."
                />
                <Button
                  onClick={() => submitFeedback(positiveFeedback)}
                  disabled={loading}
                  className="w-fit"
                  variant="secondary"
                >
                  {submitBtn}
                </Button>
              </div>
            )}
            {submittedFeedback && (
              <div>
                <div
                  className="text-compact-large-plus flex flex-col"
                  ref={inlineMessageRef}
                >
                  <span>{submitMessage}</span>
                  {showPossibleSolutions && (
                    <Solutions message={message} feedback={positiveFeedback} />
                  )}
                </div>
              </div>
            )}
          </>
        </CSSTransition>
      </SwitchTransition>
      {showDottedSeparator && (
        <DottedSeparator wrapperClassName="!px-0 !my-docs_2" />
      )}
    </div>
  )
}
