---
score: 22
p0: 2
p1: 3
p2: 3
title: expenses-web design critique
date: 2026-08-01
timestamp: 2026-07-31T18-23-40Z
slug: static-index-html
---
# Critique: expenses-web (static/index.html)

Tokyo Night identity is coherent (8/10) but composition is generic (6/10). Nielsen heuristics 22/36 = 61%.

## P0
1. Transaction delete has NO confirmation (TransactionView.js ~line 244) — one-click permanent data loss
2. Recurring Pay/Unpay has no confirmation/undo (RecurringView.js handlePay)

## P1
3. Add Transaction modal = 5 fields, contradicts "capture must be cheap" principle (app.js)
4. Summary tab = 7 unconditional cards, scroll fatigue on mobile (SummaryView.js)
5. No "recent transactions" view — month-bound navigation only (TransactionView.js)

## P2
6. Desktop layout: max-width 600px leaves empty side space at 1280px (style.css @768px)
7. Typography too small: tab labels 0.6rem ~9.6px, below Apple 11pt minimum (style.css)
8. SearchableSelect border inconsistent with other borderless inputs (.ss-input)

## Evidence
- Detector: 0 anti-patterns in scanned files; console clean (0 errors/warnings), viewport 1280x577
- Earlier standalone style.css scan: 2 layout-transition warnings (lines 878, 930)
- Strengths: category color+icon system, mobile PWA details, complete state coverage
