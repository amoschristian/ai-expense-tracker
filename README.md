# expenses-web

Mobile-friendly web dashboard — Flask API + Preact frontend + SQLite database.

## Quick start

```bash
cd ~/dev/expenses-web
source venv/bin/activate
python3 server.py       # http://localhost:5000
```

## Key files

- `config.py` — colors, categories, account definitions
- `db.py` — SQLite schema + query functions
- `server.py` — Flask API (port 5000)
- `data/expenses.db` — SQLite database
- `static/app.js` — Preact frontend (CDN, no build step)
- `static/style.css` — Tokyo Night theme
- `expenses-web.service` — systemd unit file

## Database

**Location:** `data/expenses.db`

### Schema

```sql
CREATE TABLE categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    parent TEXT,
    color TEXT,
    is_income BOOLEAN DEFAULT 0,
    is_transfer BOOLEAN DEFAULT 0
);

CREATE TABLE transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    category_id INTEGER REFERENCES categories(id),
    amount INTEGER NOT NULL,
    description TEXT,
    account TEXT NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL
);

CREATE TABLE accounts (
    account TEXT NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL,
    start_balance INTEGER,
    end_balance INTEGER,
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

## Query recipes

### Month summary

```sql
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
| GET | `/api/month` | `account, year, month` | Summary + transactions |
| GET | `/api/trend` | `account, year, month` | 6-month net cash flow |
| GET | `/api/balance` | `account` | Latest end_balance |
| POST | `/api/transaction` | `{date, category, amount, account, description?}` | Add transaction |
| GET | `/api/recurring` | — | List recurring expenses |
| POST | `/api/recurring` | `{name, amount, category, account, frequency, day_of_month?, start_date}` | Add recurring |
| PUT | `/api/recurring/<id>` | same as POST | Update recurring |
| DELETE | `/api/recurring/<id>` | — | Delete recurring |

## Accounts

| Account ID | Display Name |
|---|---|
| `bca` | BCA |
| `house` | CIMB Niaga |

## Systemd deployment

```bash
sudo cp ~/dev/expenses-web/expenses-web.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now expenses-web
```
