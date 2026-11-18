# Design system ("Xpence night")

Shared look for all personal PWAs. Dark only. Implemented as CSS variables in `starter/src/styles/global.css`; the components in `starter/src/components` and `starter/src/app` already use it. Paste the **Brief block** at the end into every design brief so Claude Design produces matching screens.

## Colour tokens

| Token | Value | Use |
|---|---|---|
| `--bg` | `#1A1F2B` | screen background, manifest `theme_color` / `background_color` |
| `--surface` | `#232A39` | text fields, bottom sheets, dialogs |
| `--surface-2` | `#2A3242` | chips, secondary buttons |
| `--glass` / `--glass-border` | `rgba(35,42,57,.72)` / `rgba(255,255,255,.06)` | cards over the background (with `backdrop-filter: blur(18px)`) |
| `--info-bg` | `#1F2D45` | info notes, active nav pill, icon circles |
| `--disabled-bg` | `#283041` | disabled primary button |
| `--border` / `--border-dashed` | `#343D50` / `#4A5468` | outlines; dashed = "more…" or "scheduled / not yet real" |
| `--text` / `--text-2` / `--muted` / `--faint` | `#E6EAF2` / `#B4BCCA` / `#9AA3B5` / `#6B7488` | primary, secondary, labels, placeholders |
| `--accent` / `--on-accent` | `#3D9BFF` / `#0B1A2E` | primary actions, selection, links, focus ring |
| `--positive` / `--positive-bg` | `#5FD4A0` / `#1D3A35` | money in, better than usual, success |
| `--warn` / `--warn-bg` | `#F2B34B` / `#3A3222` | warnings, trending over, backup overdue |
| `--danger` / `--danger-bg` / `--danger-border` / `--danger-badge-bg` | `#FF8A90` / `#2A2430` / `#5A3038` / `#3A2328` | errors, delete, over |

User-pickable highlight palette (works on the dark background): `#D9606A #F08A5D #E6C860 #A8C66C #4FBF92 #4FB3BF #3D9BFF #8A8CF2 #B07FE0 #DD86CF #C9A27E #9AA3B5`.

**Meaning of colour**, always paired with a word, sign or icon: blue = action/selection, green = money in / good, amber = warning, red = error / delete / over, muted = not enough data.

## Type

- **Inter** for all UI text: 13 px labels, 14–15 px body, 16 px buttons, 18 px sheet titles, 20–22 px screen titles; weight 600 for titles and buttons.
- **Space Grotesk** for amounts and figures, `font-variant-numeric: tabular-nums`. Hero number 48 px / 700 / line-height 56 / letter-spacing −1.5 px. Card figures 24 px / 700.
- Both bundled via `@fontsource` (latin subsets: Inter 400/500/600, Space Grotesk 500/600/700).

## Shape and spacing

- Side margins 16 px; 6 px between chips; 10–14 px between cards/sections.
- Radii: pills fully rounded (chips 40–44 px high), cards 20, list groups 20 with 14 px rows, sticky headers 14, keypad keys 14, sheets 24 (top), dialogs 24.
- Touch targets ≥ 48 px. Primary button 56 px high, full width, radius 28.
- Icons: 24-px grid, 2 px stroke, round caps, `currentColor` (`starter/src/components/icons.tsx`).

## Shell

- **Background "night ridges"**: vertical gradient `#1F2D45 → #1C2436 (38%) → --bg (60%)`, a few faint stars, three mountain silhouettes (accent 7%, `#8A8CF2` 8%, `#141925` 90%). Behind tab screens only.
- **Bottom navigation** (3–5 tabs): blurred `rgba(20,25,37,.86)` bar, 64 px items, icon in a 56×30 pill; active = accent icon on `--info-bg` pill, label `--text` 600; inactive `--muted`. Forms open full screen without it.
- **FAB** for the main action: accent pill 56 px with icon + label, glow `0 8px 24px rgba(61,155,255,.35)`, bottom right above the nav; lifts when a snackbar shows.
- Max content width 560 px, centred; `100dvh`; safe areas respected.

## Components

| Component | Look |
|---|---|
| Screen header (tab) | 56 px, title left, small status/link right (e.g. backup state) |
| Form header | back chevron + title, 56 px; destructive action as a red-outlined pill on the right |
| Hero figure | muted 13 px label with chevron (it's a link) above the 48 px figure |
| Card | glass card, 16 px padding, 13 px muted label on top; alert variant = danger border |
| Badge | 28 px pill, 13 px/600, icon + word; tinted bg per state (positive/warn/danger/info) |
| Chips (filters) | 40 px `surface-2` pills with a chevron; active = accent fill, label + round "×" clear |
| Search | 44 px pill, glass, magnifier icon, accent border on focus |
| Grouped list | sticky 40 px header (name left, total right, blurred), rows inside one glass group |
| Row | 56–64 px; leading date block or colour stripe, title + muted subtitle, figure right-aligned |
| Total bar | glass pill at the bottom of a list: "N items" left, total right; long-press for modes |
| Selection | selected rows tinted accent; bar shows the selection total |
| Bottom sheet | `surface`, radius 24 top, handle, 56 px head with title + close, scrolling body, pinned footer |
| Dialog | centred `surface` card, accent outline, icon in a circle, two pill buttons |
| Snackbar | `#2E3647` raised bar, 14 px text, accent action ("Undo"), 6 s |
| Info note | `--info-bg` panel, accent icon, 13–14 px `--text-2` |
| Error | danger outline + `--danger-bg`, alert icon, plain-language message |
| Empty / first run | big welcome title, short text, a card to restore a backup, the main action |
| Scheduled / future | dashed outline, `--text-2` figure, clock badge "Scheduled" |

## Brief block (paste into every design brief)

> Use the established "Xpence night" design system: dark only, background `#1A1F2B` with the night-ridges gradient and mountain silhouettes behind tab screens; glass cards (`rgba(35,42,57,.72)`, 1 px `rgba(255,255,255,.06)` border, radius 20, blur); Inter for UI text, Space Grotesk tabular figures for numbers (hero 48 px bold); accent `#3D9BFF` with on-accent `#0B1A2E`; positive `#5FD4A0`, warn `#F2B34B`, danger `#FF8A90`; text `#E6EAF2` / `#B4BCCA` / muted `#9AA3B5`; pill chips 40–44 px, primary buttons 56 px full-width pills; bottom navigation with an accent pill on the active icon; bottom sheets with radius 24; snackbar with Undo. Portrait 390 × 844, touch targets ≥ 48 px, never colour alone. Reuse these styles; extend only where the screen needs something new.
