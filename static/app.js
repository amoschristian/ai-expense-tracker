import { useState, useEffect, useCallback } from 'https://esm.sh/preact@10.25.4/hooks';
import { render } from 'https://esm.sh/preact@10.25.4';
import { html } from '/static/lib/html.js';
import { fetchJSON } from '/static/lib/utils.js';
import { Header } from '/static/components/Header.js';
import { SummaryView } from '/static/components/SummaryView.js';
import { TransactionView } from '/static/components/TransactionView.js';
import { MortgageView } from '/static/components/MortgageView.js';
import { RecurringView } from '/static/components/RecurringView.js';
import { TabBar } from '/static/components/TabBar.js';

function App() {
    const now = new Date();
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [account, setAccount] = useState('bca');
    const [view, setView] = useState('summary');
    const [accounts, setAccounts] = useState([]);
    const [monthData, setMonthData] = useState(null);
    const [trendData, setTrendData] = useState(null);
    const [balance, setBalance] = useState(null);
    const [categories, setCategories] = useState([]);
    const [mortgageData, setMortgageData] = useState(null);

    useEffect(() => {
        fetchJSON('/api/accounts').then(d => { if (d) setAccounts(d); });
        fetchJSON('/api/categories').then(d => { if (d) setCategories(d); });
    }, []);

    useEffect(() => {
        fetchJSON(`/api/balance?account=${account}`).then(d => { if (d) setBalance(d); });
    }, [account]);

    useEffect(() => {
        Promise.all([
            fetchJSON(`/api/month?account=${account}&year=${year}&month=${month}`),
            fetchJSON(`/api/trend?account=${account}&year=${year}&month=${month}`)
        ]).then(([m, t]) => {
            setMonthData(m);
            setTrendData(t);
        });
    }, [year, month, account]);

    useEffect(() => {
        if (view === 'mortgage' && !mortgageData) {
            fetchJSON('/api/mortgage').then(d => { if (d) setMortgageData(d); });
        }
    }, [view, mortgageData]);

    const prevMonth = useCallback(() => {
        setMonth(m => {
            if (m === 1) { setYear(y => y - 1); return 12; }
            return m - 1;
        });
    }, []);

    const nextMonth = useCallback(() => {
        setMonth(m => {
            if (m === 12) { setYear(y => y + 1); return 1; }
            return m + 1;
        });
    }, []);

    return html`
        <${Header}
            year=${year}
            month=${month}
            account=${account}
            accounts=${accounts}
            onPrev=${prevMonth}
            onNext=${nextMonth}
            onAccountChange=${setAccount}
            showAccount=${view !== 'mortgage' && view !== 'recurring'}
        />
        <main id="content">
            ${view === 'summary' && html`<${SummaryView} data=${monthData} trend=${trendData} balance=${balance} categories=${categories} />`}
            ${view === 'transactions' && html`<${TransactionView} data=${monthData} categories=${categories} />`}
            ${view === 'mortgage' && html`<${MortgageView} data=${mortgageData} />`}
            ${view === 'recurring' && html`<${RecurringView} categories=${categories} account=${account} />`}
        </main>
        <${TabBar} active=${view} onChange=${setView} />
    `;
}

render(html`<${App} />`, document.getElementById('app'));
