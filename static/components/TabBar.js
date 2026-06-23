import { html } from '/static/lib/html.js';

const icons = {
    summary: html`<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="7" height="7" rx="1.5"/><rect x="11" y="2" width="7" height="7" rx="1.5"/><rect x="2" y="11" width="7" height="7" rx="1.5"/><rect x="11" y="11" width="7" height="7" rx="1.5"/></svg>`,
    transactions: html`<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><line x1="3" y1="5" x2="17" y2="5"/><line x1="3" y1="10" x2="17" y2="10"/><line x1="3" y1="15" x2="12" y2="15"/></svg>`,
    mortgage: html`<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 10L10 3l8 7"/><path d="M4 9v7a1 1 0 001 1h10a1 1 0 001-1V9"/></svg>`,
    recurring: html`<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3v4h-4"/><path d="M3 17v-4h4"/><path d="M16.5 7A7.5 7.5 0 004 5.5l-1 1.5"/><path d="M3.5 13a7.5 7.5 0 0012.5 1.5l1-1.5"/></svg>`,
};

const labels = { summary: 'Summary', transactions: 'Transactions', mortgage: 'Mortgage', recurring: 'Recurring' };

export function TabBar({ active, onChange }) {
    const tabs = ['summary', 'transactions', 'mortgage', 'recurring'];
    return html`
        <nav id="tab-bar">
            ${tabs.map(t => html`
                <button
                    key=${t}
                    class=${'tab' + (active === t ? ' active' : '')}
                    onClick=${() => onChange(t)}
                >
                    <span class="tab-icon">${icons[t]}</span>
                    <span class="tab-label">${labels[t]}</span>
                </button>
            `)}
        </nav>
    `;
}
