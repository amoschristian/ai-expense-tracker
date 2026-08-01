import { html } from '/static/lib/html.js';
import { fmtRp } from '/static/lib/utils.js';

export function FoodBudget({ transactions }) {
    const txns = transactions || [];
    let allowance = 0, spent = 0, refunds = 0;

    txns.forEach(t => {
        if (t.category === 'Food:Allowance') {
            allowance += t.amount;
        } else if (t.category === 'Food:Refund') {
            refunds += t.amount;
        } else if (t.category && t.category.startsWith('Food:')) {
            spent += t.amount;
        }
    });

    // No food activity this month — don't render the widget
    if (allowance === 0 && spent === 0 && refunds === 0) return null;

    // Net used: allowance is booked as spend; refunds reduce it
    const netUsed = allowance + spent - refunds;
    const diff = allowance - netUsed;   // + = under (refundable), - = over
    const over = diff < 0;
    const statusColor = over ? '#f7768e' : '#9ece6a';
    const statusText = over
        ? `Over budget by ${fmtRp(Math.abs(diff))}`
        : (diff > 0 ? `Refund ${fmtRp(diff)}` : 'On budget');

    return html`
        <div class="card food-budget-card">
            <div class="card-title">Food Budget</div>
            <div class="food-budget-row">
                <div class="food-budget-label">Allowance</div>
                <div class="food-budget-value">${fmtRp(allowance)}</div>
            </div>
            <div class="food-budget-row">
                <div class="food-budget-label">Spent</div>
                <div class="food-budget-value">${fmtRp(spent)}</div>
            </div>
            ${refunds > 0 && html`
            <div class="food-budget-row">
                <div class="food-budget-label">Refunded</div>
                <div class="food-budget-value green">−${fmtRp(refunds)}</div>
            </div>
            `}
            <div class="food-budget-status" style=${{ color: statusColor }}>
                ${statusText}
            </div>
        </div>
    `;
}
