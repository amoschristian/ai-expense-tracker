import { html } from '/static/lib/html.js';
import { MONTHS, fmtRp } from '/static/lib/utils.js';

function fmtWeekRange(start, end) {
    if (start.getMonth() === end.getMonth()) {
        return `${MONTHS[start.getMonth()]} ${start.getDate()}–${end.getDate()}`;
    }
    return `${MONTHS[start.getMonth()]} ${start.getDate()}–${MONTHS[end.getMonth()]} ${end.getDate()}`;
}

export function WeeklySpending({ transactions }) {
    if (!transactions || !transactions.length) {
        return html`<div class="card"><div class="card-title">Weekly Spending</div><div class="empty">No spending this month</div></div>`;
    }

    const dates = transactions.map(t => new Date(t.date + 'T00:00:00'));
    const year = dates[0].getFullYear();
    const month = dates[0].getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    const numWeeks = Math.ceil(lastDay / 7);

    const weeks = [];
    for (let i = 0; i < numWeeks; i++) {
        const startDay = i * 7 + 1;
        const endDay = Math.min((i + 1) * 7, lastDay);
        weeks.push({ start: new Date(year, month, startDay), end: new Date(year, month, endDay), total: 0 });
    }

    transactions.forEach(t => {
        if (t.is_income || t.is_exclude) return;
        const day = new Date(t.date + 'T00:00:00').getDate();
        const weekIdx = Math.floor((day - 1) / 7);
        if (weekIdx >= 0 && weekIdx < numWeeks) {
            weeks[weekIdx].total += t.amount;
        }
    });

    const maxVal = Math.max(...weeks.map(w => w.total), 1);

    return html`
        <div class="card">
            <div class="card-title">Weekly Spending</div>
            <div class="weekly-chart">
                ${weeks.map((w, i) => {
                    const pct = (w.total / maxVal) * 100;
                    return html`
                        <div class="weekly-row" key=${i}>
                            <span class="weekly-label">${fmtWeekRange(w.start, w.end)}</span>
                            <div class="weekly-bar-wrap">
                                <div class="weekly-bar" style=${{ width: pct + '%' }}></div>
                            </div>
                            <span class="weekly-amt">${fmtRp(w.total)}</span>
                        </div>
                    `;
                })}
            </div>
        </div>
    `;
}
