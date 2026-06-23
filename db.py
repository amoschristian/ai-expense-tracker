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
            is_transfer BOOLEAN DEFAULT 0
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
            end_balance INTEGER,
            PRIMARY KEY (account, year, month)
        );

        CREATE INDEX IF NOT EXISTS idx_tx_ym ON transactions(year, month);
        CREATE INDEX IF NOT EXISTS idx_tx_account ON transactions(account);
        CREATE INDEX IF NOT EXISTS idx_tx_category ON transactions(category_id);
    """)
    # Add is_transfer column to existing DBs
    try:
        conn.execute("ALTER TABLE categories ADD COLUMN is_transfer BOOLEAN DEFAULT 0")
    except sqlite3.OperationalError:
        pass  # column already exists
    conn.close()


def seed_categories(conn: sqlite3.Connection) -> None:
    """Insert categories from config if not already present."""
    for name, color in CATEGORY_COLORS.items():
        is_income = 1 if name in INCOME_PARENTS else 0
        is_transfer = 1 if name in TRANSFER_PARENTS else 0
        conn.execute(
            "INSERT OR IGNORE INTO categories (name, parent, color, is_income, is_transfer) VALUES (?, ?, ?, ?, ?)",
            (name, name, color, is_income, is_transfer),
        )
    conn.commit()


def get_month_summary(account: str, year: int, month: int) -> dict | None:
    conn = get_conn()
    seed_categories(conn)

    row = conn.execute(
        "SELECT start_balance, end_balance FROM accounts WHERE account=? AND year=? AND month=?",
        (account, year, month),
    ).fetchone()
    if not row:
        conn.close()
        return None

    start_b = row["start_balance"] or 0
    end_b = row["end_balance"] or 0

    incomes = conn.execute(
        "SELECT SUM(amount) as total FROM transactions t JOIN categories c ON t.category_id=c.id WHERE account=? AND year=? AND month=? AND c.is_income=1",
        (account, year, month),
    ).fetchone()
    expenses = conn.execute(
        "SELECT SUM(amount) as total FROM transactions t JOIN categories c ON t.category_id=c.id WHERE account=? AND year=? AND month=? AND c.is_income=0",
        (account, year, month),
    ).fetchone()

    total_in = incomes["total"] or 0
    total_out = expenses["total"] or 0

    cats = conn.execute(
        """SELECT c.name, c.color, SUM(t.amount) as total
           FROM transactions t JOIN categories c ON t.category_id=c.id
           WHERE t.account=? AND t.year=? AND t.month=? AND c.is_income=0
             AND c.parent != 'Transfer'
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
        "end": end_b,
        "income": total_in,
        "expense": total_out,
        "net": total_in - total_out,
        "categories": cat_list,
    }


def get_transactions(account: str, year: int, month: int) -> list[dict]:
    conn = get_conn()
    rows = conn.execute(
        """SELECT t.date, c.name as category, c.color, c.is_income, t.amount, t.description
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
             AND (t.year * 100 + t.month) BETWEEN ? AND ?
           GROUP BY t.year, t.month
           ORDER BY t.year, t.month""",
        (account, (year - 1) * 100 + month, year * 100 + month),
    ).fetchall()
    conn.close()
    return [{"name": MONTHS[r["month"] - 1], "net": r["net"]} for r in rows]


def get_balance(account: str) -> dict | None:
    conn = get_conn()
    row = conn.execute(
        """SELECT account, year, month, end_balance
           FROM accounts
           WHERE account=? AND end_balance IS NOT NULL
           ORDER BY year DESC, month DESC
           LIMIT 1""",
        (account,),
    ).fetchone()
    conn.close()
    if not row:
        return None
    return {
        "account": row["account"],
        "balance": row["end_balance"],
        "year": row["year"],
        "month": row["month"],
    }


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
        "SELECT id, name, parent, color, is_income, is_transfer FROM categories ORDER BY name"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]
