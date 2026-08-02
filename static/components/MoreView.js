import { useState, useEffect, useCallback } from 'https://esm.sh/preact@10.25.4/hooks';
import { html } from '/static/lib/html.js';
import { MONTHS, fmtRp, fetchJSON } from '/static/lib/utils.js';
import { Spinner } from '/static/components/Spinner.js';
import { AmountInput } from '/static/components/AmountInput.js';

function TimelineChart({ sim }) {
    if (!sim) return null;
    const { balance, upcoming, projected_end, today, days_in_month } = sim;

    // Build points: start today -> each debit day -> end of month
    let running = balance;
    const points = [{ day: today, value: balance, label: 'Today' }];
    [...upcoming].sort((a, b) => a.day - b.day).forEach(u => {
        running -= u.amount;
        points.push({ day: u.day, value: running, label: u.name, color: u.color, amount: u.amount });
    });
    points.push({ day: days_in_month, value: projected_end, label: 'EOM' });

    const W = 340, H = 150, PX = 34, PT = 20, PB = 24;
    const minV = Math.min(balance, projected_end, 0) - 200000;
    const maxV = Math.max(balance, projected_end) + 200000;
    const span = maxV - minV || 1;

    const x = d => PX + (d - today) / Math.max(1, days_in_month - today) * (W - PX - 8);
    const y = v => H - PB - (v - minV) / span * (H - PT - PB);

    const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.day).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
    const area = `${line} L${x(days_in_month).toFixed(1)},${H - PB} L${x(today).toFixed(1)},${H - PB} Z`;

    // Value labels: skip a label if it duplicates the previous point's value
    // (flat tail to EOM) or if the two points are too close to fit both.
    const MIN_LABEL_GAP = 26;
    const valueLabels = [];
    points.forEach((p, i) => {
        if (i > 0 && p.value === points[i - 1].value) return;
        if (valueLabels.length > 0 && x(p.day) - x(points[valueLabels[valueLabels.length - 1]].day) < MIN_LABEL_GAP) return;
        valueLabels.push(i);
    });
    const dayLabels = [];
    points.forEach((p, i) => {
        if (i === 0) { dayLabels.push(i); return; }
        const last = dayLabels[dayLabels.length - 1];
        if (x(p.day) - x(points[last].day) < 20) return;
        dayLabels.push(i);
    });

    return html`
        <svg class="sim-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">
            <path d=${area} fill="rgba(122, 162, 247, 0.10)" stroke="none" />
            <path d=${line} fill="none" stroke="var(--blue)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            ${points.map(p => html`
                <circle cx=${x(p.day).toFixed(1)} cy=${y(p.value).toFixed(1)} r=${p.label === 'Today' ? 4 : 3.5}
                    fill=${p.color || 'var(--blue)'} stroke="#16181f" stroke-width="1.5" />
            `)}
            ${valueLabels.map(i => html`
                <text x=${x(points[i].day).toFixed(1)} y=${(y(points[i].value) - 9).toFixed(1)} text-anchor="middle"
                    class="sim-chart-val" font-size="8.5" fill="var(--dim)">
                    ${fmtRp(points[i].value).replace('Rp ', '')}
                </text>
            `)}
            ${dayLabels.map(i => html`
                <text x=${x(points[i].day).toFixed(1)} y=${H - 8} text-anchor="middle" font-size="9" fill="var(--dim)">
                    ${i === 0 ? `${points[i].day} (today)` : points[i].day}
                </text>
            `)}
        </svg>
    `;
}

export function MoreView({ account, year, month, refreshKey }) {
    const [sim, setSim] = useState(null);
    const [error, setError] = useState(null);
    const [whatIf, setWhatIf] = useState('');

    const load = useCallback(() => {
        setSim(null);
        setError(null);
        fetchJSON(`/api/simulation?account=${account}&year=${year}&month=${month}`).then(d => {
            if (d && !d.error) setSim(d);
            else setError(d && d.error ? d.error : 'Failed to load');
        });
    }, [account, year, month]);

    useEffect(() => { load(); }, [load, refreshKey]);

    if (error) {
        return html`<section class="view"><div class="card empty">${error}</div></section>`;
    }
    if (!sim) {
        return html`<section class="view"><${Spinner} text="Simulating..." /></section>`;
    }

    const simAmount = parseInt(whatIf || '0', 10) || 0;
    const afterBalance = sim.balance - simAmount;
    const afterProjected = sim.projected_end - simAmount;
    const safe = afterProjected >= 0;

    const monthLabel = `${MONTHS[sim.month - 1]} ${sim.year}`;

    return html`
        <section class="view">
            <div class="sim-head">
                <div class="sim-head-title">Balance Simulator</div>
                <div class="sim-head-month">${monthLabel} · ${sim.account.toUpperCase()}</div>
            </div>

            <div class="card sim-balance-card">
                <div class="card-title">Current balance</div>
                <div class="sim-balance-big">${fmtRp(sim.balance)}</div>
                <div class="sim-balance-sub">${sim.upcoming.length} known debits remaining this month</div>
            </div>

            <div class="card">
                <div class="card-title">Upcoming debits</div>
                ${sim.upcoming.length === 0 && html`
                    <div class="sim-empty">No recurring debits left this month 🎉</div>
                `}
                ${sim.upcoming.map(u => {
                    let running = sim.balance;
                    const shown = [...sim.upcoming].sort((a, b) => a.day - b.day).slice(0, sim.upcoming.indexOf(u) + 1);
                    shown.forEach(s => running -= s.amount);
                    return html`
                        <div class="sim-debit-row">
                            <span class="sim-debit-dot" style=${{ background: u.color }}></span>
                            <span class="sim-debit-name">
                                ${u.name}
                                <span class="sim-debit-day">day ${u.day}</span>
                            </span>
                            <span class="sim-debit-amount">−${fmtRp(u.amount)}</span>
                        </div>
                    `;
                })}
            </div>

            <div class="card sim-proj-card">
                <div class="card-title">Projected end of month</div>
                <div class="sim-proj-big ${safe ? '' : 'sim-risk'}">${fmtRp(sim.projected_end)}</div>
                <div class="sim-proj-status">
                    <span class="sim-status-pill ${safe ? 'sim-safe' : 'sim-risk'}">
                        ${safe ? '✓ Safe — free cash after all known debits' : '⚠ Overdraft risk after known debits'}
                    </span>
                </div>
            </div>

            <div class="card">
                <div class="card-title">What if I spend…</div>
                <div class="sim-form">
                    <${AmountInput} value=${whatIf} onInput=${setWhatIf} placeholder="Amount" />
                </div>
                <div class="sim-quick-chips">
                    ${[100000, 300000, 500000, 1000000].map(v => html`
                        <button class="sim-chip" onClick=${() => setWhatIf(String(v))}>${fmtRp(v)}</button>
                    `)}
                </div>
                ${whatIf && html`
                    <div class="sim-whatif-result">
                        <div class="sim-whatif-row"><span>Balance after spend</span><span>${fmtRp(afterBalance)}</span></div>
                        <div class="sim-whatif-row"><span>End of month</span><span class=${afterProjected >= 0 ? 'sim-safe-text' : 'sim-risk-text'}>${fmtRp(afterProjected)}</span></div>
                        <div class="sim-whatif-row"><span>Status</span><span class="sim-status-pill sim-sm ${safe ? 'sim-safe' : 'sim-risk'}">${safe ? 'Safe' : 'Overdraft risk'}</span></div>
                    </div>
                `}
            </div>

            <div class="card">
                <div class="card-title">Projection timeline</div>
                <${TimelineChart} sim=${sim} />
                <div class="sim-chart-legend">Balance from today → each debit → end of month</div>
            </div>
        </section>
    `;
}
