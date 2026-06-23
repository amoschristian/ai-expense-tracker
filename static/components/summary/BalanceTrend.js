import { html } from '/static/lib/html.js';
import { MONTHS, fmtRp } from '/static/lib/utils.js';

export function BalanceTrend({ data }) {
    if (!data || !data.transactions || !data.transactions.length) {
        return html`<div class="card"><div class="card-title">Balance Trend</div><div class="empty">No data</div></div>`;
    }

    const year = data.transactions[0] ? new Date(data.transactions[0].date + 'T00:00:00').getFullYear() : 2026;
    const month = data.transactions[0] ? new Date(data.transactions[0].date + 'T00:00:00').getMonth() : 0;
    const lastDay = new Date(year, month + 1, 0).getDate();

    const daily = {};
    const sorted = [...data.transactions].sort((a, b) => a.date.localeCompare(b.date));
    let running = data.start || 0;
    daily[sorted[0].date] = running;
    sorted.forEach(t => {
        running += t.is_income ? t.amount : -t.amount;
        daily[t.date] = running;
    });

    const points = [];
    let lastKnown = data.start || 0;
    for (let d = 1; d <= lastDay; d++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        if (daily[dateStr] !== undefined) lastKnown = daily[dateStr];
        points.push({ day: d, balance: lastKnown });
    }

    const balances = points.map(p => p.balance);
    const minBal = Math.min(...balances);
    const maxBal = Math.max(...balances);
    const range = maxBal - minBal || 1;
    const endBal = balances[balances.length - 1];
    const trend = endBal >= (data.start || 0);
    const lineColor = trend ? '#9ece6a' : '#f7768e';

    // SVG line chart
    const w = 300, h = 80, pad = 4;
    const pathPoints = points.map((p, i) => {
        const x = pad + (i / (points.length - 1)) * (w - pad * 2);
        const y = pad + (1 - (p.balance - minBal) / range) * (h - pad * 2);
        return `${x},${y}`;
    });
    const linePath = 'M' + pathPoints.join(' L');
    const areaPath = linePath + ` L${pad + (w - pad * 2)},${h - pad} L${pad},${h - pad} Z`;

    return html`
        <div class="card">
            <div class="card-title">Balance Trend</div>
            <svg class="balance-trend-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
                <defs>
                    <linearGradient id="area-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stop-color=${lineColor} stop-opacity="0.3" />
                        <stop offset="100%" stop-color=${lineColor} stop-opacity="0.02" />
                    </linearGradient>
                </defs>
                <path d=${areaPath} fill="url(#area-fill)" />
                <path d=${linePath} fill="none" stroke=${lineColor} stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                <circle cx=${pathPoints[pathPoints.length - 1].split(',')[0]} cy=${pathPoints[pathPoints.length - 1].split(',')[1]} r="3" fill=${lineColor} />
            </svg>
            <div class="balance-trend-labels">
                <span>1</span>
                <span>${MONTHS[month]}</span>
                <span>${lastDay}</span>
            </div>
        </div>
    `;
}
