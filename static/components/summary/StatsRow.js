import { html } from '/static/lib/html.js';
import { fmtRp } from '/static/lib/utils.js';

export function StatsRow({ data, account }) {
    const transfersOut = (data.transactions || [])
        .filter(t => t.is_exclude && !t.is_income)
        .reduce((sum, t) => sum + t.amount, 0);
    const surplus = Math.max(0, data.income - data.expense);
    const savings = transfersOut + surplus;
    const savingsRate = data.income > 0 ? ((savings / data.income) * 100).toFixed(1) : '0.0';
    const srColor = parseFloat(savingsRate) >= 0 ? '#9ece6a' : '#f7768e';
    const showSavingsRate = account !== 'house';

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
            ${showSavingsRate && html`
            <div class="stat">
                <div class="label">Savings Rate</div>
                <div class="value" style=${{ color: srColor }}>${savingsRate}%</div>
                ${transfersOut > 0 && html`<div class="stat-note">incl. ${fmtRp(transfersOut)} saved</div>`}
            </div>
            `}
        </div>
    `;
}
