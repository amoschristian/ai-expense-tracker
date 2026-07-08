import { useState, useEffect, useCallback } from 'https://esm.sh/preact@10.25.4/hooks';
import { render } from 'https://esm.sh/preact@10.25.4';
import { html } from '/static/lib/html.js';
import PullToRefresh from 'https://esm.sh/pulltorefreshjs@0.1.22';
import { fetchJSON, fetchCSRF } from '/static/lib/utils.js';
import { Header } from '/static/components/Header.js';
import { SummaryView } from '/static/components/SummaryView.js';
import { TransactionView } from '/static/components/TransactionView.js';
import { MortgageView } from '/static/components/MortgageView.js';
import { RecurringView } from '/static/components/RecurringView.js';
import { TabBar } from '/static/components/TabBar.js';
import { ToastBar } from '/static/components/ToastBar.js';

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
    const [ready, setReady] = useState(false);

    useEffect(() => {
        fetchCSRF().then(() => setReady(true));
        fetchJSON('/api/accounts').then(d => { if (d && !d.error) setAccounts(d); });
        fetchJSON('/api/categories').then(d => { if (d && !d.error) setCategories(d); });
    }, []);

    useEffect(() => {
        if (!ready) return;
        fetchJSON(`/api/balance?account=${account}`).then(d => { if (d && !d.error) setBalance(d); });
    }, [account, ready]);

    useEffect(() => {
        if (!ready) return;
        Promise.all([
            fetchJSON(`/api/month?account=${account}&year=${year}&month=${month}`),
            fetchJSON(`/api/trend?account=${account}&year=${year}&month=${month}`)
        ]).then(([m, t]) => {
            if (m && !m.error) setMonthData(m);
            if (t && !t.error) setTrendData(t);
        });
    }, [year, month, account, ready]);

    useEffect(() => {
        if (view === 'mortgage' && !mortgageData && ready) {
            fetchJSON('/api/mortgage').then(d => { if (d && !d.error) setMortgageData(d); });
        }
    }, [view, mortgageData, ready]);

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

    const reloadMonth = useCallback(() => {
        fetchJSON(`/api/month?account=${account}&year=${year}&month=${month}`).then(d => { if (d && !d.error) setMonthData(d); });
    }, [account, year, month]);

    function refreshAll() {
        return Promise.all([
            fetchJSON(`/api/month?account=${account}&year=${year}&month=${month}`).then(d => { if (d && !d.error) setMonthData(d); }),
            fetchJSON(`/api/trend?account=${account}&year=${year}&month=${month}`).then(d => { if (d && !d.error) setTrendData(d); }),
            fetchJSON(`/api/balance?account=${account}`).then(d => { if (d && !d.error) setBalance(d); }),
            view === 'mortgage' && mortgageData
                ? fetchJSON('/api/mortgage').then(d => { if (d && !d.error) setMortgageData(d); })
                : Promise.resolve(),
        ]);
    }

    useEffect(() => {
        const ptr = PullToRefresh.init({
            mainElement: '#content',
            triggerElement: '#content',
            distThreshold: 60,
            onRefresh() {
                return refreshAll();
            },
            shouldPullToRefresh() {
                return this.mainElement.scrollTop <= 0;
            },
        });
        return () => PullToRefresh.destroyAll();
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
            ${view === 'summary' && html`<${SummaryView} data=${monthData} trend=${trendData} balance=${balance} categories=${categories} account=${account} />`}
            ${view === 'transactions' && html`<${TransactionView} data=${monthData} categories=${categories} onUpdated=${reloadMonth} />`}
            ${view === 'mortgage' && html`<${MortgageView} data=${mortgageData} />`}
            ${view === 'recurring' && html`<${RecurringView} categories=${categories} accounts=${accounts} />`}
        </main>
        <${TabBar} active=${view} onChange=${setView} />
        <${ToastBar} />
    `;
}

render(html`<${App} />`, document.getElementById('app'));

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}

let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
});
