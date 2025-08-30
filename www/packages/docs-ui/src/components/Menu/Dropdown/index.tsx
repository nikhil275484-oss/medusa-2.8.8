"use client"

import React from "react"
import { useRef, useState } from "react"
import { Button, Menu, useClickOutside } from "../../.."
import { MenuItem } from "types"
import clsx from "clsx"

type DropdownMenuProps = {
  dropdownButtonContent: React.ReactNode
  dropdownButtonClassName?: string
  menuComponent?: React.ReactNode
  menuItems?: MenuItem[]
  menuClassName?: string
  className?: string
  open?: boolean
  setOpen?: (open: boolean) => void
}

export const DropdownMenu = ({
  dropdownButtonContent,
  dropdownButtonClassName,
  menuComponent,
  menuItems,
  menuClassName,
  className,
  open: externalOpen = false,
  setOpen: externalSetOpen,
}: DropdownMenuProps) => {
  const [open, setOpen] = useState(externalOpen)
  const ref = useRef<HTMLButtonElement | null>(null)
  function changeOpenState(newOpenState: boolean) {
    if (externalSetOpen) {
      externalSetOpen(newOpenState)
    } else {
      setOpen(newOpenState)
    }
  }
  useClickOutside({
    elmRef: ref,
    onClickOutside: () => {
      changeOpenState(false)
    },
  })

  if (!menuComponent && !menuItems) {
    return null
  }

  return (
    <div className={clsx("relative", className)}>
      <Button
        variant="transparent"
        onClick={() => changeOpenState(!open)}
        className={clsx(
          "!p-[6px] text-medusa-fg-subtle",
          dropdownButtonClassName
        )}
        buttonRef={ref}
      >
        {dropdownButtonContent}
      </Button>
      {menuComponent}
      {!menuComponent && menuItems && (
        <Menu
          items={menuItems}
          className={clsx(
            "absolute right-0 top-[calc(100%+8px)] w-max",
            !open && "hidden",
            menuClassName
          )}
        />
      )}
    </div>
  )
}
