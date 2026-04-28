"use client"

import * as React from "react"
import { ScrollArea as ScrollAreaPrimitive } from "@base-ui/react/scroll-area"

import { cn } from "@/lib/utils"

function ScrollArea({
  className,
  children,
  ...props
}: ScrollAreaPrimitive.Root.Props) {
  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      className={cn("relative", className)}
      {...props}
    >
      <ScrollAreaPrimitive.Viewport
        data-slot="scroll-area-viewport"
        className="size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1"
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  )
}

function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}: ScrollAreaPrimitive.Scrollbar.Props) {
  return (
    <ScrollAreaPrimitive.Scrollbar
      data-slot="scroll-area-scrollbar"
      data-orientation={orientation}
      orientation={orientation}
      className={cn(
        // Auto-hide: the scrollbar is invisible by default and fades in only
        // while the user is hovering the viewport or actively scrolling.
        // base-ui emits `data-hovering` / `data-scrolling` on the scrollbar
        // element itself while either condition is true.
        //
        // Sizing: the track is 14px wide (vertical) / 14px tall (horizontal)
        // with 4px of padding on each side so the 6px thumb has visual
        // breathing room from the card edge.
        "flex touch-none select-none opacity-0 transition-opacity duration-150 data-hovering:opacity-100 data-scrolling:opacity-100 data-horizontal:h-3.5 data-horizontal:flex-col data-horizontal:py-1 data-vertical:h-full data-vertical:w-3.5 data-vertical:px-1",
        className
      )}
      {...props}
    >
      <ScrollAreaPrimitive.Thumb
        data-slot="scroll-area-thumb"
        // Fixed 80px thumb in the primary axis. base-ui normally sets the
        // thumb length via `--scroll-area-thumb-height` (a content-ratio
        // proportional value) on the inline `style`; we override with a
        // `!important` Tailwind utility so the thumb stays a constant 80px
        // regardless of scrollable content length. `flex-1` keeps the thumb
        // filling the 6px cross-axis of the track (the outer 14px scrollbar
        // minus its 4px side padding).
        className="relative flex-1 rounded-full bg-border data-vertical:!h-20 data-horizontal:!w-20"
      />
    </ScrollAreaPrimitive.Scrollbar>
  )
}

export { ScrollArea, ScrollBar }
