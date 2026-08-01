---
name: Expense Dashboard (Warm Dark Ledger)
description: Mobile-first personal expense tracker - dark charcoal, single amber accent, income green / expense red semantics.
colors:
  bg: "#0e0f13"
  surface: "#16181f"
  surface-hover: "#1d2029"
  border: "#2a2e3a"
  text: "#e8eaf0"
  dim: "#9aa1b0"
  accent: "#d9a15f"
  accent-soft: "rgba(217, 161, 95, 0.14)"
  accent-faint: "rgba(217, 161, 95, 0.08)"
  income-green: "#9ece6a"
  expense-red: "#f7768e"
  info-blue: "#7aa2f7"
  cyan: "#7dcfff"
  orange: "#e0af68"
  purple: "#bb9af7"
typography:
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
    fontWeight: "400"
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
    fontWeight: "800"
    fontVariantNumeric: "tabular-nums"
spacing:
  radius-card: "18px"
  radius-control: "12px"
  radius-pill: "999px"
motion:
  ease-out: "cubic-bezier(0.16, 1, 0.3, 1)"
  modal-in: "0.35s"
  bar-in: "0.5s"
  overlay-in: "0.2s"
---

# Warm Dark Ledger

## Design Principles

1. **One warm accent.** Amber `#d9a15f` is the single interactive color: month header, active tab, primary buttons, FAB, focus rings, progress bars, slider thumb, chips. Everything else recedes.
2. **Two semantic colors only.** Income is green `#9ece6a`, expense is red `#f7768e`. Category colors (blue/cyan/orange/purple) are identity colors for data, never status.
3. **Calm depth.** Layered warm charcoal surfaces (`#0e0f13` to `#16181f` to `#1d2029`), soft shadows with real offset+blur, generous rounded corners. No neon, no glass decoration.
4. **Motion rewards taps.** Springy exponential ease-out everywhere: modal springs in with 8px backdrop blur, toasts slide, bars sweep in from the left, controls press down.

## Color

- Ground: `#0e0f13` warm near-black; header fades from `#12141a`.
- Surfaces: cards/inputs `#16181f`, hover `#1d2029`, borders `#2a2e3a`.
- Text: primary `#e8eaf0`, secondary/dim `#9aa1b0`.
- Accent (interactive): amber `#d9a15f`, soft fill `rgba(217,161,95,0.14)`, faint ring `rgba(217,161,95,0.08)`.
- Semantics: income `#9ece6a`, expense `#f7768e`.

## Typography

- System stack only (mobile web, no build step, single user).
- Money figures use `font-variant-numeric: tabular-nums` so digits stay column-stable.
- Hierarchy: balance 1.9rem/800, card titles 0.78rem/700 uppercase tracked, body 0.85-0.9rem.

## Shape and Elevation

- Cards: 18px radius, 1px `rgba(42,46,58,0.6)` border, shadow `0 1px 2px rgba(0,0,0,0.3), 0 4px 16px rgba(0,0,0,0.22)`.
- Controls: 12px radius; pills 999px (chips, pay/paid, toast action).
- Modal: 20px radius, `--shadow-lg`, 1px amber-tinted border.

## Components

- **Balance card**: centered, amber radial glow at top (`::before`), big tabular-nums value, green last-transaction line.
- **Tab bar**: fixed bottom, `rgba(22,24,31,0.92)` + 12px blur, amber active pill, amber FAB (+).
- **Recurring rows**: individual cards (surface bg, full border, radius, 10px margin, tap-to-edit), paid = green pill, unpaid = amber Pay pill.
- **Monthly recurring card**: total + Paid (green) / Remaining (dim) breakdown.
- **Modal**: springs in 0.35s `var(--ease-out)` scale+translate; overlay fade 0.2s + blur(8px).
- **Food budget widget**: Allowance / Spent rows with single separators, colored status line (no double border).
- **Bars** (categories, trend, progress): animate `bar-in` scaleX from left, 0.5s ease-out.

## States and Motion

- `:active` scale 0.92-0.99 on nav, tabs, rows, buttons; amber border on hover (pointer devices).
- Focus-visible: 2px amber outline; `::selection` amber 30%.
- `prefers-reduced-motion: reduce` collapses all animation/transition to ~0.
- Pull-to-refresh pill uses amber spinner.
