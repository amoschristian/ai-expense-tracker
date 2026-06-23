import { html } from '/static/lib/html.js';
import { fmtRp } from '/static/lib/utils.js';

export function StatsRow({ data }) {
    const netTransfers = (data.transactions || [])
        .filter(t => t.is_transfer)
        .reduce((sum, t) => sum + (t.is_income ? -t.amount : t.amount), 0);
    const savings = data.net + netTransfers;
    const savingsRate = data.income > 0 ? ((savings / data.income) * 100).toFixed(1) : '0.0';
    const srColor = parseFloat(savingsRate) >= 0 ? '#9ece6a' : '#f7768e';

    return html`
        <div class="stats-row">
            <div class="stat">
                <div class="label">Income</div>
                <div class="value green">${fmtRp(data.income)}</div>
            </div>
            <div class="stat">
                <div class="label">Expense</div>
                <div class="value red">${fmtRp(data.expense)}</div>
            </div>
            <div class="stat">
                <div class="label">Savings Rate</div>
                <div class="value" style=${{ color: srColor }}>${savingsRate}%</div>
                ${netTransfers > 0 && html`<div class="stat-note">incl. ${fmtRp(netTransfers)} transfer</div>`}
            </div>
        </div>
    `;
}
