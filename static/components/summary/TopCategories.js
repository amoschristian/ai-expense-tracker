import { html } from '/static/lib/html.js';
import { DEFAULT_COLOR, fmtRp, getCatColor } from '/static/lib/utils.js';
import { getChildName } from '/static/lib/icons.js';
import { CategoryIcon } from '/static/components/CategoryIcon.js';

export function TopCategories({ data, categories }) {
    const top = data.categories.slice(0, 8);

    return html`
        <div class="card">
            <div class="card-title">Top Categories</div>
            ${top.length ? top.map(c => {
                const color = c.color || getCatColor(c.name, categories);
                const display = getChildName(c.name);
                return html`
                    <div class="cat-row" key=${c.name}>
                        <span class="cat-name" style=${{ color }}>
                            <${CategoryIcon} category=${c.name} size=${14} color=${color} />
                            <span>${display}</span>
                        </span>
                        <span class="cat-amt">${fmtRp(c.amount)}</span>
                        <div class="cat-bar-wrap">
                            <div class="cat-bar" style=${{ width: c.pct + '%', background: color }}></div>
                        </div>
                        <span class="cat-pct">${c.pct}%</span>
                    </div>
                `;
            }) : html`<div class="empty">No expenses</div>`}
        </div>
    `;
}
