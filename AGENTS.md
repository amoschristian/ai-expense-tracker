# expenses-web

Mobile-friendly web dashboard — Flask API + Preact frontend + SQLite database.

## Quick start

```bash
cd ~/dev/expenses-web
source venv/bin/activate
python3 server.py       # http://localhost:5000 (debug=True)
```

## Environment variables

| Variable | Default (dev) | Service (prod) | Description |
|---|---|---|---|
| `FLASK_PORT` | `5000` | `6001` | Server port |
| `FLASK_DEBUG` | `true` | `false` | Auto-reload + debugger |

Dev uses defaults. Prod is configured via `expenses-web.service`.

## Key files

- `config.py` — colors, categories, account definitions
- `db.py` — SQLite schema + query functions
- `server.py` — Flask API (port 5000 dev, 6001 prod)
- `data/expenses.db` — the SQLite database
- `static/app.js` — Preact frontend (CDN, no build step)
- `static/style.css` — Tokyo Night theme
- `expenses-web.service` — systemd unit file

## Database

**Location:** `~/dev/expenses-web/data/expenses.db`

### Schema

```sql
CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,      -- "Food:Restaurant"
    parent TEXT,                     -- "Food"
    color TEXT,                      -- "#f7768e"
    is_income BOOLEAN DEFAULT 0,    -- 1 for Income, Investment
    is_exclude BOOLEAN DEFAULT 0    -- 1 for Transfer (excluded from income/expense breakdowns)
);

CREATE TABLE transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,          -- "2026-06-15"
    category_id INTEGER REFERENCES categories(id),
    amount INTEGER NOT NULL,     -- 120000 (no decimals, Rupiah)
    description TEXT,            -- "Nasi Padang"
    account TEXT NOT NULL,       -- "bca" or "house"
    year INTEGER NOT NULL,       -- 2026 (denormalized)
    month INTEGER NOT NULL       -- 6
);

CREATE TABLE accounts (
    account TEXT NOT NULL,       -- "bca" or "house"
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    start_balance INTEGER,       -- can be NULL (first month is user-provided anchor)
    PRIMARY KEY (account, year, month)
);

CREATE TABLE recurring_expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    amount INTEGER NOT NULL,
    category_id INTEGER REFERENCES categories(id),
    account TEXT NOT NULL,
    frequency TEXT NOT NULL DEFAULT 'monthly',
    day_of_month INTEGER,
    start_date TEXT NOT NULL,
    end_date TEXT
);
```

### Indexes

```sql
CREATE INDEX idx_tx_ym ON transactions(year, month);
CREATE INDEX idx_tx_account ON transactions(account);
CREATE INDEX idx_tx_category ON transactions(category_id);
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

-- Balance for a month (computed on-the-fly)
SELECT start_balance,
       start_balance + (
         SELECT SUM(CASE WHEN c.is_income THEN t.amount ELSE 0 END) -
                SUM(CASE WHEN NOT c.is_income THEN t.amount ELSE 0 END)
         FROM transactions t JOIN categories c ON t.category_id=c.id
         WHERE t.account='bca' AND t.year=2026 AND t.month=6
       ) as end_balance
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
| GET | `/api/recurring` | — | List recurring expenses |
| POST | `/api/recurring` | `{name, amount, category, account, frequency, day_of_month?, start_date}` | Add recurring |
| PUT/PATCH | `/api/recurring/<id>` | same as POST | Update recurring (PUT = full, PATCH = partial) |
| DELETE | `/api/recurring/<id>` | — | Delete recurring |

## Accounts

| Account ID | Display Name |
|---|---|
| `bca` | BCA |
| `house` | CIMB Niaga |

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
| Insurance | Orange | `#e0af68` |
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

Note: Service runs on port 6001 with debug disabled (set via `FLASK_PORT` and `FLASK_DEBUG` env vars in the service file). Port 6000 is blocked by Chrome as an unsafe port (X11 reservation).
