# expenses-web

Mobile-friendly web dashboard for `~/Obsidian/Expenses/` — Flask API + Preact frontend + SQLite database.

## Quick start

```bash
cd ~/dev/expenses-web
source venv/bin/activate
python3 migrate.py      # rebuild DB from markdown
python3 server.py       # http://192.168.18.200:5000
```

## Key files

- `config.py` — colors, categories, account definitions
- `db.py` — SQLite schema + query functions
- `migrate.py` — one-time markdown → SQLite import
- `server.py` — Flask API (port 5000)
- `data/expenses.db` — the SQLite database
- `static/app.js` — Preact frontend (CDN, no build step)
- `static/style.css` — Tokyo Night theme
- `expenses-web.service` — systemd unit file

## Database

**Location:** `~/dev/expenses-web/data/expenses.db`

### Schema

```sql
CREATE TABLE transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,          -- "2026-06-15"
    category TEXT NOT NULL,      -- "Food:Restaurant" (Parent:Subcategory)
    amount INTEGER NOT NULL,     -- 120000 (no decimals, Rupiah)
    description TEXT,            -- "Nasi Padang"
    account TEXT NOT NULL,       -- "bca" or "house"
    is_income BOOLEAN NOT NULL,  -- 0 = expense, 1 = income
    year INTEGER NOT NULL,       -- 2026 (denormalized)
    month INTEGER NOT NULL       -- 6
);

CREATE TABLE accounts (
    account TEXT NOT NULL,       -- "bca" or "house"
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    start_balance INTEGER,       -- can be NULL
    end_balance INTEGER,         -- can be NULL
    PRIMARY KEY (account, year, month)
);
```

### Indexes

```sql
CREATE INDEX idx_tx_ym ON transactions(year, month);
CREATE INDEX idx_tx_account ON transactions(account);
CREATE INDEX idx_tx_category ON transactions(category);
```

### Current data

- **BCA:** 321 transactions, Jan–Jun 2026
- **House:** 8 transactions, Jan–Jun 2026
- **Accounts:** 12 rows (6 months × 2 accounts)

## Query recipes

### Month summary

```sql
-- Total income/expense for a month
SELECT
    SUM(CASE WHEN is_income THEN amount ELSE 0 END) as income,
    SUM(CASE WHEN NOT is_income THEN amount ELSE 0 END) as expense
FROM transactions
WHERE account = 'bca' AND year = 2026 AND month = 6;

-- Balance for a month
SELECT start_balance, end_balance
FROM accounts
WHERE account = 'bca' AND year = 2026 AND month = 6;
```

### Top categories

```sql
SELECT category, SUM(amount) as total
FROM transactions
WHERE account = 'bca' AND year = 2026 AND month = 6
  AND is_income = 0
  AND category NOT LIKE 'Transfer%'
GROUP BY category
ORDER BY total DESC
LIMIT 8;
```

### 6-month trend

```sql
SELECT year, month,
    SUM(CASE WHEN is_income THEN amount ELSE 0 END) -
    SUM(CASE WHEN NOT is_income THEN amount ELSE 0 END) as net
FROM transactions
WHERE account = 'bca'
  AND (year * 100 + month) BETWEEN 202601 AND 202606
GROUP BY year, month
ORDER BY year, month;
```

### Daily spending

```sql
SELECT date, SUM(amount) as total
FROM transactions
WHERE account = 'bca' AND year = 2026 AND month = 6
  AND is_income = 0
  AND category NOT LIKE 'Transfer%'
GROUP BY date
ORDER BY date;
```

### Search transactions

```sql
SELECT date, category, amount, description, is_income
FROM transactions
WHERE account = 'bca' AND year = 2026 AND month = 6
  AND (category LIKE '%Food%' OR description LIKE '%Food%')
ORDER BY date DESC;
```

### All transactions for a category across months

```sql
SELECT date, category, amount, description
FROM transactions
WHERE account = 'bca'
  AND category LIKE 'Food%'
  AND year = 2026
ORDER BY date;
```

## API endpoints

| Method | Path | Params | Returns |
|---|---|---|---|
| GET | `/api/accounts` | — | `[{id:"bca"}, {id:"house"}]` |
| GET | `/api/month` | `account, year, month` | Summary + transactions |
| GET | `/api/trend` | `account, year, month` | 6-month net cash flow |
| GET | `/api/balance` | `account` | Latest balance |

## Rebuilding the database

```bash
cd ~/dev/expenses-web
source venv/bin/activate
python3 migrate.py
```

This deletes all rows and re-imports from markdown files in `~/Obsidian/Expenses/`. Idempotent — safe to run multiple times.

## Accounts

| Account ID | Display Name | Vault Directory |
|---|---|---|
| `bca` | BCA | `~/Obsidian/Expenses/bca/` |
| `house` | CIMB Niaga | `~/Obsidian/Expenses/house/` |

## Category colors (Tokyo Night)

| Category | Color | Hex |
|---|---|---|
| Food | Red | `#f7768e` |
| Transport | Cyan | `#7dcfff` |
| Bills | Orange | `#e0af68` |
| Housing | Blue | `#7aa2f7` |
| Vehicle | Orange | `#e0af68` |
| Shopping | Purple | `#bb9af7` |
| Entertainment | Purple | `#bb9af7` |
| Health | Red | `#f7768e` |
| Administration | Dim | `#565f89` |
| Insurance | Dim | `#565f89` |
| Income | Green | `#9ece6a` |
| Transfer | Dim | `#565f89` |
| Business | Cyan | `#7dcfff` |
| Investment | Green | `#9ece6a` |
| Personal | Text | `#a9b1d6` |
| Technology | Blue | `#7aa2f7` |
| Other | Dim | `#565f89` |

## Systemd deployment

```bash
sudo cp ~/dev/expenses-web/expenses-web.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now expenses-web
```

Note: Set `debug=False` in `server.py` before deploying.
