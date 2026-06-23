import { h, render } from 'https://esm.sh/preact@10.25.4';
import { useState, useEffect, useCallback } from 'https://esm.sh/preact@10.25.4/hooks';
import htm from 'https://esm.sh/htm@3.1.1';

const html = htm.bind(h);

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DEFAULT_COLOR = '#a9b1d6';

function fmtRp(n) {
    return 'Rp ' + n.toLocaleString('id-ID');
}

function shortDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    return `${days[d.getDay()]}, ${String(d.getDate()).padStart(2,'0')} ${MONTHS[d.getMonth()]}`;
}

function getCatColor(cat, categories) {
    const match = categories && categories.find(c => c.name === cat);
    return match ? match.color : DEFAULT_COLOR;
}

async function fetchJSON(url) {
    const res = await fetch(url);
    if (!res.ok) return null;
    return res.json();
}

function Header({ year, month, account, accounts, onPrev, onNext, onAccountChange }) {
    return html`
        <header>
            <div class="header-row">
                <button class="nav-btn" onClick=${onPrev}>‹</button>
                <h1>${MONTHS[month - 1]} ${year}</h1>
                <button class="nav-btn" onClick=${onNext}>›</button>
            </div>
            <select class="account-select" value=${account} onChange=${e => onAccountChange(e.target.value)}>
                ${accounts.map(a => html`<option key=${a.id} value=${a.id}>${a.id.toUpperCase()}</option>`)}
            </select>
        </header>
    `;
}

function SummaryView({ data, trend, balance, categories }) {
    if (!data || data.error) {
        return html`<section class="view"><div class="card empty">No data for this month</div></section>`;
    }
    const netColor = data.net >= 0 ? '#9ece6a' : '#f7768e';
    const balanceStr = balance ? fmtRp(balance.balance) : '—';
    const top = data.categories.slice(0, 8);

    const trendCards = trend && trend.months && trend.months.length
        ? (() => {
            const maxAbs = Math.max(...trend.months.map(m => Math.abs(m.net)), 1);
            return trend.months.map(m => {
                const pct = Math.max((Math.abs(m.net) / maxAbs) * 100, 2);
                const color = m.net >= 0 ? '#9ece6a' : '#f7768e';
                const sign = m.net >= 0 ? '+' : '−';
                return html`
                    <div class="trend-row" key=${m.name}>
                        <span class="trend-label">${m.name}</span>
                        <div class="trend-bar-wrap">
                            <div class="trend-bar" style=${{ width: pct + '%', background: color }}></div>
                        </div>
                        <span class="trend-amt" style=${{ color }}>${sign} ${fmtRp(Math.abs(m.net))}</span>
                    </div>
                `;
            });
        })()
        : html`<div class="empty">No trend data</div>`;

    return html`
        <section class="view">
            <div class="card balance-card">
                <div class="label">Current Balance</div>
                <div class="value">${balanceStr}</div>
            </div>
            <div class="stats-row">
                <div class="stat">
                    <div class="label">Income</div>
                    <div class="value green">${fmtRp(data.income)}</div>
                </div>
                <div class="stat">
                    <div class="label">Expense</div>
                    <div class="value red">${fmtRp(data.expense)}</div>
                </div>
                <div class="stat">
                    <div class="label">Net</div>
                    <div class="value" style=${{ color: netColor }}>${fmtRp(data.net)}</div>
                </div>
            </div>
            <div class="card">
                <div class="card-title">Top Categories</div>
                ${top.length ? top.map(c => {
                    const color = c.color || getCatColor(c.name, categories);
                    const display = c.name.length > 14 ? c.name.slice(0,12)+'..' : c.name;
                    return html`
                        <div class="cat-row" key=${c.name}>
                            <span class="cat-name" style=${{ color }}>${display}</span>
                            <span class="cat-amt">${fmtRp(c.amount)}</span>
                            <div class="cat-bar-wrap">
                                <div class="cat-bar" style=${{ width: c.pct + '%', background: color }}></div>
                            </div>
                            <span class="cat-pct">${c.pct}%</span>
                        </div>
                    `;
                }) : html`<div class="empty">No expenses</div>`}
            </div>
            <div class="card">
                <div class="card-title">6-Month Net Cash Flow</div>
                ${trendCards}
            </div>
        </section>
    `;
}

function TransactionView({ data, categories }) {
    const [query, setQuery] = useState('');
    if (!data || !data.transactions || !data.transactions.length) {
        return html`<section class="view"><div class="card empty">No transactions</div></section>`;
    }

    const q = query.toLowerCase();
    const filtered = q
        ? data.transactions.filter(t =>
            t.date.includes(q) ||
            t.category.toLowerCase().includes(q) ||
            t.description.toLowerCase().includes(q) ||
            String(t.amount).includes(q)
          )
        : data.transactions;

    return html`
        <section class="view">
            <div class="search-wrap">
                <input
                    type="text"
                    id="tx-search"
                    placeholder="Search transactions..."
                    autocomplete="off"
                    value=${query}
                    onInput=${e => setQuery(e.target.value)}
                />
            </div>
            <div class="tx-list">
                ${filtered.map((t, i) => {
                    const color = t.is_income ? '#9ece6a' : (t.color || getCatColor(t.category, categories));
                    const amt = t.is_income ? '+' + fmtRp(t.amount) : fmtRp(t.amount);
                    const cls = t.is_income ? 'green' : '';
                    return html`
                        <div class="tx-row" key=${i}>
                            <div class="tx-left">
                                <div class="tx-date">${shortDate(t.date)}</div>
                                <div class="tx-cat" style=${{ color }}>${t.category}</div>
                            </div>
                            <div class="tx-right">
                                <div class="tx-amt ${cls}">${amt}</div>
                                <div class="tx-desc">${t.description || ''}</div>
                            </div>
                        </div>
                    `;
                })}
            </div>
        </section>
    `;
}

function TabBar({ active, onChange }) {
    const tabs = ['summary', 'transactions'];
    const labels = { summary: 'Summary', transactions: 'Transactions' };
    return html`
        <nav id="tab-bar">
            ${tabs.map(t => html`
                <button
                    key=${t}
                    class=${'tab' + (active === t ? ' active' : '')}
                    onClick=${() => onChange(t)}
                >${labels[t]}</button>
            `)}
        </nav>
    `;
}

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
        />
        <main id="content">
            ${view === 'summary' && html`<${SummaryView} data=${monthData} trend=${trendData} balance=${balance} categories=${categories} />`}
            ${view === 'transactions' && html`<${TransactionView} data=${monthData} categories=${categories} />`}
        </main>
        <${TabBar} active=${view} onChange=${setView} />
    `;
}

render(html`<${App} />`, document.getElementById('app'));
