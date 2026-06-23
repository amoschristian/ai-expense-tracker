import { html } from '/static/lib/html.js';
import { fmtRp } from '/static/lib/utils.js';

export function BalanceCard({ balance }) {
    const balanceStr = balance ? fmtRp(balance.balance) : '—';
    return html`
        <div class="card balance-card">
            <div class="label">Current Balance</div>
            <div class="value">${balanceStr}</div>
        </div>
    `;
}
