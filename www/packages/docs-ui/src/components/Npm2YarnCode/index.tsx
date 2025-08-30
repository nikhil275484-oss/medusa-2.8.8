import React from "react"
import { CodeBlock, CodeBlockMetaFields, CodeTab, CodeTabs } from "../.."
import convert from "npm-to-yarn"

type Npm2YarnCodeProps = {
  npmCode: string
} & Omit<CodeBlockMetaFields, "npm2yarn">

export const Npm2YarnCode = ({
  npmCode,
  ...codeOptions
}: Npm2YarnCodeProps) => {
  // convert npm code
  const yarnCode = convert(npmCode, "yarn").replaceAll(/([^\s])&&/g, "$1 &&")
  const pnpmCode = convert(npmCode, "pnpm").replaceAll(/([^\s])&&/g, "$1 &&")
  const lang = "bash"

  codeOptions.hasTabs = true

  const tabs = [
    {
      label: "npm",
      value: "npm",
      code: {
        source: npmCode,
        lang,
        ...codeOptions,
      },
    },
    {
      label: "yarn",
      value: "yarn",
      code: {
        source: yarnCode,
        lang,
        ...codeOptions,
      },
    },
    {
      label: "pnpm",
      value: "pnpm",
      code: {
        source: pnpmCode,
        lang,
        ...codeOptions,
      },
    },
  ]

  return (
    <CodeTabs group="npm2yarn">
      {tabs.map((tab, index) => (
        <CodeTab label={tab.label} value={tab.value} key={index}>
          <CodeBlock {...tab.code} />
        </CodeTab>
      ))}
    </CodeTabs>
  )
}
