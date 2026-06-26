from __future__ import annotations

import sqlite3
from pathlib import Path

from config import CATEGORY_COLORS, INCOME_PARENTS, MONTHS, TRANSFER_PARENTS

DB_PATH = Path(__file__).parent / "data" / "expenses.db"


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    conn = get_conn()
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
            account TEXT NOT NULL,
            year INTEGER NOT NULL,
            month INTEGER NOT NULL,
            start_balance INTEGER,
            PRIMARY KEY (account, year, month)
        );

        CREATE INDEX IF NOT EXISTS idx_tx_ym ON transactions(year, month);
        CREATE INDEX IF NOT EXISTS idx_tx_account ON transactions(account);
        CREATE INDEX IF NOT EXISTS idx_tx_category ON transactions(category_id);

        CREATE TABLE IF NOT EXISTS recurring_expenses (
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
    """)
    conn.close()


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




def get_month_summary(account: str, year: int, month: int) -> dict | None:
    conn = get_conn()
    seed_categories(conn)

    row = conn.execute(
        "SELECT start_balance FROM accounts WHERE account=? AND year=? AND month=?",
        (account, year, month),
    ).fetchone()
    if not row:
        conn.close()
        return None

    start_b = row["start_balance"] or 0

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

    conn.close()
    return {
        "name": f"{MONTHS[month - 1]} {year}",
        "start": start_b,
        "end": start_b + total_in - total_out,
        "income": total_in,
        "expense": total_out,
        "net": total_in - total_out,
        "categories": cat_list,
    }


def get_transactions(account: str, year: int, month: int) -> list[dict]:
    conn = get_conn()
    rows = conn.execute(
        """SELECT t.id, t.date, t.account, c.name as category, c.color, c.is_income, c.is_exclude, t.amount, t.description
          FROM transactions t JOIN categories c ON t.category_id=c.id
          WHERE t.account=? AND t.year=? AND t.month=?
          ORDER BY t.date DESC, t.id""",
        (account, year, month),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_trend(account: str, year: int, month: int) -> list[dict]:
    conn = get_conn()
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
    conn.close()
    return [{"name": MONTHS[r["month"] - 1], "net": r["net"]} for r in rows]


def get_balance(account: str) -> dict | None:
    """Get current balance by computing from first month's start_balance + all transactions."""
    conn = get_conn()
    
    # Find the earliest month
    anchor = conn.execute(
        """SELECT year, month, start_balance
           FROM accounts
           WHERE account=?
           ORDER BY year, month
           LIMIT 1""",
        (account,),
    ).fetchone()
    if not anchor:
        conn.close()
        return None
    
    anchor_y, anchor_m = anchor["year"], anchor["month"]
    start_b = anchor["start_balance"] or 0
    
    # Sum ALL transactions from that month onward
    result = conn.execute(
        """SELECT
             SUM(CASE WHEN c.is_income=1 THEN t.amount ELSE 0 END) -
             SUM(CASE WHEN c.is_income=0 THEN t.amount ELSE 0 END) as net
           FROM transactions t JOIN categories c ON t.category_id=c.id
           WHERE t.account=?
             AND (t.year * 100 + t.month) >= ?""",
        (account, anchor_y * 100 + anchor_m),
    ).fetchone()
    net = result["net"] or 0
    
    # Latest month for display
    latest = conn.execute(
        """SELECT year, month FROM accounts
           WHERE account=? ORDER BY year DESC, month DESC LIMIT 1""",
        (account,),
    ).fetchone()
    
    conn.close()
    return {
        "account": account,
        "balance": start_b + net,
        "year": latest["year"],
        "month": latest["month"],
    }


def set_balance(account: str, year: int, month: int, balance: int) -> None:
    """Set the bank-confirmed current balance. Computes the correct start_balance for the first month."""
    conn = get_conn()
    
    # Find the earliest month
    first = conn.execute(
        "SELECT year, month FROM accounts WHERE account=? ORDER BY year, month LIMIT 1",
        (account,),
    ).fetchone()
    
    if first:
        # Sum all transactions from first month to the confirmed month
        result = conn.execute(
            """SELECT
                 SUM(CASE WHEN c.is_income=1 THEN t.amount ELSE 0 END) -
                 SUM(CASE WHEN c.is_income=0 THEN t.amount ELSE 0 END) as net
               FROM transactions t JOIN categories c ON t.category_id=c.id
               WHERE t.account=?
                 AND (t.year * 100 + t.month) >= ?
                 AND (t.year * 100 + t.month) <= ?""",
            (account, first["year"] * 100 + first["month"], year * 100 + month),
        ).fetchone()
        net = result["net"] or 0
        
        # start_balance = current_balance - net_transactions
        correct_start = balance - net
        
        # Update the first month's start_balance
        conn.execute(
            "UPDATE accounts SET start_balance=? WHERE account=? AND year=? AND month=?",
            (correct_start, account, first["year"], first["month"]),
        )
    
    conn.commit()
    conn.close()


def get_accounts() -> list[dict]:
    conn = get_conn()
    rows = conn.execute(
        """SELECT DISTINCT account FROM accounts ORDER BY account"""
    ).fetchall()
    conn.close()
    return [{"id": r["account"]} for r in rows]


def get_categories() -> list[dict]:
    conn = get_conn()
    seed_categories(conn)
    rows = conn.execute(
        "SELECT id, name, parent, color, is_income, is_exclude FROM categories ORDER BY name"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_recurring_expenses() -> list[dict]:
    conn = get_conn()
    rows = conn.execute(
        """SELECT r.id, r.name, r.amount, r.account, r.frequency,
                  r.day_of_month, r.start_date, r.end_date,
                  c.name as category, c.color
           FROM recurring_expenses r
           LEFT JOIN categories c ON r.category_id = c.id
           ORDER BY r.name"""
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def add_recurring_expense(data: dict) -> int:
    conn = get_conn()
    seed_categories(conn)
    row = conn.execute("SELECT id FROM categories WHERE name=?", (data["category"],)).fetchone()
    if not row:
        conn.close()
        return -1
    cur = conn.execute(
        """INSERT INTO recurring_expenses
           (name, amount, category_id, account, frequency, day_of_month, start_date, end_date)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (data["name"], int(data["amount"]), row["id"], data["account"],
         data.get("frequency", "monthly"), data.get("day_of_month"),
         data["start_date"], data.get("end_date")),
    )
    conn.commit()
    item_id = cur.lastrowid
    conn.close()
    return item_id


def update_recurring_expense(item_id: int, data: dict) -> bool:
    conn = get_conn()
    seed_categories(conn)
    row = conn.execute("SELECT id FROM categories WHERE name=?", (data["category"],)).fetchone()
    if not row:
        conn.close()
        return False
    cur = conn.execute(
        """UPDATE recurring_expenses
           SET name=?, amount=?, category_id=?, account=?, frequency=?,
               day_of_month=?, start_date=?, end_date=?
           WHERE id=?""",
        (data["name"], int(data["amount"]), row["id"], data["account"],
         data.get("frequency", "monthly"), data.get("day_of_month"),
         data["start_date"], data.get("end_date"), item_id),
    )
    conn.commit()
    updated = cur.rowcount > 0
    conn.close()
    return updated


def delete_recurring_expense(item_id: int) -> bool:
    conn = get_conn()
    cur = conn.execute("DELETE FROM recurring_expenses WHERE id=?", (item_id,))
    conn.commit()
    deleted = cur.rowcount > 0
    conn.close()
    return deleted
