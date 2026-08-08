import { html } from '/static/lib/html.js';
import { fmtRp } from '/static/lib/utils.js';
import { BalanceCard } from '/static/components/summary/BalanceCard.js';
import { FoodBudget } from '/static/components/summary/FoodBudget.js';
import { StatsRow } from '/static/components/summary/StatsRow.js';
import { TopCategories } from '/static/components/summary/TopCategories.js';
import { CashFlowTrend } from '/static/components/summary/CashFlowTrend.js';
import { Spinner } from '/static/components/Spinner.js';
import { GoalsWidget } from '/static/components/summary/GoalsWidget.js';

export function SummaryView({ data, trend, balance, categories, account, mortgage, onOpenMortgage, goals, onOpenGoals }) {
    if (!data) {
        return html`<${Spinner} text="Loading summary..." />`;
    }
    if (data.error) {
        return html`<section class="view"><div class="card empty">${data.error}</div></section>`;
    }

    return html`
        <section class="view">
            <${BalanceCard} balance=${balance} />
            ${account === 'amos' && html`
            <${GoalsWidget} goals=${goals} onOpenGoals=${onOpenGoals} />
            `}
            ${account === 'house' && mortgage && html`
            <div class="card house-widget" onClick=${onOpenMortgage}>
                <div class="card-title">House · Mortgage</div>
                <div class="house-widget-payment">
                    <span class="house-widget-label">Monthly payment</span>
                    <span class="house-widget-value">${fmtRp(mortgage.monthly_payment)}</span>
                </div>
                <div class="house-widget-foot">
                    <span class="house-widget-total">${fmtRp(mortgage.total_paid)} paid · ${mortgage.payments_count}×</span>
                    <span class="house-widget-link">See details →</span>
                </div>
            </div>
            `}
            <${FoodBudget} transactions=${data.transactions} />
            <${StatsRow} data=${data} account=${account} />
            <${TopCategories} data=${data} categories=${categories} />
            <${CashFlowTrend} trend=${trend} />
        </section>
    `;
}
