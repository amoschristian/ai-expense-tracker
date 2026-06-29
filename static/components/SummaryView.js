import { html } from '/static/lib/html.js';
import { BalanceCard } from '/static/components/summary/BalanceCard.js';
import { BalanceTrend } from '/static/components/summary/BalanceTrend.js';
import { StatsRow } from '/static/components/summary/StatsRow.js';
import { WeeklySpending } from '/static/components/summary/WeeklySpending.js';
import { TopCategories } from '/static/components/summary/TopCategories.js';
import { CashFlowTrend } from '/static/components/summary/CashFlowTrend.js';

export function SummaryView({ data, trend, balance, categories, account }) {
    if (!data || data.error) {
        return html`<section class="view"><div class="card empty">No data for this month</div></section>`;
    }

    return html`
        <section class="view">
            <${BalanceCard} balance=${balance} />
            <${StatsRow} data=${data} account=${account} />
            <${BalanceTrend} data=${data} />
            <${TopCategories} data=${data} categories=${categories} />
            <${WeeklySpending} transactions=${data.transactions} />
            <${CashFlowTrend} trend=${trend} />
        </section>
    `;
}
