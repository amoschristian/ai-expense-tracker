from __future__ import annotations

import sqlite3
from collections.abc import Generator
from contextlib import contextmanager
from pathlib import Path

from config import CATEGORY_COLORS, INCOME_PARENTS, MONTHS, TRANSFER_PARENTS

DB_PATH = Path(__file__).parent / "data" / "expenses.db"


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


@contextmanager
def get_db() -> Generator[sqlite3.Connection, None, None]:
    conn = get_conn()
    try:
        yield conn
    finally:
        conn.close()


def init_db() -> None:
    with get_db() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                parent TEXT,
                color TEXT,
                is_income BOOLEAN DEFAULT 0,
                is_exclude BOOLEAN DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL,
                category_id INTEGER REFERENCES categories(id),
                amount INTEGER NOT NULL,
                description TEXT,
                account TEXT NOT NULL,
                year INTEGER NOT NULL,
                month INTEGER NOT NULL
            );

            CREATE TABLE IF NOT EXISTS accounts (
                account TEXT PRIMARY KEY,
                balance INTEGER NOT NULL DEFAULT 0
            );

            CREATE INDEX IF NOT EXISTS idx_tx_ym ON transactions(year, month);
            CREATE INDEX IF NOT EXISTS idx_tx_account ON transactions(account);
            CREATE INDEX IF NOT EXISTS idx_tx_category ON transactions(category_id);
            CREATE INDEX IF NOT EXISTS idx_tx_balance ON transactions(account, date, category_id, amount);

            CREATE TABLE IF NOT EXISTS recurring_expenses (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                amount INTEGER NOT NULL,
                category_id INTEGER REFERENCES categories(id),
                account TEXT NOT NULL,
                frequency TEXT NOT NULL DEFAULT 'monthly',
                day_of_month INTEGER,
                start_date TEXT NOT NULL,
                end_date TEXT,
                is_variable INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS goals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                target_amount INTEGER NOT NULL,
                account TEXT NOT NULL DEFAULT 'amos',
                start_balance INTEGER NOT NULL DEFAULT 0,
                target_date TEXT,
                note TEXT,
                created_at TEXT DEFAULT (date('now'))
            );
        """)
        # Migration: add recurring_id to transactions if not present
        cols = conn.execute("PRAGMA table_info(transactions)").fetchall()
        col_names = [c["name"] for c in cols]
        if "recurring_id" not in col_names:
            conn.execute("ALTER TABLE transactions ADD COLUMN recurring_id INTEGER REFERENCES recurring_expenses(id)")
        # Migration: add is_variable to recurring_expenses if not present
        rcols = conn.execute("PRAGMA table_info(recurring_expenses)").fetchall()
        rcol_names = [c["name"] for c in rcols]
        if "is_variable" not in rcol_names:
            conn.execute("ALTER TABLE recurring_expenses ADD COLUMN is_variable INTEGER DEFAULT 0")
        seed_categories(conn)


def seed_categories(conn: sqlite3.Connection) -> None:
    """Insert categories from config if not already present, sync colors."""
    for name, color in CATEGORY_COLORS.items():
        is_income = 1 if name in INCOME_PARENTS else 0
        is_exclude = 1 if name in TRANSFER_PARENTS else 0
        conn.execute(
            "INSERT OR IGNORE INTO categories (name, parent, color, is_income, is_exclude) VALUES (?, ?, ?, ?, ?)",
            (name, name, color, is_income, is_exclude),
        )
        conn.execute(
            "UPDATE categories SET color=?, is_income=?, is_exclude=? WHERE name=?",
            (color, is_income, is_exclude, name),
        )
    conn.commit()


def _compute_balance(conn: sqlite3.Connection, account: str, year: int, month: int) -> int:
    """Compute balance = anchor + SUM(all income from first txn to date) - SUM(all expenses)."""
    row = conn.execute(
        "SELECT balance FROM accounts WHERE account=?", (account,)
    ).fetchone()
    if not row:
        return 0
    anchor = row["balance"]

    result = conn.execute(
        """SELECT
             SUM(CASE WHEN c.is_income=1 THEN t.amount ELSE 0 END) -
             SUM(CASE WHEN c.is_income=0 THEN t.amount ELSE 0 END) as net
           FROM transactions t JOIN categories c ON t.category_id=c.id
           WHERE t.account=? AND (t.year * 100 + t.month) <= ?""",
        (account, year * 100 + month),
    ).fetchone()
    return anchor + (result["net"] or 0)


def get_month_end_balance(account: str, year: int, month: int) -> int:
    """End balance for a specific month."""
    with get_db() as conn:
        return _compute_balance(conn, account, year, month)


def get_month_summary(account: str, year: int, month: int) -> dict | None:
    with get_db() as conn:
        acc = conn.execute("SELECT 1 FROM accounts WHERE account=?", (account,)).fetchone()
        if not acc:
            return None

        start_b = _compute_balance(conn, account, year, month - 1) if month > 1 else _compute_balance(conn, account, year - 1, 12)
        end_b = _compute_balance(conn, account, year, month)

        incomes = conn.execute(
            "SELECT SUM(amount) as total FROM transactions t JOIN categories c ON t.category_id=c.id WHERE account=? AND year=? AND month=? AND c.is_income=1 AND c.is_exclude=0",
            (account, year, month),
        ).fetchone()
        expenses = conn.execute(
            "SELECT SUM(amount) as total FROM transactions t JOIN categories c ON t.category_id=c.id WHERE account=? AND year=? AND month=? AND c.is_income=0 AND c.is_exclude=0",
            (account, year, month),
        ).fetchone()

        total_in = incomes["total"] or 0
        total_out = expenses["total"] or 0

        cats = conn.execute(
            """SELECT c.name, c.color, SUM(t.amount) as total
               FROM transactions t JOIN categories c ON t.category_id=c.id
               WHERE t.account=? AND t.year=? AND t.month=? AND c.is_income=0
                 AND c.is_exclude=0
               GROUP BY c.name
               ORDER BY total DESC""",
            (account, year, month),
        ).fetchall()

        cat_list = []
        for c in cats:
            pct = (c["total"] / total_out * 100) if total_out else 0
            cat_list.append({"name": c["name"], "color": c["color"], "amount": c["total"], "pct": round(pct, 1)})

        return {
            "name": f"{MONTHS[month - 1]} {year}",
            "start": start_b,
            "end": end_b,
            "income": total_in,
            "expense": total_out,
            "net": total_in - total_out,
            "categories": cat_list,
        }


def get_transactions(account: str, year: int, month: int) -> list[dict]:
    with get_db() as conn:
        rows = conn.execute(
            """SELECT t.id, t.date, t.account, c.name as category, c.color, c.is_income, c.is_exclude, t.amount, t.description
              FROM transactions t JOIN categories c ON t.category_id=c.id
              WHERE t.account=? AND t.year=? AND t.month=?
              ORDER BY t.date DESC, t.id DESC""",
            (account, year, month),
        ).fetchall()
        return [dict(r) for r in rows]


def get_trend(account: str, year: int, month: int) -> list[dict]:
    with get_db() as conn:
        rows = conn.execute(
            """SELECT t.year, t.month,
                      SUM(CASE WHEN c.is_income THEN t.amount ELSE 0 END) -
                      SUM(CASE WHEN NOT c.is_income THEN t.amount ELSE 0 END) as net
              FROM transactions t JOIN categories c ON t.category_id=c.id
              WHERE t.account=?
                 AND c.is_exclude=0
                AND (t.year * 100 + t.month) BETWEEN ? AND ?
              GROUP BY t.year, t.month
              ORDER BY t.year, t.month""",
            (account, (year - 1) * 100 + month, year * 100 + month),
        ).fetchall()
        return [{"name": MONTHS[r["month"] - 1], "net": r["net"]} for r in rows]


def get_balance(account: str) -> dict | None:
    """Get current balance from anchor + all transactions."""
    with get_db() as conn:
        acc = conn.execute("SELECT balance FROM accounts WHERE account=?", (account,)).fetchone()
        if not acc:
            return None

        latest = conn.execute(
            "SELECT year, month, date FROM transactions WHERE account=? ORDER BY date DESC LIMIT 1",
            (account,),
        ).fetchone()

        if latest:
            bal = _compute_balance(conn, account, latest["year"], latest["month"])
            y, m, latest_date = latest["year"], latest["month"], latest["date"]
        else:
            bal = acc["balance"]
            y, m, latest_date = 2026, 1, None

        result = {"account": account, "balance": bal, "year": y, "month": m}
        if latest_date:
            result["latest_date"] = latest_date
        return result


def set_balance(account: str, balance: int) -> None:
    """Set the anchor balance for an account."""
    with get_db() as conn:
        conn.execute(
            "INSERT INTO accounts (account, balance) VALUES (?, ?) ON CONFLICT(account) DO UPDATE SET balance=?",
            (account, balance, balance),
        )
        conn.commit()


def get_accounts() -> list[dict]:
    with get_db() as conn:
        rows = conn.execute("SELECT account FROM accounts ORDER BY account").fetchall()
        return [{"id": r["account"]} for r in rows]


def ensure_account(account: str) -> None:
    with get_db() as conn:
        conn.execute(
            "INSERT OR IGNORE INTO accounts (account, balance) VALUES (?, 0)",
            (account,),
        )
        conn.commit()


def get_categories() -> list[dict]:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT id, name, parent, color, is_income, is_exclude FROM categories ORDER BY name"
        ).fetchall()
        return [dict(r) for r in rows]


def get_category_id(conn: sqlite3.Connection, name: str) -> int | None:
    row = conn.execute("SELECT id FROM categories WHERE name=?", (name,)).fetchone()
    return row["id"] if row else None


def get_recurring_expenses() -> list[dict]:
    with get_db() as conn:
        rows = conn.execute(
            """SELECT r.id, r.name, r.amount, r.account, r.frequency,
                      r.day_of_month, r.start_date, r.end_date, r.is_variable,
                      c.name as category, c.color
               FROM recurring_expenses r
               LEFT JOIN categories c ON r.category_id = c.id
               ORDER BY r.name"""
        ).fetchall()
        today = __import__('datetime').date.today()
        result = []
        for r in rows:
            item = dict(r)
            # Check if paid this month
            paid_tx = conn.execute(
                "SELECT id, date FROM transactions WHERE recurring_id=? AND year=? AND month=? LIMIT 1",
                (item["id"], today.year, today.month),
            ).fetchone()
            item["paid"] = paid_tx is not None
            item["paid_tx_id"] = paid_tx["id"] if paid_tx else None
            item["paid_date"] = paid_tx["date"] if paid_tx else None
            result.append(item)
        return result


def add_recurring_expense(data: dict) -> int:
    with get_db() as conn:
        cat_id = get_category_id(conn, data["category"])
        if not cat_id:
            return -1
        cur = conn.execute(
            """INSERT INTO recurring_expenses
               (name, amount, category_id, account, frequency, day_of_month, start_date, end_date, is_variable)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (data["name"], int(data["amount"]), cat_id, data["account"],
             data.get("frequency", "monthly"), data.get("day_of_month"),
             data["start_date"], data.get("end_date"),
             1 if data.get("is_variable") else 0),
        )
        conn.commit()
        return cur.lastrowid


def get_recurring_expense(item_id: int) -> dict | None:
    with get_db() as conn:
        row = conn.execute(
            """SELECT r.id, r.name, r.amount, r.account, r.frequency,
                      r.day_of_month, r.start_date, r.end_date, r.is_variable,
                      c.name as category, c.color
               FROM recurring_expenses r
               LEFT JOIN categories c ON r.category_id = c.id
               WHERE r.id=?""",
            (item_id,),
        ).fetchone()
        return dict(row) if row else None


def update_recurring_expense(item_id: int, data: dict) -> bool:
    with get_db() as conn:
        cat_id = get_category_id(conn, data["category"])
        if not cat_id:
            return False
        cur = conn.execute(
            """UPDATE recurring_expenses
               SET name=?, amount=?, category_id=?, account=?, frequency=?,
                   day_of_month=?, start_date=?, end_date=?, is_variable=?
               WHERE id=?""",
            (data["name"], int(data["amount"]), cat_id, data["account"],
             data.get("frequency", "monthly"), data.get("day_of_month"),
             data["start_date"], data.get("end_date"),
             1 if data.get("is_variable") else 0, item_id),
        )
        conn.commit()
        return cur.rowcount > 0


def delete_recurring_expense(item_id: int) -> bool:
    with get_db() as conn:
        cur = conn.execute("DELETE FROM recurring_expenses WHERE id=?", (item_id,))
        conn.commit()
        return cur.rowcount > 0


def pay_recurring(item_id: int, date_str: str) -> int | None:
    """Create a transaction for a recurring expense. Returns transaction id or None."""
    with get_db() as conn:
        rec = conn.execute(
            "SELECT r.*, c.name as cat_name FROM recurring_expenses r JOIN categories c ON r.category_id=c.id WHERE r.id=?",
            (item_id,),
        ).fetchone()
        if not rec:
            return None

        y = int(date_str[:4])
        m = int(date_str[5:7])

        cur = conn.execute(
            """INSERT INTO transactions (date, category_id, amount, description, account, year, month, recurring_id)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (date_str, rec["category_id"], rec["amount"], rec["name"], rec["account"], y, m, item_id),
        )
        conn.commit()
        return cur.lastrowid


def unpay_recurring(item_id: int, year: int, month: int) -> bool:
    """Delete the payment transaction for a recurring expense in the given month."""
    with get_db() as conn:
        cur = conn.execute(
            "DELETE FROM transactions WHERE recurring_id=? AND year=? AND month=?",
            (item_id, year, month),
        )
        conn.commit()
        return cur.rowcount > 0



def _variable_estimate(conn, account: str, category: str, lookback_months: int = 3) -> dict | None:
    """Learn from history: avg/min/max monthly totals + typical day for a
    variable recurring item (category + account), excluding the current month."""
    from datetime import date
    from statistics import median
    today = date.today()
    rows = conn.execute(
        """SELECT (t.year * 100 + t.month) as ym, SUM(t.amount) as total,
                  MIN(CAST(substr(t.date, 9, 2) AS INTEGER)) as min_day,
                  MAX(CAST(substr(t.date, 9, 2) AS INTEGER)) as max_day,
                  CAST(round(AVG(CAST(substr(t.date, 9, 2) AS INTEGER))) AS INTEGER) as avg_day
           FROM transactions t JOIN categories c ON t.category_id=c.id
           WHERE t.account=? AND c.name=? AND (t.year * 100 + t.month) < ?
           GROUP BY ym ORDER BY ym DESC LIMIT ?""",
        (account, category, today.year * 100 + today.month, lookback_months),
    ).fetchall()
    if not rows:
        return None
    totals = [r['total'] for r in rows]
    days = [d for r in rows for d in (r['min_day'], r['max_day']) if d]
    return {
        'avg': round(sum(totals) / len(totals)),
        'min': min(totals),
        'max': max(totals),
        'typical_day': round(median(days)) if days else None,
    }


def _is_quarter_due(start_ym: int, year: int, month: int) -> bool:
    """Quarterly recurring: due when (current - start) is a multiple of 3 months."""
    current = year * 100 + month
    diff = (year * 12 + month) - ((start_ym // 100) * 12 + (start_ym % 100))
    return diff >= 0 and diff % 3 == 0


def get_simulation(account: str, year: int, month: int) -> dict | None:
    """Balance simulation for a month: current balance, upcoming recurring
    debits (fixed or variable, unpaid, within start/end date), projected end."""
    import calendar
    from datetime import date

    with get_db() as conn:
        acc = conn.execute("SELECT account FROM accounts WHERE account=?", (account,)).fetchone()
        if not acc:
            return None

        bal = _compute_balance(conn, account, year, month)
        today = date.today()
        days_in_month = calendar.monthrange(year, month)[1]

        rows = conn.execute(
            """SELECT r.id, r.name, r.amount, r.day_of_month, r.start_date, r.end_date,
                      r.frequency, r.is_variable,
                      c.name as category, c.color
               FROM recurring_expenses r
               LEFT JOIN categories c ON r.category_id = c.id
               WHERE r.account = ?
               ORDER BY r.day_of_month""",
            (account,),
        ).fetchall()

        upcoming = []
        next_due = []
        for r in rows:
            start_ym = int(r["start_date"][:4]) * 100 + int(r["start_date"][5:7]) if r["start_date"] else 0

            # frequency gating: only include when this month is a due month
            if r["frequency"] == "quarterly":
                if not _is_quarter_due(start_ym, year, month):
                    # not due this month: surface it in next_due so the user sees it coming
                    if r["is_variable"] and r["category"]:
                        est = _variable_estimate(conn, account, r["category"])
                        if est:
                            cur = year * 12 + month
                            diff = cur - (start_ym // 100 * 12 + start_ym % 100)
                            months_to_next = 3 - (diff % 3)
                            nxt = cur + months_to_next
                            next_due.append({
                                "id": r["id"],
                                "name": r["name"],
                                "amount": est["avg"],
                                "est_min": est["min"],
                                "est_max": est["max"],
                                "category": r["category"],
                                "color": r["color"],
                                "due_year": nxt // 12,
                                "due_month": nxt % 12,
                            })
                    continue
            elif r["frequency"] != "monthly":
                continue  # weekly/yearly not simulated yet

            # paid check: variable -> by category; fixed -> by recurring_id link
            if r["is_variable"]:
                paid = conn.execute(
                    "SELECT 1 FROM transactions t JOIN categories c ON t.category_id=c.id"
                    " WHERE t.account=? AND c.name=? AND t.year=? AND t.month=? LIMIT 1",
                    (account, r["category"], year, month),
                ).fetchone()
            else:
                paid = conn.execute(
                    "SELECT 1 FROM transactions WHERE recurring_id=? AND year=? AND month=? LIMIT 1",
                    (r["id"], year, month),
                ).fetchone()
            if paid:
                continue

            # variable: learn amount + typical day from history
            amount = r["amount"]
            dom = r["day_of_month"]
            est = None
            if r["is_variable"] and r["category"]:
                est = _variable_estimate(conn, account, r["category"])
                if est:
                    amount = est["avg"]
                    dom = est["typical_day"] or dom
            if not dom:
                continue
            if dom < today.day:
                continue  # already past this month

            # date-window: debit must fall between start_date and end_date
            try:
                debit_date = date(year, month, min(dom, days_in_month))
            except ValueError:
                continue
            if r["start_date"] and debit_date < date.fromisoformat(r["start_date"]):
                continue
            if r["end_date"] and debit_date > date.fromisoformat(r["end_date"]):
                continue

            item = {
                "id": r["id"],
                "name": r["name"],
                "amount": amount,
                "day": dom,
                "date": debit_date.isoformat(),
                "category": r["category"],
                "color": r["color"],
                "is_variable": bool(r["is_variable"]),
            }
            if est:
                item["est_min"] = est["min"]
                item["est_max"] = est["max"]
            upcoming.append(item)

        total_upcoming = sum(u["amount"] for u in upcoming)
        projected_end = bal - total_upcoming

        return {
            "account": account,
            "year": year,
            "month": month,
            "today": today.day,
            "days_in_month": days_in_month,
            "balance": bal,
            "upcoming": upcoming,
            "next_due": next_due,
            "total_upcoming": total_upcoming,
            "projected_end": projected_end,
        }


# ---------- Goals (savings goal tracking) ----------

def _goal_progress(conn: sqlite3.Connection, goal) -> dict:
    """Compute progress for a goal: growth of account balance since start_balance."""
    from datetime import date
    today = date.today()
    current = _compute_balance(conn, goal["account"], today.year, today.month)
    target = goal["target_amount"]
    progress = max(0, min(current - goal["start_balance"], target))
    pct = round(progress / target * 100) if target else 0

    item = dict(goal)
    item["current_balance"] = current
    item["progress"] = progress
    item["pct"] = pct
    item["remaining"] = max(target - progress, 0)
    item["achieved"] = progress >= target

    # months left until target_date (inclusive of current month)
    months_left = None
    if goal["target_date"]:
        try:
            ty, tm = int(goal["target_date"][:4]), int(goal["target_date"][5:7])
            months_left = max(0, (ty - today.year) * 12 + (tm - today.month))
        except (ValueError, IndexError):
            months_left = None
    item["months_left"] = months_left
    if months_left is not None and months_left > 0 and item["remaining"] > 0:
        import math
        item["monthly_needed"] = math.ceil(item["remaining"] / months_left)
    else:
        item["monthly_needed"] = None
    return item


def get_goals() -> list[dict]:
    from datetime import date
    today = date.today()
    with get_db() as conn:
        rows = conn.execute(
            "SELECT id, name, target_amount, account, start_balance, target_date, note, created_at FROM goals"
        ).fetchall()
        goals = [_goal_progress(conn, r) for r in rows]
        # incomplete first, closest deadline first, then newest
        goals.sort(key=lambda g: (g["achieved"], g["target_date"] or "9999-99-99", -g["id"]))
        total_target = sum(g["target_amount"] for g in goals)
        total_progress = sum(g["progress"] for g in goals)
        return {
            "goals": goals,
            "total_target": total_target,
            "total_progress": total_progress,
            "total_pct": round(total_progress / total_target * 100) if total_target else 0,
        }


def add_goal(data: dict) -> int:
    """Create a goal, snapshotting the account's current balance as start_balance."""
    from datetime import date
    today = date.today()
    with get_db() as conn:
        start_balance = _compute_balance(conn, data["account"], today.year, today.month)
        cur = conn.execute(
            """INSERT INTO goals (name, target_amount, account, start_balance, target_date, note)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (data["name"], int(data["target_amount"]), data["account"], start_balance,
             data.get("target_date") or None, data.get("note") or None),
        )
        conn.commit()
        return cur.lastrowid


def update_goal(item_id: int, data: dict) -> bool:
    """Update a goal. If the account changed, re-snapshot start_balance."""
    from datetime import date
    today = date.today()
    with get_db() as conn:
        row = conn.execute("SELECT * FROM goals WHERE id=?", (item_id,)).fetchone()
        if not row:
            return False
        account = data.get("account", row["account"])
        start_balance = row["start_balance"]
        if account != row["account"]:
            start_balance = _compute_balance(conn, account, today.year, today.month)
        cur = conn.execute(
            """UPDATE goals
               SET name=?, target_amount=?, account=?, start_balance=?, target_date=?, note=?
               WHERE id=?""",
            (data["name"], int(data["target_amount"]), account, start_balance,
             data.get("target_date") or None, data.get("note") or None, item_id),
        )
        conn.commit()
        return cur.rowcount > 0


def delete_goal(item_id: int) -> bool:
    with get_db() as conn:
        cur = conn.execute("DELETE FROM goals WHERE id=?", (item_id,))
        conn.commit()
        return cur.rowcount > 0
