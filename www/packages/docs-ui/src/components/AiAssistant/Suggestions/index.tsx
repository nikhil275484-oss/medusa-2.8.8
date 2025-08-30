"use client"

import React from "react"
import { SearchSuggestionType } from "../../Search/Suggestions"
import { SearchHitGroupName } from "../../Search/Hits/GroupName"
import { SearchSuggestionItem } from "../../Search/Suggestions/Item"
import { useChat } from "@kapaai/react-sdk"

type AiAssistantSuggestionsProps = React.AllHTMLAttributes<HTMLDivElement>

export const AiAssistantSuggestions = (props: AiAssistantSuggestionsProps) => {
  const { submitQuery } = useChat()
  const suggestions: SearchSuggestionType[] = [
    {
      title: "FAQ",
      items: [
        "What is Medusa?",
        "How can I create a module?",
        "How can I create a data model?",
        "How do I create a workflow?",
        "How can I extend a data model in the Product Module?",
      ],
    },
    {
      title: "Recipes",
      items: [
        "How do I build a marketplace with Medusa?",
        "How do I build digital products with Medusa?",
        "How do I build subscription-based purchases with Medusa?",
        "What other recipes are available in the Medusa documentation?",
      ],
    },
  ]

  return (
    <div {...props}>
      {suggestions.map((suggestion, index) => (
        <React.Fragment key={index}>
          <SearchHitGroupName name={suggestion.title} />
          {suggestion.items.map((item, itemIndex) => (
            <SearchSuggestionItem
              onClick={() => {
                submitQuery(item)
              }}
              key={itemIndex}
              tabIndex={itemIndex}
            >
              {item}
            </SearchSuggestionItem>
          ))}
        </React.Fragment>
      ))}
    </div>
  )
}
