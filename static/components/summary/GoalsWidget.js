import { html } from '/static/lib/html.js';
import { fmtRp } from '/static/lib/utils.js';

const PALETTE = ['#9ece6a', '#7dcfff', '#bb9af7', '#e0af68', '#f7768e'];

export function GoalsWidget({ goals, onOpenGoals }) {
    if (!goals) return html``;

    const list = goals.goals || [];
    const active = list.filter(g => !g.achieved);
    const done = list.length - active.length;

    // Show the closest deadline active goal; if all done, the first achieved one.
    const top = active[0] || list[0];

    return html`
        <div class="card goals-widget" onClick=${onOpenGoals}>
            <div class="card-title">Goals · Savings</div>
            ${top ? html`
                <div class="goals-widget-name" style=${{ color: PALETTE[top.id % PALETTE.length] }}>${top.name}</div>
                <div class="progress-header">
                    <span>${fmtRp(top.progress)} of ${fmtRp(top.target_amount)}</span>
                    <span>${top.pct}%</span>
                </div>
                <div class="progress-bar-wrap">
                    <div class="progress-bar paid" style=${{ background: PALETTE[top.id % PALETTE.length], width: top.pct + '%' }}></div>
                </div>
                <div class="goals-widget-foot">
                    <span class="goals-widget-total">${active.length} active · ${done} done</span>
                    <span class="goals-widget-link">See details →</span>
                </div>
            ` : html`
                <div class="goals-widget-empty">No goals yet — set a savings target</div>
                <div class="goals-widget-foot">
                    <span class="goals-widget-link">Add a goal →</span>
                </div>
            `}
        </div>
    `;
}
