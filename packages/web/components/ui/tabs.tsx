'use client'
/**
 * shadcn's Tabs, on @radix-ui/react-tabs rather than the whole radix-ui
 * bundle, with its default classes taken out. Every tab set here already has a
 * Soft Pop look in globals.css (.seg-tabs, .section-tabs, .seg) or in its own
 * utilities, and shadcn's utilities would outrank those component-layer rules.
 * What this keeps is the behaviour: roles, ids, aria-selected and arrow-key
 * roving focus.
 *
 * Radix activates a trigger on mousedown, not click — a unit test drives one
 * with fireEvent.mouseDown.
 */
import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'

function Tabs(props: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root data-slot="tabs" {...props} />
}

function TabsList(props: React.ComponentProps<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List data-slot="tabs-list" {...props} />
}

function TabsTrigger(props: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return <TabsPrimitive.Trigger data-slot="tabs-trigger" {...props} />
}

function TabsContent(props: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content data-slot="tabs-content" {...props} />
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
