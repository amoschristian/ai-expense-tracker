import { useState } from 'https://esm.sh/preact@10.25.4/hooks';
import { html } from '/static/lib/html.js';
import { MONTHS, fmtRp } from '/static/lib/utils.js';
import { Spinner } from '/static/components/Spinner.js';

function pmt(balance, annualRate, remainingMonths) {
    const r = annualRate / 100 / 12;
    if (r === 0) return balance / remainingMonths;
    return balance * r / (1 - Math.pow(1 + r, -remainingMonths));
}

function getRateForMonth(elapsedMonths, rates, startYear, startMonth) {
    let lastRate = rates[0].rate;
    for (const r of rates) {
        const fromParts = r.from.split('-');
        const toParts = r.to.split('-');
        const fromMonths = (parseInt(fromParts[0]) - startYear) * 12 + (parseInt(fromParts[1]) - startMonth);
        const toMonths = (parseInt(toParts[0]) - startYear) * 12 + (parseInt(toParts[1]) - startMonth);
        if (elapsedMonths < fromMonths) return lastRate;
        if (elapsedMonths >= fromMonths && elapsedMonths <= toMonths) {
            return r.rate;
        }
        lastRate = r.rate;
    }
    return lastRate;
}

function simulateLoan(principal, rates, tenor, startYear, startMonth, savingsBalance, monthlySavings, monthsElapsed) {
    let balance = principal;
    let savings = savingsBalance;
    const results = [];
    let totalInterest = 0;
    let totalPaid = 0;
    let payment = pmt(principal, rates[0].rate, tenor);
    let payoffMonth = -1;

    for (let m = 0; m < tenor; m++) {
        const rate = getRateForMonth(m, rates, startYear, startMonth);
        const prevRate = m > 0 ? getRateForMonth(m - 1, rates, startYear, startMonth) : null;
        if (prevRate !== null && rate !== prevRate) {
            payment = pmt(balance, rate, tenor - m);
        }
        const effectivePrincipal = Math.max(0, balance - savings * 0.8);
        const interest = effectivePrincipal * rate / 100 / 12;
        balance = balance + interest - payment;
        if (balance < 1) balance = 0;
        totalInterest += interest;
        totalPaid += payment;

        if (monthlySavings > 0 && m >= monthsElapsed) {
            savings += monthlySavings;
        }

        const year = startYear + Math.floor((startMonth + m) / 12);
        const month = ((startMonth + m - 1) % 12) + 1;
        results.push({ year, month, rate, payment, interest, principalPart: payment - interest, balance });

        if (balance === 0 && payoffMonth < 0) {
            payoffMonth = m;
            break;
        }
    }
    return { results, totalInterest, totalPaid, payoffMonth };
}

export function MortgageView({ data }) {
    const [savings, setSavings] = useState(252000000);

    if (!data) {
        return html`<${Spinner} text="Loading mortgage data..." />`;
    }
    if (!data.payments) {
        return html`<section class="view"><div class="card empty">No mortgage data</div></section>`;
    }

    const months_elapsed = (() => {
        const parts = data.start_date.split(' ');
        const monthMap = {Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
        const start = new Date(parseInt(parts[1]), monthMap[parts[0]]);
        const now = new Date();
        return (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
    })();
    const remaining = data.original_loan - data.total_paid;
    const pct_paid = ((data.total_paid / data.original_loan) * 100).toFixed(1);
    const pct_remaining = (100 - parseFloat(pct_paid)).toFixed(1);

    const principal = data.original_loan;
    const rates = data.rate_schedule;
    const startMonth = 12;
    const startYear = 2023;

    const current = simulateLoan(principal, rates, data.tenor, startYear, startMonth, savings, 0, 0);
    const noSavings = simulateLoan(principal, rates, data.tenor, startYear, startMonth, 0, 0, 0);
    const interestSaved = noSavings.totalInterest - current.totalInterest;

    const actualSim = simulateLoan(principal, rates, data.tenor, startYear, startMonth, data.house_balance, 2000000, months_elapsed);
    const actualNoGrowth = simulateLoan(principal, rates, data.tenor, startYear, startMonth, 0, 0, 0);
    const actualInterestSaved = actualNoGrowth.totalInterest - actualSim.totalInterest;
    const actualPayoffYear = actualSim.payoffMonth >= 0
        ? startYear + Math.floor((startMonth + actualSim.payoffMonth) / 12)
        : '\u2014';

    function buildTrajectory(results) {
        return rates.map(r => {
            const fromParts = r.from.split('-');
            const toParts = r.to.split('-');
            const fromMonths = (parseInt(fromParts[0]) - startYear) * 12 + (parseInt(fromParts[1]) - startMonth);
            const toMonths = (parseInt(toParts[0]) - startYear) * 12 + (parseInt(toParts[1]) - startMonth);
            const midMonth = Math.floor((fromMonths + toMonths) / 2);
            const sample = results[midMonth] || results[results.length - 1];
            return {
                rate: r.rate,
                label: `${r.from.split('-')[0]}\u2013${r.to.split('-')[0]}`,
                payment: sample ? sample.payment : 0,
            };
        });
    }

    const trajectory = buildTrajectory(current.results);
    const actualTrajectory = buildTrajectory(actualSim.results);

    const maxPaymentSim = Math.max(...trajectory.map(t => t.payment), 1);
    const maxPaymentActual = Math.max(...actualTrajectory.map(t => t.payment), 1);
    const payoffYear = current.payoffMonth >= 0
        ? startYear + Math.floor((startMonth + current.payoffMonth) / 12)
        : '\u2014';

    return html`
        <section class="view">
            <div class="card balance-card">
                <div class="label">House Account Balance</div>
                <div class="value">${fmtRp(data.house_balance)}</div>
            </div>

            <div class="stats-row">
                <div class="stat">
                    <div class="label">Monthly Payment</div>
                    <div class="value">${fmtRp(data.monthly_payment)}</div>
                </div>
                <div class="stat">
                    <div class="label">Total Paid</div>
                    <div class="value blue">${fmtRp(data.total_paid)}</div>
                </div>
                <div class="stat">
                    <div class="label">Payments</div>
                    <div class="value">${data.payments_count}</div>
                </div>
            </div>

            <div class="card">
                <div class="card-title">Loan Progress</div>
                <div class="mortgage-progress">
                    <div class="progress-header">
                        <span>${pct_paid}% paid</span>
                        <span>${pct_remaining}% remaining</span>
                    </div>
                    <div class="progress-bar-wrap">
                        <div class="progress-bar paid" style=${{ width: pct_paid + '%' }}></div>
                        <div class="progress-bar remaining" style=${{ width: pct_remaining + '%' }}></div>
                    </div>
                    <div class="progress-labels">
                        <span>Paid: ${fmtRp(data.total_paid)}</span>
                        <span>Remaining: ${fmtRp(remaining)}</span>
                    </div>
                </div>
                <div class="mortgage-meta">
                    <div class="meta-row">
                        <span class="meta-label">Original Loan</span>
                        <span class="meta-value">${fmtRp(data.original_loan)}</span>
                    </div>
                    <div class="meta-row">
                        <span class="meta-label">Start Date</span>
                        <span class="meta-value">${data.start_date}</span>
                    </div>
                    <div class="meta-row">
                        <span class="meta-label">Months Elapsed</span>
                        <span class="meta-value">${months_elapsed} months</span>
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="card-title">Current Projection \u2014 ${fmtRp(data.house_balance)}</div>
                <div class="sim-stats">
                    <div class="sim-stat">
                        <span class="sim-stat-label">Payoff Year</span>
                        <span class="sim-stat-value">${actualPayoffYear}</span>
                    </div>
                    <div class="sim-stat">
                        <span class="sim-stat-label">Total Interest</span>
                        <span class="sim-stat-value red">${fmtRp(Math.round(actualSim.totalInterest))}</span>
                    </div>
                    <div class="sim-stat">
                        <span class="sim-stat-label">Interest Saved</span>
                        <span class="sim-stat-value green">${fmtRp(Math.round(actualInterestSaved))}</span>
                    </div>
                </div>

                <div class="sim-label" style=${{ marginTop: '16px' }}>Savings Growth (+Rp 2M/mo)</div>
                <div class="sim-chart">
                    ${actualTrajectory.map(t => {
                        const pct = (t.payment / maxPaymentActual) * 100;
                        return html`
                            <div class="chart-bar-wrap" key=${t.label}>
                                <div class="chart-label">${t.label}</div>
                                <div class="chart-bar-track">
                                    <div class="chart-bar" style=${{ width: pct + '%' }}></div>
                                </div>
                                <div class="chart-amt">${fmtRp(Math.round(t.payment))}</div>
                                <div class="chart-rate">${t.rate}%</div>
                            </div>
                        `;
                    })}
                </div>

                <div class="mortgage-meta" style=${{ marginTop: '16px' }}>
                    <div class="meta-row">
                        <span class="meta-label">Current Balance</span>
                        <span class="meta-value">${fmtRp(data.house_balance)}</span>
                    </div>
                    <div class="meta-row">
                        <span class="meta-label">+Rp 2M/mo Savings</span>
                        <span class="meta-value">Rp 24M/year</span>
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="card-title">KPR Simulation \u2014 80% Rule</div>
                <div class="sim-input">
                    <label class="sim-label">Savings Balance</label>
                    <input
                        type="range"
                        class="sim-slider"
                        min="0"
                        max="500000000"
                        step="10000000"
                        value=${savings}
                        onInput=${e => setSavings(parseInt(e.target.value))}
                    />
                    <div class="sim-value">${fmtRp(savings)}</div>
                </div>

                <div class="sim-stats">
                    <div class="sim-stat">
                        <span class="sim-stat-label">Payoff Year</span>
                        <span class="sim-stat-value">${payoffYear}</span>
                    </div>
                    <div class="sim-stat">
                        <span class="sim-stat-label">Total Interest</span>
                        <span class="sim-stat-value red">${fmtRp(Math.round(current.totalInterest))}</span>
                    </div>
                    <div class="sim-stat">
                        <span class="sim-stat-label">Interest Saved</span>
                        <span class="sim-stat-value green">${fmtRp(Math.round(interestSaved))}</span>
                    </div>
                </div>

                <div class="sim-label" style=${{ marginTop: '16px' }}>Payment Trajectory</div>
                <div class="sim-chart">
                    ${trajectory.map(t => {
                        const pct = (t.payment / maxPaymentSim) * 100;
                        return html`
                            <div class="chart-bar-wrap" key=${t.label}>
                                <div class="chart-label">${t.label}</div>
                                <div class="chart-bar-track">
                                    <div class="chart-bar" style=${{ width: pct + '%' }}></div>
                                </div>
                                <div class="chart-amt">${fmtRp(Math.round(t.payment))}</div>
                                <div class="chart-rate">${t.rate}%</div>
                            </div>
                        `;
                    })}
                </div>
            </div>

            <div class="card">
                <div class="card-title">Payment History</div>
                <div class="mortgage-payments">
                    ${data.payments.map(p => {
                        const d = new Date(p.date + 'T00:00:00');
                        const label = MONTHS[d.getMonth()] + ' ' + d.getFullYear();
                        return html`
                            <div class="payment-row" key=${p.date}>
                                <span class="payment-date">${label}</span>
                                <span class="payment-desc">${p.description}</span>
                                <span class="payment-amt">${fmtRp(p.amount)}</span>
                            </div>
                        `;
                    })}
                </div>
                <div class="mortgage-total">
                    <span>Total</span>
                    <span class="payment-amt">${fmtRp(data.total_paid)}</span>
                </div>
            </div>
        </section>
    `;
}
