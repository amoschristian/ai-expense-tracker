from __future__ import annotations

from pathlib import Path


EXPENSES_ROOT = Path.home() / "Obsidian" / "Expenses"
MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split()

R = "#f7768e"
G = "#9ece6a"
D = "#565f89"
B = "#7aa2f7"
C = "#7dcfff"
O = "#e0af68"
P = "#bb9af7"
T = "#a9b1d6"
S = "#24283b"
BG = "#1a1b26"

CATEGORY_COLORS = {
    "Food": R,
    "Transport": C,
    "Bills": O,
    "Housing": B,
    "Vehicle": O,
    "Shopping": P,
    "Entertainment": P,
    "Health": R,
    "Administration": D,
    "Insurance": D,
    "Income": G,
    "Transfer": D,
    "Business": C,
    "Investment": G,
    "Personal": T,
    "Technology": B,
    "Other": D,
}

INCOME_PARENTS = {"Income", "Investment"}
TRANSFER_PARENTS = {"Transfer"}

ACCOUNTS = {
    "bca": {"name": "BCA", "dir": "bca"},
    "house": {"name": "CIMB Niaga", "dir": "house"},
}
