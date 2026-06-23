import { html } from '/static/lib/html.js';
import { MONTHS } from '/static/lib/utils.js';

export function Header({ year, month, account, accounts, onPrev, onNext, onAccountChange, showAccount }) {
    return html`
        <header>
            <div class="header-row">
                <button class="nav-btn" onClick=${onPrev}>‹</button>
                <h1>${MONTHS[month - 1]} ${year}</h1>
                <button class="nav-btn" onClick=${onNext}>›</button>
            </div>
            ${showAccount !== false && html`
                <select class="account-select" value=${account} onChange=${e => onAccountChange(e.target.value)}>
                    ${accounts.map(a => html`<option key=${a.id} value=${a.id}>${a.id.toUpperCase()}</option>`)}
                </select>
            `}
        </header>
    `;
}
