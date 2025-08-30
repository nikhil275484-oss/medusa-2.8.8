import Handlebars from "handlebars"
import { SignatureReflection } from "typedoc"

export default function () {
  Handlebars.registerHelper(
    "workflowEvents",
    function (this: SignatureReflection): string {
      if (!this.parent) {
        return ""
      }

      const workflowEventComments = this.parent.comment?.blockTags.filter(
        (tag) => tag.tag === "@workflowEvent"
      )

      if (!workflowEventComments?.length) {
        return ""
      }

      let str = `${Handlebars.helpers.titleLevel()} Emitted Events\n\nThis section lists the events that are either triggered by the \`emitEventStep\` in the workflow, or by another workflow executed within this workflow.\n\nYou can listen to these events in a subscriber, as explained in the [Subscribers](https://docs.medusajs.com/learn/fundamentals/events-and-subscribers) documentation.\n\n`

      str += `<Table>\n`
      str += `  <Table.Header>\n`
      str += `    <Table.Row>\n`
      str += `      <Table.HeaderCell>\nEvent\n</Table.HeaderCell>\n`
      str += `      <Table.HeaderCell>\nDescription\n</Table.HeaderCell>\n`
      str += `      <Table.HeaderCell>\nPayload\n</Table.HeaderCell>\n`
      str += `      <Table.HeaderCell>\nAction\n</Table.HeaderCell>\n`
      str += `    </Table.Row>\n`
      str += `  </Table.Header>\n`
      str += `  <Table.Body>\n`
      workflowEventComments.forEach((comment) => {
        const commentContent = comment.content
          .map((c) => c.text)
          .join(" ")
          .split("--")
        const eventName = commentContent[0].trim()
        const eventPayload = commentContent[2]?.trim() || ""
        let eventNameFormatted = `\`${eventName}\``
        const eventDescription = commentContent[1]?.trim() || ""
        const eventPayloadFormatted = eventPayload
          .replace("```ts\n", "")
          .replace("\n```", "")
        const isDeprecatedOrHasVersion = commentContent.length >= 4
        const deprecatedIndex = isDeprecatedOrHasVersion
          ? commentContent.slice(3).findIndex((c) => c.trim() === "deprecated")
          : -1
        const isDeprecated = deprecatedIndex !== -1
        const deprecatedText = (
          isDeprecated ? commentContent[3 + deprecatedIndex] || "" : ""
        ).trim()
        const version = isDeprecatedOrHasVersion
          ? commentContent
              .slice(3)
              .find((c) => c.trim().startsWith("version: "))
          : undefined
        const versionText = (
          version ? version.replace("version: ", "") : ""
        ).trim()

        if (isDeprecated) {
          eventNameFormatted += `\n`
          if (deprecatedText) {
            eventNameFormatted += `<Tooltip text="${deprecatedText}">`
          }
          eventNameFormatted += `<Badge variant="orange">Deprecated</Badge>`
          if (deprecatedText) {
            eventNameFormatted += `</Tooltip>`
          }
        }

        if (versionText) {
          eventNameFormatted += `\n\n`
          eventNameFormatted += `<Tooltip text="This event was added in version v${versionText}">`
          eventNameFormatted += `<Badge variant="blue">v${versionText}</Badge>`
          eventNameFormatted += `</Tooltip>\n`
        }

        str += `    <Table.Row>\n`
        str += `      <Table.Cell>\n${eventNameFormatted}\n</Table.Cell>\n`
        str += `      <Table.Cell>\n${eventDescription}\n</Table.Cell>\n`
        str += `      <Table.Cell>\n\`\`\`ts blockStyle="inline"\n${eventPayloadFormatted}\n\`\`\`\n</Table.Cell>\n`
        str += `      <Table.Cell>\n<CopyGeneratedSnippetButton tooltipText="Copy subscriber for event" type="subscriber" options={{
        event: "${eventName}",
        payload: \`${eventPayload.replaceAll("`", "\\`")}\`
        }}/>\n</Table.Cell>\n`
        str += `    </Table.Row>\n`
      })
      str += `  </Table.Body>\n`
      str += `</Table>\n\n`

      return str
    }
  )
}
