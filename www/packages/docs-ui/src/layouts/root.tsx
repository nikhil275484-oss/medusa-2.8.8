import React from "react"
import clsx from "clsx"
import { RootProviders, Sidebar, SidebarProps } from "@/components"
import { MainContentLayout, MainContentLayoutProps } from "./main-content"
import { AiAssistantChatWindow } from "../components/AiAssistant/ChatWindow"

export type RootLayoutProps = {
  bodyClassName?: string
  sidebarProps?: SidebarProps
  showBreadcrumbs?: boolean
  ProvidersComponent: React.FC<{ children: React.ReactNode }>
  footerComponent?: React.ReactNode
} & MainContentLayoutProps

export const RootLayout = ({
  bodyClassName,
  sidebarProps,
  ProvidersComponent,
  ...mainProps
}: RootLayoutProps) => {
  return (
    <body
      className={clsx(
        "bg-medusa-bg-subtle font-base text-medium w-full",
        "text-medusa-fg-base",
        "h-screen overflow-hidden",
        "grid grid-cols-1 lg:mx-auto lg:grid-cols-[221px_1fr]",
        bodyClassName
      )}
    >
      <RootProviders>
        <ProvidersComponent>
          <Sidebar {...sidebarProps} />
          <div className={clsx("relative", "h-screen", "flex")}>
            <MainContentLayout {...mainProps} />
            <AiAssistantChatWindow />
          </div>
        </ProvidersComponent>
      </RootProviders>
    </body>
  )
}
