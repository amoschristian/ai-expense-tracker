import { useState } from 'https://esm.sh/preact@10.25.4/hooks';
import { html } from '/static/lib/html.js';
import { DEFAULT_COLOR, fmtRp, getCatColor, shortDate } from '/static/lib/utils.js';
import { getChildName } from '/static/lib/icons.js';
import { CategoryIcon } from '/static/components/CategoryIcon.js';

export function TransactionView({ data, categories }) {
    const [query, setQuery] = useState('');
    if (!data || !data.transactions || !data.transactions.length) {
        return html`<section class="view"><div class="card empty">No transactions</div></section>`;
    }

    const q = query.toLowerCase();
    const filtered = q
        ? data.transactions.filter(t =>
            t.date.includes(q) ||
            t.category.toLowerCase().includes(q) ||
            t.description.toLowerCase().includes(q) ||
            String(t.amount).includes(q)
          )
        : data.transactions;

    return html`
        <section class="view">
            <div class="search-wrap">
                <input
                    type="text"
                    id="tx-search"
                    placeholder="Search transactions..."
                    autocomplete="off"
                    value=${query}
                    onInput=${e => setQuery(e.target.value)}
                />
            </div>
            <div class="tx-list">
                ${filtered.map((t, i) => {
                    const color = t.is_income ? '#9ece6a' : (t.color || getCatColor(t.category, categories));
                    const amt = t.is_income ? '+' + fmtRp(t.amount) : fmtRp(t.amount);
                    const cls = t.is_income ? 'green' : '';
                    const displayName = getChildName(t.category);
                    return html`
                        <div class="tx-row" key=${i}>
                            <div class="tx-left">
                                <div class="tx-date">${shortDate(t.date)}</div>
                                <div class="tx-cat" style=${{ color }}>
                                    <${CategoryIcon} category=${t.category} size=${14} color=${color} />
                                    <span>${displayName}</span>
                                </div>
                            </div>
                            <div class="tx-right">
                                <div class="tx-amt ${cls}">${amt}</div>
                                <div class="tx-desc">${t.description || ''}</div>
                            </div>
                        </div>
                    `;
                })}
            </div>
        </section>
    `;
}
