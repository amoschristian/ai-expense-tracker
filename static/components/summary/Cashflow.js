import { html } from '/static/lib/html.js';
import { MONTHS, fmtRp } from '/static/lib/utils.js';

export function Cashflow({ data }) {
    if (!data || !data.transactions || !data.transactions.length) {
        return html`<div class="card"><div class="card-title">Cashflow</div><div class="empty">No data</div></div>`;
    }

    const year = new Date(data.transactions[0].date + 'T00:00:00').getFullYear();
    const month = new Date(data.transactions[0].date + 'T00:00:00').getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();

    // Aggregate daily income and expenses
    const dailyIncome = {};
    const dailyExpense = {};
    data.transactions.forEach(t => {
        const key = t.date;
        if (t.is_income) {
            dailyIncome[key] = (dailyIncome[key] || 0) + t.amount;
        } else {
            dailyExpense[key] = (dailyExpense[key] || 0) + t.amount;
        }
    });

    // Fill all days
    const incomePoints = [];
    const expensePoints = [];
    for (let d = 1; d <= lastDay; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        incomePoints.push(dailyIncome[dateStr] || 0);
        expensePoints.push(dailyExpense[dateStr] || 0);
    }

    const allVals = [...incomePoints, ...expensePoints];
    const maxVal = Math.max(...allVals, 1);

    // SVG
    const w = 300, h = 80, pad = 4;
    function toPath(values) {
        return values.map((v, i) => {
            const x = pad + (i / (values.length - 1)) * (w - pad * 2);
            const y = pad + (1 - v / maxVal) * (h - pad * 2);
            return `${x},${y}`;
        });
    }

    const incomePath = 'M' + toPath(incomePoints).join(' L');
    const expensePath = 'M' + toPath(expensePoints).join(' L');

    return html`
        <div class="card">
            <div class="card-title">Cashflow</div>
            <div class="cashflow-legend">
                <span class="cashflow-legend-item"><span class="cashflow-dot" style="background:#9ece6a"></span>Income</span>
                <span class="cashflow-legend-item"><span class="cashflow-dot" style="background:#f7768e"></span>Expense</span>
            </div>
            <svg class="cashflow-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
                <path d=${incomePath} fill="none" stroke="#9ece6a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                <path d=${expensePath} fill="none" stroke="#f7768e" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <div class="cashflow-labels">
                <span>1</span>
                <span>${MONTHS[month]}</span>
                <span>${lastDay}</span>
            </div>
        </div>
    `;
}
