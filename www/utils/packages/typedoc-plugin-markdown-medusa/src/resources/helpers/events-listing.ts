import Handlebars from "handlebars"
import pkg from "slugify"
import { DeclarationReflection, ReflectionKind } from "typedoc"

const slugify = pkg.default

export default function () {
  Handlebars.registerHelper(
    "eventsListing",
    function (this: DeclarationReflection) {
      const content: string[] = []

      const subtitleLevel = (this.children?.length ?? 0) > 1 ? 3 : 2
      const showHeader = (this.children?.length ?? 0) > 1

      function parseChildren(children: DeclarationReflection[]) {
        let count = 0
        children.forEach((child, index) => {
          content.push(
            formatEventsType(child as DeclarationReflection, {
              subtitleLevel,
              showHeader,
            })
          )
          if (index < children!.length - 1) {
            content.push("")
            content.push("---")
            content.push("")
          }
          count++
        })

        return count
      }

      if (this.kind === ReflectionKind.Module) {
        const sortedChildren = sortChildren(
          this.children?.map((child) => child.children || []).flat() || []
        )
        parseChildren(sortedChildren)
      } else {
        parseChildren(sortChildren(this.children || []))
      }

      return content.join("\n")
    }
  )
}

function formatEventsType(
  eventVariable: DeclarationReflection,
  {
    subtitleLevel = 3,
    showHeader = true,
  }: {
    subtitleLevel?: number
    showHeader?: boolean
  }
) {
  if (eventVariable.type?.type !== "reflection") {
    return ""
  }
  const content: string[] = []
  const subHeaderPrefix = "#".repeat(subtitleLevel)
  const header =
    eventVariable.comment?.blockTags
      .find((tag) => tag.tag === "@category")
      ?.content.map((content) => content.text)
      .join("") || ""
  if (showHeader) {
    content.push(`${"#".repeat(subtitleLevel - 1)} ${header} Events`)
  }
  content.push("")

  const eventProperties = (
    eventVariable.type.declaration.children || []
  ).filter((child) => (getEventWorkflows(child)?.length || 0) > 0)

  content.push(`${subHeaderPrefix} Summary`)
  content.push("")
  // table start
  content.push(`<Table>`)
  // table header start
  content.push(`  <Table.Header>`)
  content.push(`    <Table.Row>`)
  content.push(`      <Table.HeaderCell>\nEvent\n</Table.HeaderCell>`)
  content.push(`      <Table.HeaderCell>\nDescription\n</Table.HeaderCell>`)
  // table header end
  content.push(`    </Table.Row>`)
  content.push(`  </Table.Header>`)
  // table body start
  content.push(`  <Table.Body>`)
  eventProperties.forEach((event) => {
    let eventName =
      event.comment?.blockTags
        .find((tag) => tag.tag === "@eventName")
        ?.content.map((content) => content.text)
        .join("") || ""
    eventName = `[${eventName}](#${getEventNameSlug(eventName)})`
    const eventDescription = event.comment?.summary
      .map((content) => content.text)
      .join("")
    const deprecationTag = event.comment?.blockTags.find(
      (tag) => tag.tag === "@deprecated"
    )

    if (deprecationTag) {
      eventName += `\n`
      const deprecationText = deprecationTag.content
        .map((content) => content.text)
        .join("")
        .trim()
      if (deprecationText.length) {
        eventName += `<Tooltip text="${deprecationText}">`
      }
      eventName += `<Badge variant="orange">Deprecated</Badge>`
      if (deprecationText.length) {
        eventName += `</Tooltip>`
      }
    }

    const versionTag = event.comment?.blockTags.find(
      (tag) => tag.tag === "@version"
    )

    if (versionTag) {
      eventName += `\n`
      const versionText = versionTag.content
        .map((content) => content.text)
        .join("")
        .trim()
      eventName += `<Tooltip text="This event was added in version v${versionText}">`
      eventName += `<Badge variant="blue">v${versionText}</Badge>`
      eventName += `</Tooltip>`
    }

    content.push(`    <Table.Row>`)
    content.push(`      <Table.Cell>\n${eventName}\n</Table.Cell>`)
    content.push(`      <Table.Cell>\n${eventDescription}\n</Table.Cell>`)
    content.push(`    </Table.Row>`)
  })
  // table body end
  content.push(`  </Table.Body>`)
  // table end
  content.push(`</Table>`)
  content.push("")

  eventProperties.forEach((event, index) => {
    const eventName = event.comment?.blockTags
      .find((tag) => tag.tag === "@eventName")
      ?.content.map((content) => content.text)
      .join("")
    const eventDescription = event.comment?.summary
      .map((content) => content.text)
      .join("")
    const eventPayload = event.comment?.blockTags
      .find((tag) => tag.tag === "@eventPayload")
      ?.content.map((content) => content.text)
      .join("")
    const workflows = getEventWorkflows(event)
    const deprecatedTag = event.comment?.blockTags.find(
      (tag) => tag.tag === "@deprecated"
    )
    const deprecatedMessage = deprecatedTag?.content
      .map((content) => content.text)
      .join("")
      .trim()

    const versionTag = event.comment?.blockTags.find(
      (tag) => tag.tag === "@version"
    )

    content.push(
      getEventHeading({
        titleLevel: subtitleLevel,
        eventName: eventName || "",
        payload: eventPayload || "",
        deprecated: !!deprecatedTag,
        deprecatedMessage,
        version: versionTag
          ? versionTag.content
              .map((content) => content.text)
              .join("")
              .trim()
          : undefined,
      })
    )
    content.push("")
    content.push(eventDescription || "")
    content.push("")
    content.push(`${subHeaderPrefix}# Payload`)
    content.push("")
    content.push(eventPayload || "")
    content.push("")
    content.push(
      `${subHeaderPrefix}# Workflows Emitting this Event\n\nThe following workflows emit this event when they're executed. These workflows are executed by Medusa's API routes. You can also view the events emitted by API routes in the [Store](https://docs.medusajs.com/api/store) and [Admin](https://docs.medusajs.com/api/admin) API references.`
    )
    content.push("")
    workflows?.forEach((workflow) => {
      content.push(`- [${workflow}](/references/medusa-workflows/${workflow})`)
    })
    content.push("")
    if (index < eventProperties.length - 1) {
      content.push("---")
      content.push("")
    }
  })

  return content.join("\n")
}

function getEventHeading({
  titleLevel,
  eventName,
  payload,
  deprecated = false,
  deprecatedMessage,
  version,
}: {
  titleLevel: number
  eventName: string
  payload: string
  deprecated?: boolean
  deprecatedMessage?: string
  version?: string
}) {
  const heading = [eventName]
  if (deprecated) {
    if (deprecatedMessage?.length) {
      heading.push(`<Tooltip text="${deprecatedMessage}">`)
    }

    heading.push(`<Badge variant="orange">Deprecated</Badge>`)

    if (deprecatedMessage?.length) {
      heading.push(`</Tooltip>`)
    }
  }
  if (version) {
    if (deprecated) {
      heading.push(`\n`)
    }
    heading.push(`<Tooltip text="This event was added in version v${version}">`)
    heading.push(`<Badge variant="blue">v${version}</Badge>`)
    heading.push(`</Tooltip>`)
  }
  return `<EventHeader headerLvl="${titleLevel}" headerProps={{ id: "${getEventNameSlug(
    eventName
  )}", children: (<>${heading.join(
    "\n"
  )}</>), className: "flex flex-wrap justify-center gap-docs_0.25" }} eventName="${eventName}" payload={\`${payload.replaceAll(
    "`",
    "\\`"
  )}\`} />`
}

function getEventNameSlug(eventName: string) {
  return slugify(eventName.replace(".", ""), { lower: true })
}

function getEventWorkflows(event: DeclarationReflection): string[] | undefined {
  return event.comment?.blockTags
    .find((tag) => tag.tag === "@workflows")
    ?.content.map((content) => content.text)
    .join("")
    .split(", ")
}

function sortChildren(ref: DeclarationReflection[]) {
  return ref.sort((a, b) => {
    return a.name.localeCompare(b.name)
  })
}
