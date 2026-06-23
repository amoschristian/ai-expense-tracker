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

- `config.py` — colors, category definitions, account definitions
- `db.py` — SQLite schema + query functions
- `migrate.py` — markdown → SQLite import
- `server.py` — Flask API (port 5000)
- `data/expenses.db` — SQLite database (gitignored)
- `static/app.js` — Preact frontend (CDN, no build step)
- `static/style.css` — Tokyo Night theme
- `expenses-web.service` — systemd unit file

## Database

**Location:** `data/expenses.db` (gitignored — rebuild with `python3 migrate.py`)

### Schema

```sql
CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,    -- "Food:Restaurant"
    parent TEXT,                   -- "Food"
    color TEXT,                    -- "#f7768e"
    is_income BOOLEAN DEFAULT 0   -- 1 for Income/Investment
);

CREATE TABLE transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,            -- "2026-06-15"
    category_id INTEGER REFERENCES categories(id),
    amount INTEGER NOT NULL,       -- 120000 (Rupiah, no decimals)
    description TEXT,              -- "Nasi Padang"
    account TEXT NOT NULL,         -- "bca" or "house"
    year INTEGER NOT NULL,         -- 2026 (denormalized)
    month INTEGER NOT NULL         -- 6
);

CREATE TABLE accounts (
    account TEXT NOT NULL,         -- "bca" or "house"
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    start_balance INTEGER,
    end_balance INTEGER,
    PRIMARY KEY (account, year, month)
);
```

### Indexes

```sql
CREATE INDEX idx_tx_ym ON transactions(year, month);
CREATE INDEX idx_tx_account ON transactions(account);
CREATE INDEX idx_tx_category ON transactions(category_id);
```

## Query recipes

### Month summary

```sql
-- Total income/expense for a month (via categories.is_income)
SELECT
    SUM(CASE WHEN c.is_income THEN t.amount ELSE 0 END) as income,
    SUM(CASE WHEN NOT c.is_income THEN t.amount ELSE 0 END) as expense
FROM transactions t JOIN categories c ON t.category_id=c.id
WHERE t.account = 'bca' AND t.year = 2026 AND t.month = 6;
```

### Top categories

```sql
SELECT c.name, SUM(t.amount) as total
FROM transactions t JOIN categories c ON t.category_id=c.id
WHERE t.account = 'bca' AND t.year = 2026 AND t.month = 6
  AND c.is_income = 0
  AND c.parent != 'Transfer'
GROUP BY c.name
ORDER BY total DESC
LIMIT 8;
```

### 6-month trend

```sql
SELECT t.year, t.month,
    SUM(CASE WHEN c.is_income THEN t.amount ELSE 0 END) -
    SUM(CASE WHEN NOT c.is_income THEN t.amount ELSE 0 END) as net
FROM transactions t JOIN categories c ON t.category_id=c.id
WHERE t.account = 'bca'
  AND (t.year * 100 + t.month) BETWEEN 202601 AND 202606
GROUP BY t.year, t.month
ORDER BY t.year, t.month;
```

### Search transactions

```sql
SELECT t.date, c.name, t.amount, t.description, c.is_income
FROM transactions t JOIN categories c ON t.category_id=c.id
WHERE t.account = 'bca' AND t.year = 2026 AND t.month = 6
  AND (c.name LIKE '%Food%' OR t.description LIKE '%Food%')
ORDER BY t.date DESC;
```

## API endpoints

| Method | Path | Params | Returns |
|---|---|---|---|
| GET | `/api/accounts` | — | `[{id:"bca"}, {id:"house"}]` |
| GET | `/api/categories` | — | `[{id, name, parent, color, is_income}]` |
| GET | `/api/month` | `account, year, month` | Summary + transactions (with category color) |
| GET | `/api/trend` | `account, year, month` | 6-month net cash flow |
| GET | `/api/balance` | `account` | Latest end_balance |

## Rebuilding the database

```bash
cd ~/dev/expenses-web
source venv/bin/activate
python3 migrate.py
```

Deletes all rows and re-imports from markdown files in `~/Obsidian/Expenses/`. Safe to run multiple times.

## Accounts

| Account ID | Display Name | Vault Directory |
|---|---|---|
| `bca` | BCA | `~/Obsidian/Expenses/bca/` |
| `house` | CIMB Niaga | `~/Obsidian/Expenses/house/` |

## Systemd deployment

```bash
sudo cp ~/dev/expenses-web/expenses-web.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now expenses-web
```

Note: Set `debug=False` in `server.py` before deploying.
