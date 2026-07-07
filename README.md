# expenses-web

Mobile-friendly web dashboard — Flask API + Preact frontend + SQLite database.

## Quick start

```bash
cd ~/expenses-web
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

| Table | Purpose |
|---|---|
| `categories` | Expense/income/transfer category definitions with colors |
| `transactions` | Individual transactions (amount, date, account, category) |
| `accounts` | One row per account — anchor balance |
| `recurring_expenses` | Scheduled recurring transactions |

### Balance Formula

```
balance = accounts.balance + SUM(income from first txn → date) - SUM(expenses from first txn → date)
```

Single anchor per account. No monthly chaining. No cascading errors.

## API endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/api/accounts` | List accounts |
| GET | `/api/categories` | List categories |
| GET | `/api/month` | Month summary + transactions |
| GET | `/api/trend` | 6-month net cash flow |
| GET | `/api/balance` | Latest account balance |
| POST | `/api/balance` | Set anchor balance |
| POST | `/api/transaction` | Add transaction |
| PUT | `/api/transaction/<id>` | Update transaction |
| DELETE | `/api/transaction/<id>` | Delete transaction |
| GET | `/api/transactions/search` | Search transactions |
| GET | `/api/mortgage` | Mortgage overview |
| GET | `/api/recurring` | List recurring expenses |
| POST | `/api/recurring` | Add recurring expense |
| PUT | `/api/recurring/<id>` | Update recurring expense |
| DELETE | `/api/recurring/<id>` | Delete recurring expense |

## Systemd deployment

```bash
sudo cp ~/expenses-web/expenses-web.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now expenses-web
```
