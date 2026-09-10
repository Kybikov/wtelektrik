---
name: Elektrik
description: A quiet Ukrainian-language workspace for electrical opportunities in Germany.
colors:
  paper: "#f5f6ef"
  ink: "#203829"
  green: "#173e33"
  lime: "#d5ef8b"
  secondary: "#64725d"
  line: "#d4dccb"
  surface: "#ffffff"
typography:
  display:
    fontFamily: "Manrope Variable, Arial, sans-serif"
    fontSize: "clamp(36px, 4.2vw, 58px)"
    fontWeight: 600
    lineHeight: 1.06
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Manrope Variable, Arial, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Manrope Variable, Arial, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.35
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Manrope Variable, Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  control:
    fontFamily: "Manrope Variable, Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  control: "5px"
  action: "6px"
  panel: "7px"
spacing:
  tight: "8px"
  compact: "12px"
  regular: "16px"
  section: "24px"
  wide: "28px"
  desktop-gap: "36px"
components:
  button-primary:
    backgroundColor: "{colors.green}"
    textColor: "{colors.surface}"
    typography: "{typography.control}"
    rounded: "{rounded.action}"
    padding: "12px 19px"
  button-text:
    padding: "8px 0"
  chip:
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "8px 15px"
  chip-selected:
    backgroundColor: "{colors.green}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
  opportunity:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "22px 20px 17px"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
  navigation-active:
    rounded: "{rounded.action}"
    textColor: "{colors.surface}"
---

# Design System: Elektrik

## Overview

**Creative North Star: "Regional transport departure board"**

The built interface borrows a departure board's ordered scanning and explicit state. Forest-green navigation frames a warm, pale reading field; opportunity titles lead, followed by organization and compact metadata. The world is expressed through typography, alignment, rules and selection states, without literal station scenery.

This is a restrained private tool with Ukrainian interface copy and original German opportunity names. Its repeated visual language is practical: small-radius controls, fine borders, white reading surfaces and clear text actions. The build uses green for primary actions; lime is a small identity accent, a narrower role than the direction contract's proposed action accent.

**Key Characteristics:**

- Forest-green structure with warm paper and white reading surfaces.
- One Manrope family, strongly differentiated by size and weight.
- Title-first opportunity rows with wrapping metadata.
- Persistent desktop filters and inline mobile filters.
- Quiet surfaces with visible selected, saved and loading states.

Recorded from `src/tokens.css`, `src/styles.css`, `src/App.tsx` and the font import in `src/main.tsx`. The direction contract supplies the named world; shipped source supplies the rules and values.

## Colors

The palette combines deep botanical greens with pale yellow-green neutrals.

### Primary

- **Forest green** (`green`): navigation background, primary buttons, selected category controls, links and saved-state icons.
- **Lime** (`lime`): the small brand mark accent. It is not the current primary-button fill.

### Neutral

- **Warm paper** (`paper`): the page canvas.
- **Green ink** (`ink`): primary reading text.
- **Sage text** (`secondary`): explanatory prose and metadata.
- **Sage rule** (`line`): section dividers and shared container boundaries.
- **White surface** (`surface`): opportunity cards, input surfaces and inverse text on green.

Semantic states additionally use muted amber for partial/error source runs and red for error copy. These contextual literals are documented with their component behavior, not promoted into a broad second accent palette.

**The Selection Contrast Rule.** Selected category controls pair a forest-green fill with white text; mobile navigation uses dark green on a pale green fill.

## Typography

**Display and Body Font:** Manrope Variable, with Arial and sans-serif fallbacks. The bundled variable font is imported from `@fontsource-variable/manrope`.

**Character:** A single clear sans-serif gives Ukrainian and German copy a shared rhythm. Large headings use tight tracking; readable descriptions retain normal tracking and more generous leading.

### Hierarchy

- **Display:** the frontmatter display role is the global heading baseline. Search headings become (40px) on phones; secondary page titles use (42px) on desktop and (35px) on phones.
- **Headline:** section and guide headings use the headline baseline, with contextual sizes around (18–21px).
- **Title:** opportunity titles use the title role; below the intermediate breakpoint they become (18px), with phone leading (1.4).
- **Body:** the body baseline becomes (14px) on phones. Explanatory text commonly uses (13px) with leading (1.7–1.8); expanded descriptions have a maximum measure of (72ch).
- **Control:** buttons and chips commonly use the control role. Form labels and metadata use smaller contextual sizes, rather than a second typeface.
- **Numbers:** result counts, pagination and source statistics use tabular figures.

**The Title First Rule.** Opportunity titles are the strongest element inside each result; category, organization, place and dates remain supporting information.

## Layout

The desktop content container is centered with a maximum width of (1240px). Its usual horizontal padding is (32px), reduced to (28px) at (1050px) and (18px) at (720px). At widths of (1440px) and above, the main container loses internal padding and the topbar aligns to the same content boundary.

Search uses a full-width field and a horizontally scrollable category strip. The desktop workspace pairs a (250px) filter column with a flexible results column and a (36px) gap. At the intermediate breakpoint, those values become (225px) and (25px). On phones the workspace is one column; filters expand inline above results.

Guide sections use ruled rows with label and description columns that stack on phones. Source rows similarly collapse from a horizontal summary/status arrangement to a vertical one. Metadata wraps, and long opportunity titles may break anywhere to preserve the layout.

Desktop navigation lives in the topbar. At (720px) and below it is replaced with fixed bottom navigation that includes the device safe-area inset. Footer spacing accommodates that navigation, and toasts move above it.

The spacing vocabulary is a compact family of repeated gaps and paddings, not a strict mathematical scale. Use the frontmatter steps where they fit an existing pattern; preserve the tighter rhythm inside result rows.

## Elevation & Depth

Most surfaces use tonal separation and one-pixel borders. Opportunity rows stay flat, with border color changing on hover. The search field has a nearly invisible ambient shadow (`0 4px 12px #203c2905`); the floating toast has the stronger overlay shadow (`0 6px 24px #162e2526`). These are contextual treatments, not a general card shadow ladder.

**The Quiet Results Rule.** Result rows communicate interaction through border and text changes, while their content remains still.

Entry motion is limited to a small introductory element using AnimatedContent with distance (12) and duration (0.5s). Loading skeletons pulse and collection indicators rotate with (1.5s) cycles. Reduced-motion preferences disable CSS animations and transitions, restore immediate scrolling, and bypass the introductory animation.

## Shapes

Controls use modest rounded corners: the shared control, action and panel radii are recorded in frontmatter. The search field has its own (8px) radius. Fine strokes define fields, filters, cards and dividers. Circles belong to status dots and the territory illustration, rather than the general control silhouette.

Lucide icons are outlined SVGs with restrained sizing. They supplement labels, express actions such as saving, and identify metadata; they are not substitute type glyphs.

## Components

### Buttons

Primary actions are compact solid-green rectangles, with a minimum height of (45px); hover uses `#285441`. Disabled controls use opacity (0.55). Text actions are unfilled and gain an underline and darker text on hover. All interactive elements receive a visible (3px) green focus outline with a (3px) offset.

### Chips

Category controls and guide tabs share bordered, lightly rounded forms. Unselected controls are transparent with a fine sage border; hover adds a pale fill (`#e6eadf`). Selected controls use the Selection Contrast Rule. The strip scrolls horizontally when it cannot fit.

### Cards / Containers

Opportunity rows use a white surface, panel radius and a thin border (`#d9dfd2`), changing to `#99ac8f` on hover. Their title link is followed by organization, wrapped metadata, optional salary and a ruled source/action footer. Phone padding contracts to (17px 14px 12px). Empty and loading surfaces share the panel shape.

### Inputs / Fields

Search is a white bordered container with an unbordered inner text input and an adjacent mobile filter action. Sidebar selects and location fields use white surfaces, control corners and a minimum height of (44px). Phone filter fields use (16px) input text. Labels remain outside fields; focus uses the shared visible outline.

### Navigation

Desktop items are muted pale text on the forest-green topbar; the active item uses `#315747` and white text. Mobile navigation pairs an SVG with a short label; the active item has pale green fill (`#e6eed9`), green text and a heavier icon stroke. Current-page state is exposed with `aria-current`.

### Saving and Details

Bookmark buttons stay beside the title area and toggle `aria-pressed`; a saved item combines green icon color, filled SVG and pale-green background (`#e9f2d8`). Details expand in place below the source row, with `aria-expanded` reflecting state. The source link remains available inside the expansion.

### Status and Feedback

Result counts have a small pale-green backing and tabular numerals. Collection/source status combines text with muted colors; provider errors are explicit. Empty and error panels pair a short explanation with a concrete action. Toasts are compact green overlays with white text and a close button.

## Do's and Don'ts

### Do:

- **Do** keep opportunity titles dominant and supporting metadata grouped beneath them.
- **Do** use the shared green, paper and white palette before introducing contextual colors.
- **Do** retain visible focus, selected and saved states with semantic attributes.
- **Do** allow long German titles and metadata to wrap on phones.
- **Do** keep source and date meaning explicit, including unknown values.

### Don't:

- **Don't** make every result a raised or animated surface.
- **Don't** encode selection, saved state or source health with color alone.
- **Don't** turn the departure-board metaphor into unrelated station decoration.

Not canonized: the build's smallest mobile dates, footer/source labels and context copy (9–10px) are recorded as a legibility limitation, not a reusable type-scale recommendation. Isolated decorative dimensions and unused selectors are also excluded from the normative token set.
