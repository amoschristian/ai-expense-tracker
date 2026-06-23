from __future__ import annotations

import os

from flask import Flask, jsonify, request, send_from_directory

from config import MONTHS
from db import (
    get_accounts,
    get_balance,
    get_categories,
    get_conn,
    get_month_summary,
    get_trend,
    get_transactions,
    init_db,
)

app = Flask(__name__, static_folder="static")


@app.route("/")
def index():
    return send_from_directory("static", "index.html")


@app.route("/static/<path:path>")
def static_files(path):
    return send_from_directory("static", path)


@app.route("/api/accounts")
def api_accounts():
    return jsonify(get_accounts())


@app.route("/api/categories")
def api_categories():
    return jsonify(get_categories())


@app.route("/api/month")
def api_month():
    account = request.args.get("account", "bca")
    year = int(request.args.get("year", MONTHS.__len__()))
    month = int(request.args.get("month", 1))

    summary = get_month_summary(account, year, month)
    if not summary:
        return jsonify({"error": "no data"}), 404

    txns = get_transactions(account, year, month)
    summary["transactions"] = txns
    return jsonify(summary)


@app.route("/api/trend")
def api_trend():
    account = request.args.get("account", "bca")
    year = int(request.args.get("year", 2026))
    month = int(request.args.get("month", 6))
    return jsonify({"months": get_trend(account, year, month)})


@app.route("/api/balance")
def api_balance():
    account = request.args.get("account", "bca")
    bal = get_balance(account)
    if not bal:
        return jsonify({"error": "no data"}), 404
    return jsonify(bal)


@app.route("/api/transaction", methods=["POST"])
def api_add_transaction():
    data = request.get_json()
    required = ["date", "category", "amount", "account"]
    missing = [f for f in required if f not in data]
    if missing:
        return jsonify({"error": f"missing fields: {', '.join(missing)}"}), 400

    date_str = data["date"]
    category = data["category"]
    amount = int(data["amount"])
    account = data["account"]
    description = data.get("description", "")

    try:
        y, m = int(date_str[:4]), int(date_str[5:7])
    except (ValueError, IndexError):
        return jsonify({"error": "date must be YYYY-MM-DD"}), 400

    conn = get_conn()
    seed_categories(conn)
    row = conn.execute("SELECT id FROM categories WHERE name=?", (category,)).fetchone()
    if not row:
        conn.close()
        return jsonify({"error": f"unknown category: {category}"}), 400
    category_id = row["id"]

    conn.execute(
        "INSERT INTO transactions (date, category_id, amount, description, account, year, month) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (date_str, category_id, amount, description, account, y, m),
    )
    conn.commit()
    conn.close()
    return jsonify({"ok": True, "date": date_str, "category": category, "amount": amount, "account": account})


if __name__ == "__main__":
    init_db()
    debug = os.environ.get("FLASK_DEBUG", "true").lower() in ("true", "1", "yes")
    port = int(os.environ.get("FLASK_PORT", "5000"))
    app.run(host="0.0.0.0", port=port, debug=debug)
