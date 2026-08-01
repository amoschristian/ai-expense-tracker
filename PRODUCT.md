# Product

<!-- impeccable:product-schema 1 -->

## Platform

web (mobile-first; also used on desktop for review)

## Stack

Existing codebase: Flask API + SQLite (source of truth) + Preact frontend (CDN, no build step), served via systemd (`expenses-web`, port 6002). Mobile-first single-page app with tab navigation.

## Users

Single user: Blackhawk. Exclusively personal — no family, shared, or multi-user use now or planned.

## Product Purpose

Personal expense tracker that keeps a single SQLite database as the sole source of truth for all personal spending across three accounts (BCA primary, Amos savings, House/CIMB mortgage). Makes daily spending capture frictionless and monthly money review glanceable. Success = every real transaction gets logged (mostly via FRIDAY in Telegram or the web UI), balances stay accurate, and the user always knows where money went and what is coming.

## Positioning

A personal, self-hosted money journal with a computed-on-the-fly balance architecture (single anchor per account + sum of transactions — no monthly balance bookkeeping to desync). It is not a bank aggregator and never touches real bank APIs; it is the user's own ledger, fed by the user (or FRIDAY) and reconciled against the bank app.

## Operating Context

- Daily logging happens from a phone: quick entries via the web app, or more often by telling FRIDAY in Telegram ("log this expense..."), which POSTs to the local API.
- Accounts: `bca` (primary, default for all spending), `amos` (personal savings), `house` (CIMB mortgage). Account names are lowercase in the DB.
- Categories are Parent:Sub (e.g. Food:Groceries, Technology:AI). Indomaret/Alfamart → Food:Groceries; restaurant → Food:Restaurant; refunds are income entries (e.g. Food:Refund) that net against the parent.
- Monthly meal allowance (~4.5M) is logged as a Food:Allowance expense entry, so food budget math includes it.
- Recurring expenses (AI subs, VPS, internet, mortgage, insurance) with a "Pay" button that creates the month's transaction; some are auto-debited via cron.
- FRIDAY is an active participant: logs expenses, answers balance/category questions, reconciles, maintains recurring entries, and watches the app for drift.

## Capabilities and Constraints

- Capabilities: transaction CRUD, monthly summaries + 6-month trend per account, category breakdowns, balance computed on the fly, mortgage overview, recurring expenses with pay/unpay, search by description, CSV-style bulk import, FRIDAY/cron integration via API at localhost:6002.
- Constraints: local-only (never exposed publicly); SQLite single-writer; amounts are integer Rupiah; CSRF protection removed intentionally (local-only); API is the only interface — no direct SQL for mutations (FRIDAY's hard rule); no real bank feeds; no multi-user; no auth (single user, trusted network).
- Timezone gotcha (July 2026): frontend must use local time, not UTC, for dates — recurring pay dates and month checks are local (WIB).

## Brand Commitments

- Name: "Expense Dashboard" / expenses-web (repo `amoschristian/ai-expense-tracker`).
- Visual identity: Tokyo Night dark theme (colors defined in config.py / style.css: e.g. Food #f7768e, Transport #7dcfff, Bills #e0af68, Housing #7aa2f7, Income #9ece6a).
- No other binding brand or voice commitments; tone in UI copy is plain and functional.

## Evidence on Hand

- Real personal transaction data Jan 2024–Jul 2026 (~380 transactions across BCA/Amos/House) in `data/expenses.db`.
- Real recurring schedule (AI Subscription 190k/26th on Amos, Biznet VPS 65,490/29th, Internet 333k/1st, mortgage 5.7M, Prudential insurance, Netflix 120k).
- AGENTS.md documents schema, API endpoints, and query recipes.
- Absence: no design system file (DESIGN.md), no product context file until this one, no user research beyond Blackhawk's own usage.

## Product Principles

1. The ledger is the truth: every real transaction gets recorded; balances are always derivable from anchor + transactions.
2. Capture must be cheap: logging one expense takes seconds (Telegram message or one form) or it will not happen.
3. Personal data stays personal: local-only, single user, no cloud dependency, no third-party bank connections.
4. Keep the mental model simple: three accounts, Parent:Sub categories, one recurring schedule — no features that require bookkeeping discipline.
5. FRIDAY is the interface as much as the web app: the tool must stay scriptable via API so daily logging and review can happen in chat.

## Accessibility & Inclusion

- Single known user; no product-specific accessibility standard was established. Mobile-first layout implies touch targets and readability on phone screens are de facto requirements.
