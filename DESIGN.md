---
name: SplitTogether
description: Clean neutral shared-expense interface
colors:
  canvas: "#f7f8fa"
  surface: "#ffffff"
  surface-muted: "#f0f2f5"
  border: "#e5e7eb"
  border-strong: "#c6cbd3"
  ink: "#252a32"
  ink-muted: "#59616e"
  ink-subtle: "#626b78"
  primary: "#315fba"
  primary-hover: "#274e9a"
  focus: "#315fba"
  focus-soft: "#dce7fb"
  positive: "#27704f"
  negative: "#b13a49"
typography:
  headline:
    fontFamily: "Geist, Arial, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: "2.25rem"
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Geist, Arial, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: "1.75rem"
  body:
    fontFamily: "Geist, Arial, sans-serif"
    fontSize: "0.875rem"
    lineHeight: "1.25rem"
  label:
    fontFamily: "Geist, Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: "1.25rem"
  caption:
    fontFamily: "Geist, Arial, sans-serif"
    fontSize: "0.75rem"
    lineHeight: "1rem"
rounded:
  md: "6px"
  lg: "8px"
  xl: "12px"
  2xl: "16px"
spacing:
  2: "8px"
  3: "12px"
  4: "16px"
  5: "20px"
  6: "24px"
  8: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "0 16px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
  button-ghost:
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.lg}"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "0 12px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl}"
  badge-accent:
    backgroundColor: "{colors.focus-soft}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: "2px 8px"
---

# Design System: SplitTogether

## Overview

Clean neutral: white and soft grey, charcoal text, a restrained blue accent. Use fewer boxes, light separators, and natural spacing so shared expenses and balances are easy to scan.

This records the implemented active web app, using `web/app/globals.css`, `web/components/ui/`, the app layout, and group workspace as sources. Frontmatter values are normative; update this document and its sidecar when shared styles change.

## Colors

White surfaces sit on a soft grey canvas. Charcoal ink carries primary information; muted and subtle ink carry supporting copy. Light borders separate content; stronger borders identify editable fields.

Blue identifies primary actions, active tabs, navigation, and focus. Positive green and negative red support financial status alongside readable labels. Status badges also use the existing Tailwind emerald, red, and amber variants; those are semantic feedback, not additional brand accents. The badge API’s historical `teal` name now renders the blue accent.

## Typography

Geist Sans is the body family, with Arial and sans-serif fallbacks. The headline role records the mobile group title; it grows to 36px with a 40px line height at the small breakpoint. Section titles use the title role. Body copy and field labels use 14px; supporting timestamps and hints use the caption role. Financial summary figures use tabular numerals where implemented.

## Layout

The signed-in content area is centered with a maximum width of 1440px. Horizontal padding grows from 16px to 24px at 640px, then 32px at 1024px. A fixed 256px sidebar appears at 1024px; smaller screens use a top bar and fixed bottom navigation with safe-area padding. Preserve space below content for that navigation.

Group sections use 20–24px gaps. Overview and balances become two columns at 1280px, with a 0.9:1.1 width ratio. Keep summaries inline and use row dividers for expenses, member balances, and suggested payments. Horizontally overflowing group tabs remain scrollable.

## Elevation & Depth

Cards are flat white surfaces without a default border or shadow. Spacing and subtle separators establish grouping. Dialogs use a dimmed backdrop and the existing large shadow to sit above the page. Entry motion moves content upward by 6px over 240ms only when reduced motion is not requested.

## Shapes

Controls use the rounded-lg token; cards use rounded-xl, and dialog corners use rounded-2xl. Badges use rounded-md. Circular member initials remain distinct from the softly rounded rectangular controls.

## Components

- **Buttons:** Primary blue, bordered white secondary, quiet ghost, and pale red danger variants. Default minimum height is 40px; small is 36px and large is 48px. Keyboard focus has a 2px blue ring with a 2px offset. Disabled buttons fade and ignore pointer interaction.
- **Fields:** White, strongly outlined, full width, at least 44px tall. Focus changes the border to blue and adds a soft blue ring. Disabled fields use the muted surface. Keep visible labels and textual error messages.
- **Cards:** Use a surface for a meaningful section, with 20px padding growing to 24px on small screens. Header and content padding join with reduced vertical spacing. Avoid adding a card around every row.
- **Badges:** Compact text labels with neutral or semantic fills. Preserve accompanying words so meaning does not depend on color.
- **Navigation:** Active links have blue text on a muted grey background. Desktop links are horizontal; mobile links stack an icon and a smaller label. Group tabs use a blue underline rather than a filled pill.
- **Dialogs:** Bottom sheets on mobile, centered panels from 640px upward, maximum width `min(92vw,680px)` and maximum height `92dvh`. Keep scrolling inside the panel and a visible close control.

## Do's and Don'ts

- Do use shared components and semantic CSS variables.
- Do separate related rows with light dividers and spacing.
- Do keep blue for actions, active navigation, and focus.
- Do preserve visible keyboard focus and reduced-motion behavior.
- Don’t wrap every item in another bordered card.
- Don’t introduce large dark panels or decorative accent backgrounds into this neutral direction.
- Don’t use color alone to explain a balance or error.
