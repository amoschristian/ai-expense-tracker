from __future__ import annotations

import os
import secrets
from datetime import date
from functools import wraps

from flask import Flask, jsonify, request, send_from_directory, session

from config import MONTHS, MORTGAGE
from db import (
    add_recurring_expense,
    delete_recurring_expense,
    ensure_account,
    get_accounts,
    get_balance,
    get_categories,
    get_category_id,
    get_month_end_balance,
    get_month_summary,
    get_recurring_expense,
    get_recurring_expenses,
    get_trend,
    get_transactions,
    init_db,
    set_balance,
    update_recurring_expense,
)
from db import get_db

app = Flask(__name__, static_folder="static")
app.secret_key = os.environ.get("FLASK_SECRET_KEY", secrets.token_hex(32))


def csrf_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        token = request.headers.get("X-CSRF-Token", "")
        expected = session.get("csrf_token")
        if not expected or not secrets.compare_digest(token, expected):
            return jsonify({"error": "invalid CSRF token"}), 403
        return f(*args, **kwargs)
    return wrapper


@app.route("/")
def index():
    return send_from_directory("static", "index.html")


@app.route("/sw.js")
def service_worker():
    return send_from_directory("static", "sw.js")


@app.route("/static/<path:path>")
def static_files(path):
    return send_from_directory("static", path)


@app.route("/api/csrf-token")
def api_csrf_token():
    if "csrf_token" not in session:
        session["csrf_token"] = secrets.token_hex(32)
    return jsonify({"token": session["csrf_token"]})


@app.route("/api/accounts")
def api_accounts():
    return jsonify(get_accounts())


@app.route("/api/categories")
def api_categories():
    return jsonify(get_categories())


@app.route("/api/month")
def api_month():
    account = request.args.get("account", "bca")
    year = int(request.args.get("year", date.today().year))
    month = int(request.args.get("month", date.today().month))

    summary = get_month_summary(account, year, month)
    if not summary:
        return jsonify({"error": "no data"}), 404

    txns = get_transactions(account, year, month)
    summary["transactions"] = txns
    return jsonify(summary)


@app.route("/api/trend")
def api_trend():
    account = request.args.get("account", "bca")
    year = int(request.args.get("year", date.today().year))
    month = int(request.args.get("month", date.today().month))
    return jsonify({"months": get_trend(account, year, month)})


@app.route("/api/balance")
def api_balance():
    account = request.args.get("account", "bca")
    bal = get_balance(account)
    if not bal:
        return jsonify({"error": "no data"}), 404
    return jsonify(bal)


@app.route("/api/balance", methods=["POST"])
@csrf_required
def api_set_balance():
    data = request.get_json()
    required = ["account", "balance"]
    missing = [f for f in required if f not in data]
    if missing:
        return jsonify({"error": f"missing fields: {', '.join(missing)}"}), 400
    set_balance(data["account"], int(data["balance"]))
    return jsonify({"ok": True})


@app.route("/api/transaction", methods=["POST"])
@csrf_required
def api_add_transaction():
    data = request.get_json()
    required = ["date", "category", "amount", "account"]
    missing = [f for f in required if f not in data]
    if missing:
        return jsonify({"error": f"missing fields: {', '.join(missing)}"}), 400

    date_str = data["date"]
    category = data["category"]
    amount = int(data["amount"])
    account = data["account"].lower()
    description = data.get("description", "")

    if amount <= 0 or amount > 999_999_999:
        return jsonify({"error": "amount must be between 1 and 999,999,999"}), 400

    try:
        y, m = int(date_str[:4]), int(date_str[5:7])
    except (ValueError, IndexError):
        return jsonify({"error": "date must be YYYY-MM-DD"}), 400

    with get_db() as conn:
        cat_id = get_category_id(conn, category)
        if not cat_id:
            return jsonify({"error": f"unknown category: {category}"}), 400
        ensure_account(account)

        conn.execute(
            "INSERT INTO transactions (date, category_id, amount, description, account, year, month) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (date_str, cat_id, amount, description, account, y, m),
        )
        conn.commit()
    return jsonify({"ok": True, "date": date_str, "category": category, "amount": amount, "account": account})


@app.route("/api/transactions/search")
def api_search_transactions():
    q = request.args.get("q", "")
    account = request.args.get("account", "")
    limit = int(request.args.get("limit", 50))

    if not q:
        return jsonify([])

    conditions = ["t.description LIKE ?"]
    params = [f"%{q}%"]

    if account:
        conditions.append("t.account = ?")
        params.append(account)

    params.append(str(limit))

    with get_db() as conn:
        rows = conn.execute(
            f"""SELECT t.id, t.date, t.account, c.name as category, c.color, t.amount, t.description
                FROM transactions t JOIN categories c ON t.category_id=c.id
                WHERE {' AND '.join(conditions)}
                ORDER BY t.date DESC
                LIMIT ?""",
            params,
        ).fetchall()
        return jsonify([dict(r) for r in rows])


@app.route("/api/transaction/<int:tx_id>", methods=["PUT"])
@csrf_required
def api_update_transaction(tx_id):
    data = request.get_json()
    required = ["category", "amount"]
    missing = [f for f in required if f not in data]
    if missing:
        return jsonify({"error": f"missing fields: {', '.join(missing)}"}), 400

    category = data["category"]
    amount = int(data["amount"])
    description = data.get("description", "")
    date_str = data.get("date", "")

    if amount <= 0 or amount > 999_999_999:
        return jsonify({"error": "amount must be between 1 and 999,999,999"}), 400

    with get_db() as conn:
        existing = conn.execute("SELECT id FROM transactions WHERE id=?", (tx_id,)).fetchone()
        if not existing:
            return jsonify({"error": "transaction not found"}), 404
        cat_id = get_category_id(conn, category)
        if not cat_id:
            return jsonify({"error": f"unknown category: {category}"}), 400

        if date_str:
            try:
                y, m = int(date_str[:4]), int(date_str[5:7])
            except (ValueError, IndexError):
                return jsonify({"error": "date must be YYYY-MM-DD"}), 400
            conn.execute(
                "UPDATE transactions SET date=?, category_id=?, amount=?, description=?, year=?, month=? WHERE id=?",
                (date_str, cat_id, amount, description, y, m, tx_id),
            )
        else:
            conn.execute(
                "UPDATE transactions SET category_id=?, amount=?, description=? WHERE id=?",
                (cat_id, amount, description, tx_id),
            )
        conn.commit()
    return jsonify({"ok": True})


@app.route("/api/transaction/<int:tx_id>", methods=["DELETE"])
@csrf_required
def api_delete_transaction(tx_id):
    with get_db() as conn:
        existing = conn.execute("SELECT id FROM transactions WHERE id=?", (tx_id,)).fetchone()
        if not existing:
            return jsonify({"error": "transaction not found"}), 404
        conn.execute("DELETE FROM transactions WHERE id=?", (tx_id,))
        conn.commit()
    return jsonify({"ok": True})


@app.route("/api/mortgage")
def api_mortgage():
    with get_db() as conn:
        current_year = date.today().year
        rows = conn.execute(
            """SELECT t.date, t.amount, t.description
               FROM transactions t JOIN categories c ON t.category_id=c.id
               WHERE t.account='house' AND c.name='Housing:Mortgage' AND t.year=?
               ORDER BY t.date DESC""",
            (current_year,)
        ).fetchall()
        payments = [dict(r) for r in rows]

        all_rows = conn.execute(
            """SELECT SUM(t.amount) as total, COUNT(*) as count
               FROM transactions t JOIN categories c ON t.category_id=c.id
               WHERE t.account='house' AND c.name='Housing:Mortgage'"""
        ).fetchone()
        total_paid = all_rows["total"] or 0
        payments_count = all_rows["count"] or 0

        house_bal = get_balance('house')
        house_balance = house_bal["balance"] if house_bal else 0

        txns = conn.execute(
            """SELECT t.amount, c.is_income
               FROM transactions t JOIN categories c ON t.category_id=c.id
               WHERE t.account='house' AND c.is_exclude=0"""
        ).fetchall()
        total_in = sum(t["amount"] for t in txns if t["is_income"])
        total_out = sum(t["amount"] for t in txns if not t["is_income"])

    return jsonify({
        "payments": payments,
        "total_paid": total_paid,
        "monthly_payment": payments[0]["amount"] if payments else 0,
        "payments_count": payments_count,
        "house_balance": house_balance,
        "total_in": total_in,
        "total_out": total_out,
        "original_loan": MORTGAGE["original_loan"],
        "start_date": MORTGAGE["start_date"],
        "rate_schedule": MORTGAGE["rate_schedule"],
        "tenor": MORTGAGE["tenor"],
    })


@app.route("/api/recurring")
def api_recurring_list():
    return jsonify(get_recurring_expenses())


@app.route("/api/recurring", methods=["POST"])
@csrf_required
def api_recurring_add():
    data = request.get_json()
    required = ["name", "amount", "category", "account", "start_date"]
    missing = [f for f in required if f not in data]
    if missing:
        return jsonify({"error": f"missing fields: {', '.join(missing)}"}), 400

    item_id = add_recurring_expense(data)
    if item_id < 0:
        return jsonify({"error": f"unknown category: {data['category']}"}), 400
    return jsonify({"ok": True, "id": item_id})


@app.route("/api/recurring/<int:item_id>", methods=["PUT"])
@csrf_required
def api_recurring_update(item_id):
    data = request.get_json()
    required = ["name", "amount", "category", "account", "start_date"]
    missing = [f for f in required if f not in data]
    if missing:
        return jsonify({"error": f"missing fields: {', '.join(missing)}"}), 400

    ok = update_recurring_expense(item_id, data)
    if not ok:
        return jsonify({"error": "not found or unknown category"}), 404
    return jsonify({"ok": True})


@app.route("/api/recurring/<int:item_id>", methods=["PATCH"])
@csrf_required
def api_recurring_patch(item_id):
    existing = get_recurring_expense(item_id)
    if not existing:
        return jsonify({"error": "not found"}), 404

    data = request.get_json()
    merged = {**existing, **data}
    merged.pop("id", None)
    merged.pop("color", None)
    merged["category"] = data.get("category", existing["category"])

    ok = update_recurring_expense(item_id, merged)
    if not ok:
        return jsonify({"error": "update failed or unknown category"}), 400
    return jsonify({"ok": True})


@app.route("/api/recurring/<int:item_id>", methods=["DELETE"])
@csrf_required
def api_recurring_delete(item_id):
    deleted = delete_recurring_expense(item_id)
    if not deleted:
        return jsonify({"error": "not found"}), 404
    return jsonify({"ok": True})


if __name__ == "__main__":
    init_db()
    debug = os.environ.get("FLASK_DEBUG", "true").lower() in ("true", "1", "yes")
    port = int(os.environ.get("FLASK_PORT", "5000"))
    app.run(host="0.0.0.0", port=port, debug=debug)
