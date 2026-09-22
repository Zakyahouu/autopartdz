<role>
You are an expert frontend engineer, UI/UX designer, visual design specialist, and typography expert. Your goal is to help the user integrate a design system into an existing codebase in a way that is visually consistent, maintainable, and idiomatic to their tech stack.

Before proposing or writing any code, first build a clear mental model of the current system:
- Identify the tech stack (e.g. plain HTML/CSS, React, Next.js, Vue, Tailwind, etc.).
- Understand the existing design tokens (colors, spacing, typography, radii, shadows), global styles, and utility patterns.
- Review the current component architecture and naming conventions.
- Note any constraints (RTL/Arabic-first layout, legacy CSS, performance or bundle-size considerations).

Ask the user focused questions to understand their goals. Do they want:
- a specific component or page redesigned in this style,
- existing components refactored to match this system, or
- new pages/features built entirely in this style?

Once you understand the context and scope, do the following:
- Propose a concise implementation plan that follows best practices, prioritizing:
  - centralizing design tokens,
  - reusability and composability of components,
  - minimizing duplication and one-off styles,
  - long-term maintainability and clear naming.
- When writing code, match the user's existing patterns (folder structure, naming, styling approach, and component patterns).
- Explain your reasoning briefly as you go, so the user understands *why* you're making certain architectural or design choices.

Always aim to:
- Preserve or improve accessibility.
- Maintain visual consistency with the provided design system.
- Leave the codebase in a cleaner, more coherent state than you found it.
- Ensure layouts are responsive, usable across devices, and correct in RTL contexts.
- Make deliberate, creative design choices (layout, motion, interaction details, and typography) that express the design system's personality instead of producing a generic or boilerplate UI.

</role>

<design-system>
# Design Style: Dossier

## Design Philosophy

### Core Principle

**Bureaucratic warmth through the physical language of paper.** This design system draws its identity from the customs folder, the manila dossier, the rubber ink stamp, and the carbon-copy triplicate form. It treats the interface not as a screen but as a stack of physical paperwork — tactile, official, slightly imperfect, and trustworthy in the way a stamped document is trustworthy.

Every element borrows from paper-world conventions: dashed cut-lines, hard offset "stacked sheet" shadows, tilted stamps, double-ruled borders, monospace tracking codes. This isn't decoration for its own sake — it's a metaphor. The product manages physical import documents, so the interface itself behaves like a folder of documents.

### The Visual Vibe

**Official. Tactile. Warm. Procedural.**

Imagine a customs office desk: a manila folder tied with string, a red ink stamp still slightly wet, a form with a tear-off tracking stub, everything on cream paper under warm light. Nothing is glossy or synthetic. The interface feels handled, administrative, and dependable — like something a clerk would file and retrieve without ever losing.

**Emotional Keywords:**
- *Official* — Ink-navy text, stamped codes, and ruled dividers signal a process you can trust with paperwork.
- *Tactile* — Paper-grain texture, hard offset shadows, and rotated elements make the UI feel physically stacked rather than flat.
- *Warm* — Parchment and manila tones replace clinical white, keeping the bureaucratic tone from feeling cold.
- *Procedural* — Numbered steps, status pills, and tracking codes reflect a system built around a real, trackable workflow.
- *Grounded* — Slight rotations and hand-stamped touches keep the precision from feeling sterile or overly corporate.

**What This Design Is NOT:**
- Not sleek/glossy SaaS (no gradients-as-decoration, no glassmorphism)
- Not sterile or corporate-cold (the manila/parchment palette keeps it human)
- Not minimal-for-minimalism's-sake (rules, stamps, and tabs carry real information)
- Not playful/cartoonish (the stamp and tilt are restrained, not whimsical)
- Not Latin-first (this system is built RTL-first, for Arabic content)

### The DNA of This Style

#### 1. The Signature Type Pairing

**Reem Kufi** (display) paired with **IBM Plex Sans Arabic** (body) anchors the whole system. Reem Kufi's geometric, slightly condensed Kufic forms read as official/stamped at large sizes — headlines, dossier labels, step numerals, legend text. IBM Plex Sans Arabic carries paragraphs and form fields with clean, highly legible density at 17px+ with generous 1.8 line-height.

**Where the display face appears:** h1–h3, the dossier tab label, step-number badges, form `legend` elements, FAQ question text, the logo mark.

#### 2. The Parchment Palette

Color is warm and paper-derived, never pure white or pure black:

- **Page (#efe6d0)** — Warm parchment canvas, the "desk" the whole page sits on
- **Page-2 (#e6dabc)** — A slightly deeper parchment for alternating sections
- **Manila (#dcc590)** — Folder-tan, used for the dossier motif and secondary cards
- **Card (#f8f2e2)** — Lightest paper tone, for elevated surfaces (forms, results)
- **Ink (#16233f)** — Deep navy-black, the "fountain pen" primary text and border color
- **Ink-2 (#465170)** — Softer navy-gray for secondary text
- **Stamp (#a8231b)** — Rubber-stamp red, the single hot accent for tracking codes, kickers, required marks, and emphasis
- **Ok (#1e6a44)** — Forest green for "local" document provenance
- **China (#3a5e8c)** — Steel blue for "from China" document provenance

The red stamp accent is used exactly like actual ink stamps are: sparingly, for things that matter (tracking codes, the kicker, errors, active states) — never as a general UI color.

#### 3. The Dossier / Manila-Folder Motif

A literal folder-tab-and-body shape (`.dossier-tab` + `.dossier-body`) is the hero's signature visual: a tab peeking above a manila folder body, rotated a few degrees off-axis, listing document line items with animated status reveals. This motif recurs throughout — form cards, result cards, and tracking results all reuse the same "folder" silhouette (asymmetric border-radius: sharp on one top corner, rounded elsewhere) rather than a generic rounded rectangle.

#### 4. The Rubber-Stamp Accent

Tracking codes, order numbers, and the kicker/eyebrow text are treated as if physically stamped: monospace lettering, a double-border box, a slight rotation (`-2deg` to `-8deg`), and the stamp-red color. Step-number badges are literal rotated circular "stamps" with a colored ring border instead of a filled background.

#### 5. Hard Offset "Stacked Paper" Shadows

Instead of soft blurred shadows, this system uses **hard-edged offset shadows** (e.g. `-8px 8px 0 var(--shadow)`, `-4px 4px 0 var(--stamp)`) with zero blur. This is a print/paper-stack effect — it reads as one sheet sitting slightly askew on top of another, not as elevation via light and shadow. Solid buttons and elevated cards/folders all use this technique; it collapses toward `0,0` on `:active` to simulate a physical press.

#### 6. The Dashed Rule System

Dashed (not solid) horizontal and vertical rules — in the soft `--line` navy — divide list items, lane steps, and document lines. Dashed rules read as "cut here" / tear-perforation lines, reinforcing the paper-document metaphor, while solid 1.5–2px `--ink` borders are reserved for structural boundaries (section edges, card frames, the header).

#### 7. RTL-First Officialdom

The entire system is authored `dir="rtl"` for Arabic. Logical CSS properties (`inset-inline-start`, `border-inline-start`, `padding-inline-start`) are used throughout rather than physical left/right, so the same tokens and components would mirror correctly if ever shipped LTR. Tracking codes and phone numbers are the deliberate exception: they're pinned `direction:ltr` inside the RTL flow, matching how such codes are conventionally written even in Arabic documents.

### Differentiation: Bureaucracy With Warmth

Most "official/process" interfaces (government portals, logistics trackers) default to cold, generic blue-and-white corporate UI. This design proves procedural trust doesn't require sterility. The parchment palette, hand-stamped rotation, and folder motif give the same trackable, auditable feeling real paperwork gives — without feeling like a DMV website.

**The dossier motif and stamp accent are the key differentiators.** They bring:
- Procedural credibility without cold minimalism
- Warmth through material metaphor (paper, ink) rather than color
- A memorable, non-generic identity for a "boring" document-tracking domain
- Timelessness rooted in physical paperwork conventions rather than current UI trends

### Sensory Description

If this design were a physical space, it would be:
- A customs clearance office with wooden pigeonhole shelving
- Manila folders tied with red string, stacked slightly askew
- A worn wooden stamp with a faded red ink pad beside it
- Afternoon light through dusty blinds across a paper-strewn desk
- The smell of aging paper, carbon copy ink, and coffee

If it were music, it would be:
- A slow oud or qanun instrumental, unhurried and grounded
- The rhythmic thud of a rubber stamp punctuating quiet
- Paper shuffling between silences
- Something you'd hear in the waiting room of a well-run government office
- Procedural, patient, quietly reassuring

---

## Design Token System (The DNA)

### Color Strategy

**Parchment With a Single Hot Accent:** A warm, paper-derived neutral palette carries the whole interface; stamp-red is the only saturated color, reserved for meaning (tracking, emphasis, required, error). Provenance tags add two muted functional colors (green/blue) strictly for local-vs-China document sourcing.

| Token | Value (light) | Value (dark) | Usage & Context |
|:------|:---------------|:---------------|:-----------------|
| `page` | `#efe6d0` | `#0f1729` | Primary canvas. Warm parchment; deep navy paper in dark mode. |
| `page-2` | `#e6dabc` | `#0b1221` | Alternating section background. |
| `manila` | `#dcc590` | `#5d5236` | Folder-tan surfaces — the dossier motif, type-picker cards. |
| `card` | `#f8f2e2` | `#18233d` | Lightest paper — form cards, results, elevated content. |
| `ink` | `#16233f` | `#eee5cf` | Primary text and structural borders. Deep navy, not black. |
| `ink-2` | `#465170` | `#b7b09b` | Secondary text, muted labels, inactive step numerals. |
| `stamp` | `#a8231b` | `#ea6b60` | The single accent. Tracking codes, kicker, required marks, focus, errors. |
| `line` | `rgba(22,35,63,.28)` | `rgba(238,229,207,.3)` | Dashed rules and dividers. |
| `shadow` | `rgba(22,35,63,.22)` | `rgba(0,0,0,.45)` | Hard offset "stacked paper" shadows. |
| `ok` | `#1e6a44` | `#5ec48f` | "Local" document provenance tag/lane. |
| `china` | `#3a5e8c` | `#7fa8d6` | "From China" document provenance tag/lane. |

A subtle SVG fractal-noise texture overlay sits behind `body` at low opacity, giving every surface a faint paper-grain tooth rather than a flat digital fill.

---

### Typography System

**Font Pairing (Arabic Editorial-Bureaucratic System):**
- **Display/Headlines:** `"Reem Kufi", "Noto Kufi Arabic", Tahoma, sans-serif` — Geometric Kufic display face for all headings, the dossier tab, step numerals, legends, and the logo mark.
- **Body/UI:** `"IBM Plex Sans Arabic", "Segoe UI", Tahoma, sans-serif` — Clean, highly legible Arabic text face for paragraphs, nav, labels, and form fields.
- **Monospace (codes only):** `ui-monospace, Menlo, Consolas, monospace` — Reserved exclusively for tracking codes and order numbers, always set `direction:ltr` with `letter-spacing:.05em–.06em`.

**Type Scale & Usage:**

| Element | Size | Font | Weight | Notes |
|:--------|:-----|:-----|:-------|:------|
| Hero Headline | `clamp(2.25rem, 6vw, 3.9rem)` | Reem Kufi | 700 | Leading 1.22, max-width `15ch`. |
| Section Headlines | `clamp(1.85rem, 4.4vw, 2.6rem)` | Reem Kufi | 700 | Leading 1.3, max-width `20ch`. |
| Card / Legend Titles | `1.2–1.3rem` | Reem Kufi | 700 | Form legends, lane headings, FAQ questions. |
| Body Text | `17px` base | IBM Plex Sans Arabic | 400 | Relaxed line-height `1.8`. |
| Kicker / Eyebrow | `.95rem` | IBM Plex Sans Arabic | 600 | Dashed-border pill, stamp-red text. |
| Tracking Code | `.85–2.1rem` (context-dependent) | Monospace | 700 | Always LTR, tracked, stamp-red, slight rotation on the "done" display. |
| Nav / Labels | `.9–.95rem` | IBM Plex Sans Arabic | 500–600 | Slight structure via borders rather than letter-spacing. |

Note: unlike Latin-script "editorial" systems, this style does **not** use small-caps or heavy letter-tracking for labels — Arabic script doesn't take small-caps, so hierarchy is carried instead by the Reem Kufi/Plex Sans pairing, dashed kicker borders, and color.

---

### Spacing & Layout

**Core Principle:** Desk-like density, not gallery whitespace. This is a working document tool, not a luxury editorial page — spacing is comfortable but purposeful, never cavernous.

- **Section Spacing:** Moderate vertical padding (`padding-block: 66px–70px`; hero `52px 60px`) — enough to separate procedural sections without feeling ceremonial.
- **Container Width:** `min(1120px, 100% - 40px)` — wider than a reading column, appropriate for forms and multi-column steps.
- **Component Density:** Form cards use `22px 20px` to `28px 30px` padding; folder/dossier bodies use `18px 20px 22px`.
- **Grid Gaps:** `14px–44px` depending on context (hero grid at `44px`, lane grid at `22px`, step columns at `34px`).

**Layout Patterns:**
- Hero: asymmetric two-column (`1.08fr .92fr`) — copy beside the rotated dossier illustration, stacking to one column under 960px.
- Pain points: 3-column with dashed dividers between items (dashed border, not gap-based spacing).
- Lifecycle lanes: 2-column "local vs. China" comparison, each a bordered folder-shaped card with a numbered dashed list.
- Steps: 3-column numbered grid with rotated stamp-circle numerals and dashed top rules.
- Order form: asymmetric `.8fr 1.2fr` aside-note + form-card split.

---

### Borders, Surfaces & Shadows

**Surfaces:**
- Structural borders are **solid, 1.5–2px, in `--ink`** — never a soft neutral gray. This is what gives the whole system its "ruled ledger" crispness.
- Card/folder radius is deliberately **asymmetric**: one sharp top corner paired with rounded others (`6px 14px 8px 8px`, or `border-start-start-radius:0` on the dossier body under its tab) — this is what reads as a tabbed folder rather than a generic card.
- Dividers between list/lane items are **dashed, 1–1.5px, in `--line`** — reserved for content separation, distinct from structural solid borders.

**Border System:**
| Token | Value | Usage |
|:------|:------|:------|
| `border-structural` | `2px solid var(--ink)` | Card/section/header frames, form-card borders |
| `border-accent-active` | `2px solid var(--stamp)` | Active/selected state (selected doc line, focused type-card) |
| `border-dashed` | `1–1.5px dashed var(--line)` | List/lane item separators, kicker box, pain-item dividers |

**Shadow System (hard offset, zero blur — the signature technique):**
| Token | Value | Usage |
|:------|:------|:------|
| `shadow-stamp` | `-4px 4px 0 var(--stamp)` | Solid/primary buttons |
| `shadow-stamp-active` | `-1px 1px 0 var(--stamp)` | Solid button `:active` (press-down) |
| `shadow-paper` | `-6px 6px 0 var(--shadow)` to `-9px 9px 0 var(--shadow)` | Dossier body, form card, track result box — larger offset = "higher in the stack" |
| `shadow-press` | `translate(-2px, 2px)` on `:active` | Button press feedback, paired with shadow collapse |

No blurred `box-shadow` values appear anywhere in this system — every shadow is a flat, hard-edged offset duplicate of the shape it sits behind.

---

## Component Styling & Interactions

### Buttons

**Solid (Primary) Button:**
- Background: `ink`, text: `page` (inverted, not accent-colored)
- Border: `2px solid var(--ink)`, radius `8px`
- Shadow: hard offset `-4px 4px 0 var(--stamp)` — the button visually "sits on" a red stamp-colored card beneath it
- Active: shadow collapses to `-1px 1px 0`, button translates `(-2px, 2px)` — a physical press into the stamp shadow
- Minimum height: 48px (40px for `.btn-small` in the header)

**Outline (Default) Button:**
- Background: transparent, border `2px solid var(--ink)`, text `ink`
- No shadow — sits visually "flatter" than the solid button
- Same press-translate on active for consistency

**Ghost / Text Link:**
- No border or background; underline on hover with generous `text-underline-offset: 6px`

**Animation:** No color-fade transitions — the interaction language is entirely physical (press/offset), not chromatic, matching the paper metaphor.

---

### Cards & The Dossier Motif

**Form / Result Card:**
- Background `card`, border `2px solid var(--ink)`, asymmetric radius `6px 14px 8px 8px`
- Hard offset shadow `-8px 8px 0 var(--shadow)`
- Internal step indicator (`.pips`): a bordered pill-row where the active step inverts to `ink` background / `page` text, and completed steps turn `ok` green

**Dossier Illustration (hero motif):**
- A tab (`manila`, bordered, radius on top corners only) sits above a folder body (`manila`, sharp top-inline-start corner, rounded elsewhere), both `2px solid ink`
- Rotated `1.6deg` off-axis as a whole unit
- Interior document lines fade in sequentially (staggered `animation-delay`) to suggest a live status feed, respecting `prefers-reduced-motion`

**Type-Picker / Selection Card:**
- Manila background by default; on selection (`aria-pressed="true"`), background shifts to `card`, border to `stamp`, and the hard paper shadow appears — selection is communicated by "lifting off the stack," not by color fill alone

**Provenance Tags:**
- Small bordered pills using `currentColor` for both border and text — `ok` green for local documents, `china` blue for Chinese-sourced documents — kept deliberately minimal (no fill) so they read as annotations, not buttons

---

### Inputs

- Height: `min-height:48px`, border `2px solid var(--ink-2)` (not full ink weight — inputs sit a step quieter than structural borders), radius `6px`
- Background: `page` (matches canvas, not white) — inputs look like blank lines on the same paper as the page
- Focus: border shifts to `stamp`, plus a soft `3px` stamp-tinted glow (`box-shadow: 0 0 0 3px color-mix(stamp 25%, transparent)`) — the only place a soft/blurred shadow appears in the whole system, deliberately, as a focus affordance
- Codes/phone fields get `.ltr` treatment (LTR direction, text stays right-aligned in the RTL form)
- Document-selection lines (`.docline`) and correction-lookup lines share a matching pattern: unselected = `ink-2` border; selected = `stamp` border + a 6%-opacity stamp tint background

---

### Kicker / Eyebrow Label

The signature small label pattern used above the hero headline:
```html
<span class="kicker">وثائق السيارات المستوردة من الصين</span>
```
```css
.kicker{
  display:inline-block;
  padding:2px 14px;
  border:1.5px dashed var(--stamp);
  color:var(--stamp);
  font-weight:600;
  font-size:.95rem;
}
```
A dashed border in the accent color, not a solid pill — reinforcing the "cut-here" paper language even in the smallest UI element.

---

## The "Bold Factor" (Signature Elements)

These elements prevent generic output and define this style:

1. **The Dossier/Folder Silhouette:** Asymmetric border-radius (sharp corner + rounded corners) used consistently across the hero illustration, form cards, and result panels — never a plain rounded rectangle.

2. **Hard Offset Shadows, Zero Blur:** Every elevated surface uses a flat directional duplicate shadow (`-Npx Npx 0 color`), not a soft blur — the system's single most distinctive technical signature.

3. **Rubber-Stamp Rotation:** Tracking codes, step-number badges, and the hero dossier are all rotated a few degrees off true — nothing in this system sits perfectly axis-aligned.

4. **Single Hot Accent, Used Sparingly:** Stamp-red appears only for tracking codes, kickers, active/selected states, required marks, and errors — never as decoration.

5. **Dashed "Perforation" Rules:** Dashed dividers (never solid) separate list content throughout — lane steps, document lines, pain-item columns, FAQ borders use solid `ink` only at true structural boundaries.

6. **Monospace Codes, Pinned LTR:** Any tracking/order code breaks from the Arabic body flow into monospace + LTR direction, exactly as such codes are handled in real paperwork.

7. **Physical Press Feedback:** Buttons translate and their shadow collapses on `:active` — interaction feedback is spatial/physical, not color-based.

8. **Provenance Color-Coding:** A consistent two-color system (green=local, blue=China) recurs identically across tags, lane headers, and dossier line items, giving the whole document lifecycle a legible thread.

9. **Paper-Grain Texture:** A faint fractal-noise SVG overlay across the whole page body — subtle enough to be nearly subliminal, present enough to keep surfaces from feeling like flat digital fills.

10. **Staggered Status Reveal:** Hero dossier line statuses fade in on a staggered delay, simulating a live-updating folder rather than a static illustration.

---

## Effects & Animation

**Motion Philosophy:** Physical, not chromatic. Motion simulates paper and stamps being handled — pressing, settling, revealing — rather than modern UI easing/fading conventions.

**Interaction States:**
- Button press: `translate(-2px, 2px)` + shadow collapse, no color change
- Selection state: shadow/border appears (object "lifts off the stack"), not a color fade
- Status lines: opacity fade-in only, staggered by index (`calc(var(--i)*.6s + .8s)`)
- `prefers-reduced-motion: reduce` disables the staggered fade — content is simply visible immediately

**No easing curves, no scale transforms, no soft shadow transitions** — this restraint is intentional and central to the style's tactile, non-"modern SaaS" identity.

---

## Responsive Strategy

**Breakpoint Philosophy:** RTL structure and the folder/dossier motif are preserved at every size; multi-column layouts collapse to single-column stacks, and dashed dividers rotate from vertical (`border-inline-start`) to horizontal (`border-top`) as columns stack.

### Mobile Adaptations (< 820–960px)

- **Hero:** Single column; dossier illustration stacks below the copy, still rotated and shadowed.
- **Lanes / Pain items / Steps:** Collapse from 2–3 columns to a single column; dashed inline-dividers become dashed top-borders between stacked items.
- **Order form:** Aside note stacks above the form card instead of sitting beside it.
- **Track form:** Collapses from a 3-column inline row to a stacked column.
- **Nav:** Desktop nav links hide under 820px; the solid "start order" CTA stays visible in the sticky header at all sizes.
- **Floating WhatsApp CTA:** Text label hides under 480px, icon-only pill remains, positioned above the safe-area inset.

### Touch Optimization

- All buttons and inputs maintain a 48px minimum height
- The sticky header respects `env(safe-area-inset-top)`; the floating WhatsApp button respects `env(safe-area-inset-bottom)`
- Focus rings (`3px solid var(--stamp)`, `outline-offset:3px`) are visible and consistent across all interactive elements for keyboard use

---

## Accessibility & Best Practices

**Color Contrast:**
- Ink navy (`#16233f`) on parchment (`#efe6d0`) provides strong contrast in light mode; the dark-mode palette mirrors this relationship with light ink-cream on deep navy
- Stamp red is checked against both `card` and `page` backgrounds wherever it carries text (codes, kicker, errors)

**Focus States:**
- Uniform `outline: 3px solid var(--stamp); outline-offset: 3px` via `:focus-visible` across the entire system — no per-component focus-style drift
- Form inputs add a secondary stamp-tinted glow on focus for redundant, non-color-only feedback

**Motion:**
- All decorative animation (dossier status fade-in) is wrapped in a `prefers-reduced-motion` check and disabled cleanly, with content defaulting to fully visible

**Semantic HTML & RTL:**
- `dir="rtl"` set at the document root; logical CSS properties (`inset-inline-start`, `border-inline-start`, `padding-inline-start`) used throughout instead of physical left/right so the system stays mirror-correct
- Proper heading hierarchy, native `<button>`/`<form>`/`<fieldset>`/`<legend>` elements for all interactive and grouped form content
- `role="radiogroup"` and `aria-pressed` used for the custom type-picker buttons; `aria-current="step"` for the step-pip indicator
- Tracking codes and phone numbers are the one deliberate exception to RTL flow (`direction:ltr` inline), matching real-world Arabic-document convention

**Performance:**
- All shadows are flat/hard (no blur), which is cheap to render
- CSS custom properties drive the entire palette, including a dark-mode variant switched via `prefers-color-scheme` and an explicit `data-theme` override
- The paper-grain texture is a tiny inline SVG data-URI, not an image request

---

## Language & Locale Strategy

Three surfaces, three sets of rules. Both tiers share the same design tokens — locale and tier are independent axes.

### Surface rules

| Surface | Language(s) | Direction | Switcher |
|:--------|:------------|:----------|:---------|
| **Client-facing** (landing, demand form, tracking lookup) | Arabic (default), French, English | RTL when Arabic active; LTR for French/English | Visible language picker |
| **Admin panel** | English only | LTR | None |
| **China-associate portal** | English only | LTR | None |

### Typography for LTR surfaces

Reem Kufi and IBM Plex Sans Arabic are Arabic-script faces and do not apply to LTR surfaces.

- **Body (all LTR surfaces):** `"IBM Plex Sans", "Segoe UI", system-ui, sans-serif` — the Latin sibling of IBM Plex Sans Arabic, preserving typeface consistency across the brand.
- **Display/Headlines (LTR client pages only):** `"DM Sans", "IBM Plex Sans", system-ui, sans-serif` at weights 700 + 500. DM Sans is a geometric sans with the same rational, official density as Reem Kufi at headline sizes — slightly condensed at heavy weight, reads as typeset rather than decorative. Space Grotesk was evaluated but its ink traps tip toward personality-first; DM Sans stays authoritative and neutral, better suited to document-administration context.
- **Console-tier surfaces (Admin, China portal):** No display face. IBM Plex Sans alone at multiple weights (400, 500, 600, 700) is sufficient — these are dense working screens where display flourish adds noise, not warmth.
- **Monospace (all surfaces):** Reserved for tracking codes and order numbers, always `direction:ltr`, as documented.

### i18n implementation

- Client-facing surface: `react-i18next` for the three locales. All client-facing UI strings live in locale files from the start — no inline literals.
- Admin and China portals: single-language (English). Strings live in a `src/constants/strings.js` file rather than scattered inline, for maintainability. No i18n library needed.

---

## Two-Tier Styling System

Both tiers share the same design tokens (colors, the ink/stamp palette, dashed-rule and solid-border logic). This is **one design system with two expression modes**, not two separate systems.

### Moment Tier

**Applies to:** The client-facing site's hero, the demand form, the tracking-code reveal, and order confirmation.

Full Dossier expression as documented above: rotation, hard offset stacked-paper shadows, the dossier/folder asymmetric-radius motif, staggered status reveals, stamp treatment on codes. No changes — this tier is fully specified in the sections above.

### Console Tier

**Applies to:** The Admin panel and the China-associate portal in their entirety — catalog tables, CRUD forms, order queues, document review screens.

These are dense, high-frequency working screens (scanned dozens of times a day). Moment-tier flourish becomes noise rather than warmth here.

**Console-tier constraints:**

| Rule | Detail |
|:-----|:-------|
| No rotation | Zero `transform: rotate()` on any element, anywhere |
| No stacked shadows on routine surfaces | No `shadow-paper` on table rows, list items, or standard form panels. Reserve for at most **one** focal element per screen (e.g. a modal/drawer) |
| Dashed row dividers | `1–1.5px dashed var(--line)` between rows/items; `2px solid var(--ink)` for the table/panel frame |
| Tighter spacing | ~35% tighter padding than Moment tier; 48px minimum touch target preserved |
| Simplified card shape | `border: 1.5–2px solid var(--ink)`, uniform `border-radius: 4–6px` — same material as Moment tier, no asymmetric folder-tab motif |
| Button shadow rules | Primary actions ("Create", "Confirm", "Save"): full `shadow-stamp` treatment. Secondary/inline actions (row "Edit", active toggles): outline only, no shadow at rest. Physical press (translate + shadow collapse) kept on both for consistency |

### Status & Badge System (Console Tier)

A consistent badge system for order and document-line statuses. Reuses existing tokens where meaning aligns; adds exactly **one** new functional color.

| Status group | States | Badge style |
|:-------------|:-------|:------------|
| **Provenance** | `local`, `china` | Existing `--ok` green / `--china` blue bordered pills — no change |
| **Routine in-progress** | `needed`, `sent_to_china`, `printed`, `arrived_at_office`, `packaged`, `sent_to_client` | `--ink-2` bordered pill, no fill (or very light `--page` tint) — normal progress, no alarm |
| **Needs attention** | `pending_admin_review`, `isDelayed` flag | **`--attention`** ochre bordered pill with light attention-tint background |
| **Problem** | `needs_correction` | `--stamp` red bordered pill — consistent with its documented "errors that matter" role |
| **Terminal success** | `delivered` | `--ok` green solid pill (filled, to mark completion) |

#### New Token: `attention`

**Value:** `#8a6500` (light) / `#d4a84b` (dark)

**Derivation:** Dark golden ochre — derived from oxidised ink, sitting squarely inside the parchment/manila warmth of the existing palette. Passes contrast on both `card` (#f8f2e2) and `page` (#efe6d0) at its dark value. Clearly distinct from `stamp` red in both hue (yellow-orange vs. red) and lightness value, so colorblind users also distinguish the "pause and look" vs. "something broke" meanings. Does not overlap with `ok` green or `china` blue functional meanings. Dark mode `#d4a84b` reads as warm gold against the `#0f1729` navy paper.

**Updated token table:**

| Token | Value (light) | Value (dark) | Usage & Context |
|:------|:---------------|:---------------|:-----------------|
| `page` | `#efe6d0` | `#0f1729` | Primary canvas. |
| `page-2` | `#e6dabc` | `#0b1221` | Alternating section background. |
| `manila` | `#dcc590` | `#5d5236` | Folder-tan surfaces — dossier motif, type-picker cards. |
| `card` | `#f8f2e2` | `#18233d` | Lightest paper — form cards, results, elevated content. |
| `ink` | `#16233f` | `#eee5cf` | Primary text and structural borders. |
| `ink-2` | `#465170` | `#b7b09b` | Secondary text, muted labels. |
| `stamp` | `#a8231b` | `#ea6b60` | Single hot accent — codes, kicker, required, errors, active state. |
| `attention` | `#8a6500` | `#d4a84b` | **NEW.** "Needs attention" — pending review, delayed. |
| `line` | `rgba(22,35,63,.28)` | `rgba(238,229,207,.3)` | Dashed rules and dividers. |
| `shadow` | `rgba(22,35,63,.22)` | `rgba(0,0,0,.45)` | Hard offset stacked-paper shadows. |
| `ok` | `#1e6a44` | `#5ec48f` | Local provenance / terminal success. |
| `china` | `#3a5e8c` | `#7fa8d6` | China-sourced provenance. |

You already have design.md (the "Dossier" system) fully internalized.
This prompt extends it in two ways: (1) a language/locale strategy
across the platform's three surfaces, and (2) a two-tier styling
system, since Dossier as documented is built for high-emotion,
low-frequency moments (hero, tracking reveal) and Phase 2 needs dense,
fast-scanning admin screens using the same visual DNA.

Update design.md to add both sections below, then confirm your
understanding before any component code is written.

## 1. Language & locale strategy

Three surfaces, three language rules:

- CLIENT-FACING (public site: landing page, demand form, tracking
  lookup): supports Arabic, French, and English, with a visible
  language switcher. Arabic is the default/primary locale. When the
  active locale is Arabic, the page is dir="rtl" using Dossier exactly
  as documented (Reem Kufi + IBM Plex Sans Arabic, logical CSS
  properties). When the active locale is French or English, the page
  is dir="ltr".

- ADMIN PANEL: English only, dir="ltr", no language switcher needed.

- CHINA-ASSOCIATE PORTAL: English only, dir="ltr", no language
  switcher needed.

### Typography for LTR surfaces (French/English client pages, and
### both Admin and China portals)

Reem Kufi and IBM Plex Sans Arabic are Arabic-script faces and do not
apply here. Define a Latin-script pairing that preserves the same
personality (geometric, official, "stamped" for display; clean and
dense for body) rather than defaulting to a generic sans stack. Use
IBM Plex Sans (the Latin sibling of IBM Plex Sans Arabic already in
the system) for body text on every LTR surface, for typeface
consistency across the brand. For display/headline use on LTR client
pages, choose a geometric sans with the same official/stamped
character as Reem Kufi (evaluate options such as Space Grotesk or
similar geometric faces) — propose your specific choice with
reasoning before implementing. Console-tier surfaces (Admin, China
portal — see section 2) do not need a display face at all; IBM Plex
Sans alone, at appropriate weights, is sufficient there.

### i18n implementation

Use a standard React i18n library (e.g. react-i18next) for the
client-facing surface's three locales. Keep all client-facing UI
strings in locale files from the start, not hardcoded — Admin and
China portal strings do not need this since they're single-language,
but should still live in a strings/constants file rather than
scattered inline literals, for maintainability.

## 2. Two-tier styling system

Both tiers share the same design tokens (colors, the ink/stamp
palette, dashed-rule and solid-border logic) — this is one design
system with two expression modes, not two separate systems.

### Moment tier
Applies to: the client-facing site's hero, the demand form, the
tracking-code reveal, order confirmation. Full Dossier expression as
already documented in design.md: rotation, hard offset stacked-paper
shadows, the dossier/folder motif, staggered status reveals, stamp
treatment on codes. No changes here — this tier is already fully
specified.

### Console tier
Applies to: the Admin panel and the China-associate portal in their
entirety — catalog tables, CRUD forms, order queues, document review
screens. These are dense, high-frequency working screens (scanned
dozens of times a day), where Moment-tier flourish becomes noise
rather than warmth. Define this tier with the following adjustments:

- NO rotation on any element, anywhere in the console tier.
- NO hard-offset stacked shadows on routine surfaces (table rows,
  list cards, standard form panels). Reserve the shadow-paper effect
  for at most one focal element per screen if genuinely useful (e.g. a
  modal/drawer), never on repeating list items.
- Tables/lists use the same solid 1.5-2px ink borders for structural
  edges and dashed --line dividers between rows, exactly as the
  documented dashed-rule system already does for list items — reuse
  this rather than inventing a new row-divider style.
- Tighter spacing than Moment tier: this is a working tool, not a
  marketing page. Reduce section/component padding roughly 30-40%
  from the documented Moment-tier values, while keeping the 48px
  minimum touch target for inputs/buttons.
- Buttons keep the physical press interaction (translate + shadow
  collapse on :active) since that's cheap and consistent, but skip
  the -4px/4px stamp shadow at rest for secondary/routine actions in
  dense tables (e.g. inline row actions) — reserve the full solid
  stamp-shadow button treatment for primary, infrequent actions (e.g.
  "Create Document Type", "Confirm Order").
- The dossier/folder asymmetric-radius motif is reserved for Moment
  tier only. Console-tier cards/panels use a simpler, still-branded
  shape: solid ink border, small uniform radius (4-6px), no
  asymmetry — reads as "the same material," not "the same flourish."

### Status & badge system (console tier)

The order and document-line lifecycles defined in the platform's data
model have far more states than the two provenance tags (ok=local,
china=from China) the documented palette currently covers. Define a
small, consistent badge system for these statuses, reusing existing
tokens where meaning aligns and adding no more than ONE new functional
color if genuinely needed:

- Provenance (source: local/china): reuse the existing ok/china colors
  exactly as documented — no change.
- Routine in-progress states (needed, sent_to_china, printed, arrived_
  at_office, packaged, sent_to_client): a neutral ink-2-bordered badge,
  unfilled or very lightly tinted — these are normal progress, not
  something demanding attention.
- Needs attention (pending_admin_review, isDelayed flag): should read
  as "look at this" without competing with the stamp-red "needs_
  correction/error" meaning. Propose one new muted functional color
  (e.g. a warm amber/ochre that fits the parchment palette) for this
  specific "awaiting action" meaning, distinct from stamp-red's
  "correction needed/error" meaning — explain your color choice
  against the existing palette before implementing.
- Problem states (needs_correction): use stamp-red, consistent with
  its documented "errors and things that matter" role.
- Terminal success (delivered): use the existing ok green.

Propose the exact hex value and document it in design.md's token
table alongside the existing palette, with the same light/dark mode
treatment the other tokens have.

## Deliverable

Update design.md with both new sections. Do not write any component
or screen code in this step. Once updated, summarize back: your
chosen LTR display typeface and why, your chosen "needs attention"
color and why, and confirm you understand which surfaces get which
tier and which locale rules. Wait for confirmation before Phase 2
functional work begins.