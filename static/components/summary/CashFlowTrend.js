import { html } from '/static/lib/html.js';
import { fmtRp } from '/static/lib/utils.js';

export function CashFlowTrend({ trend }) {
    const trendCards = trend && trend.months && trend.months.length
        ? (() => {
            const maxAbs = Math.max(...trend.months.map(m => Math.abs(m.net)), 1);
            return trend.months.map(m => {
                const pct = Math.max((Math.abs(m.net) / maxAbs) * 50, 1);
                const color = m.net >= 0 ? '#9ece6a' : '#f7768e';
                const sign = m.net >= 0 ? '+' : '−';
                const marginLeft = m.net >= 0 ? '50%' : `calc(50% - ${pct}%)`;
                return html`
                    <div class="trend-row" key=${m.name}>
                        <span class="trend-label">${m.name}</span>
                        <div class="trend-bar-wrap">
                            <div class="trend-bar" style=${{ width: pct + '%', background: color, marginLeft }}></div>
                        </div>
                        <span class="trend-amt" style=${{ color }}>${sign} ${fmtRp(Math.abs(m.net))}</span>
                    </div>
                `;
            });
        })()
        : html`<div class="empty">No trend data</div>`;

    return html`
        <div class="card">
            <div class="card-title">6-Month Net Cash Flow</div>
            ${trendCards}
        </div>
    `;
}
