from __future__ import annotations

import re
from pathlib import Path

from config import ACCOUNTS, CATEGORY_COLORS, EXPENSES_ROOT, INCOME_PARENTS, MONTHS, TRANSFER_PARENTS
from db import get_conn, init_db, seed_categories


def parse_month_file(filepath: Path) -> dict | None:
    content = filepath.read_text()

    m = re.search(r"start_balance:\s*(\d+)", content)
    start_b = int(m.group(1)) if m else None
    m = re.search(r"end_balance:\s*(\d+)", content)
    end_b = int(m.group(1)) if m else None

    entries = []
    for line in content.splitlines():
        line = line.strip()
        if not line.startswith("|") or line.startswith("|---"):
            continue
        parts = [p.strip() for p in line.split("|")]
        if len(parts) < 4:
            continue
        if not re.match(r"\d{4}-\d{2}-\d{2}", parts[1]):
            continue
        try:
            amt = int(parts[3].replace(",", ""))
        except ValueError:
            continue
        cat = parts[2]
        desc = parts[4] if len(parts) > 4 else ""
        entries.append((parts[1], cat, amt, desc))

    return {
        "start_balance": start_b,
        "end_balance": end_b,
        "entries": entries,
    }


def ensure_category(conn, cat_name: str) -> int:
    """Get or create category, return its id."""
    row = conn.execute("SELECT id FROM categories WHERE name=?", (cat_name,)).fetchone()
    if row:
        return row["id"]

    parent = cat_name.split(":")[0] if ":" in cat_name else cat_name
    color = CATEGORY_COLORS.get(parent, "#a9b1d6")
    is_income = 1 if parent in INCOME_PARENTS else 0
    is_transfer = 1 if parent in TRANSFER_PARENTS else 0

    conn.execute(
        "INSERT INTO categories (name, parent, color, is_income, is_transfer) VALUES (?, ?, ?, ?, ?)",
        (cat_name, parent, color, is_income, is_transfer),
    )
    return conn.execute("SELECT id FROM categories WHERE name=?", (cat_name,)).fetchone()["id"]


def migrate_account(account_id: str, account_dir: str) -> int:
    root = EXPENSES_ROOT / account_dir
    if not root.exists():
        print(f"  Directory not found: {root}")
        return 0

    conn = get_conn()
    seed_categories(conn)
    count = 0

    for year_dir in sorted(root.iterdir()):
        if not year_dir.is_dir():
            continue
        try:
            year = int(year_dir.name)
        except ValueError:
            continue

        for md_file in sorted(year_dir.glob("*.md")):
            m = re.match(r"(\d{2})\s*-\s*\w+\s+(\d{4})", md_file.name)
            if not m:
                continue
            month = int(m.group(1))

            data = parse_month_file(md_file)
            if not data:
                continue

            conn.execute(
                """INSERT OR REPLACE INTO accounts (account, year, month, start_balance, end_balance)
                   VALUES (?, ?, ?, ?, ?)""",
                (account_id, year, month, data["start_balance"], data["end_balance"]),
            )

            for date_str, cat, amt, desc in data["entries"]:
                category_id = ensure_category(conn, cat)
                conn.execute(
                    """INSERT INTO transactions (date, category_id, amount, description, account, year, month)
                       VALUES (?, ?, ?, ?, ?, ?, ?)""",
                    (date_str, category_id, amt, desc, account_id, year, month),
                )
                count += 1

    conn.commit()
    conn.close()
    return count


def main() -> None:
    print("Initializing database...")
    init_db()

    conn = get_conn()
    conn.execute("DELETE FROM transactions")
    conn.execute("DELETE FROM accounts")
    conn.execute("DELETE FROM categories")
    conn.commit()
    conn.close()

    total = 0
    for account_id, info in ACCOUNTS.items():
        print(f"Migrating {info['name']} ({account_id})...")
        n = migrate_account(account_id, info["dir"])
        print(f"  {n} transactions")
        total += n

    print(f"Done. {total} total transactions imported.")


if __name__ == "__main__":
    main()
