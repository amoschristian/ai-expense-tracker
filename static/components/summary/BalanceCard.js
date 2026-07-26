import { html } from '/static/lib/html.js';
import { fmtRp } from '/static/lib/utils.js';

function fmtDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
}

export function BalanceCard({ balance }) {
    const balanceStr = balance ? fmtRp(balance.balance) : '—';
    const lastDate = balance && balance.latest_date ? fmtDate(balance.latest_date) : null;
    return html`
        <div class="card balance-card">
            <div class="label">Current Balance</div>
            <div class="value">${balanceStr}</div>
            ${lastDate && html`<div class="balance-last-date">Last transaction: ${lastDate}</div>`}
        </div>
    `;
}
