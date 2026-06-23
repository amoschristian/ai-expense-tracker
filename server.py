from __future__ import annotations

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
    is_income = 1 if data.get("is_income", False) else 0

    try:
        y, m = int(date_str[:4]), int(date_str[5:7])
    except (ValueError, IndexError):
        return jsonify({"error": "date must be YYYY-MM-DD"}), 400

    conn = get_conn()
    conn.execute(
        "INSERT INTO transactions (date, category, amount, description, account, is_income, year, month) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (date_str, category, amount, description, account, is_income, y, m),
    )
    conn.commit()
    conn.close()
    return jsonify({"ok": True, "date": date_str, "category": category, "amount": amount, "account": account})


if __name__ == "__main__":
    init_db()
    app.run(host="0.0.0.0", port=5000, debug=True)
