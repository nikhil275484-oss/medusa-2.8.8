import React from "react"
import { BadgeProps } from "@/components"
import { CardDefaultLayout } from "./Layout/Default"
import { IconProps } from "@medusajs/icons/dist/types"
import { CardLargeLayout } from "./Layout/Large"
import { CardFillerLayout } from "./Layout/Filler"
import { CardLayoutMini } from "./Layout/Mini"
import { LinkProps } from "next/link"

export type CardProps = {
  type?: "default" | "large" | "filler" | "mini"
  icon?: React.FC<IconProps>
  rightIcon?: React.FC<IconProps>
  image?: string
  themeImage?: {
    light: string
    dark: string
  }
  imageDimensions?: {
    width: number
    height: number
  }
  title?: string
  text?: string
  href?: string
  className?: string
  contentClassName?: string
  iconClassName?: string
  children?: React.ReactNode
  badge?: BadgeProps
  highlightText?: string[]
  closeable?: boolean
  onClose?: () => void
  hrefProps?: Partial<LinkProps & React.AllHTMLAttributes<HTMLAnchorElement>>
  cardRef?: React.Ref<HTMLDivElement>
}

export const Card = ({ type = "default", ...props }: CardProps) => {
  switch (type) {
    case "large":
      return <CardLargeLayout {...props} />
    case "filler":
      return <CardFillerLayout {...props} />
    case "mini":
      return <CardLayoutMini {...props} />
    default:
      return <CardDefaultLayout {...props} />
  }
}
