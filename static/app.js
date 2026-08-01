import { useState, useEffect, useCallback } from 'https://esm.sh/preact@10.25.4/hooks';
import { render } from 'https://esm.sh/preact@10.25.4';
import { html } from '/static/lib/html.js';
import PullToRefresh from 'https://esm.sh/pulltorefreshjs@0.1.22';
import { fetchJSON, fetchCSRF, apiPost } from '/static/lib/utils.js';
import { Header } from '/static/components/Header.js';
import { SummaryView } from '/static/components/SummaryView.js';
import { TransactionView } from '/static/components/TransactionView.js';
import { MortgageView } from '/static/components/MortgageView.js';
import { RecurringView } from '/static/components/RecurringView.js';
import { TabBar } from '/static/components/TabBar.js';
import { ToastBar } from '/static/components/ToastBar.js';
import { SearchableSelect } from '/static/components/SearchableSelect.js';
import { AmountInput } from '/static/components/AmountInput.js';
import { showToast } from '/static/lib/toast.js';

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
    const [showAddModal, setShowAddModal] = useState(false);
    const [addForm, setAddForm] = useState({ date: '', account: 'bca', category: '', amount: '', description: '' });
    const [addErrors, setAddErrors] = useState({});
    const [addSaving, setAddSaving] = useState(false);

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

    const editCategories = categories.filter(c => !c.is_exclude);

    // Top 5 most-used expense categories this month (quick-pick chips)
    const topCategories = (() => {
        if (!monthData || !monthData.transactions) return [];
        const counts = {};
        monthData.transactions.forEach(t => {
            if (t.is_income) return;
            counts[t.category] = (counts[t.category] || 0) + 1;
        });
        return Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([cat]) => cat);
    })();

    function openAdd() {
        const today = new Date().toISOString().slice(0, 10);
        setAddForm({ date: today, account: account, category: '', amount: '', description: '' });
        setAddErrors({});
        setShowAddModal(true);
    }

    function closeAdd() {
        setShowAddModal(false);
        setAddErrors({});
    }

    function clearAddError(field) {
        if (addErrors[field]) setAddErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
    }

    async function handleAddSubmit(e) {
        e.preventDefault();
        const newErrors = {};
        if (!addForm.category) newErrors.category = true;
        if (!addForm.amount || parseInt(addForm.amount) <= 0) newErrors.amount = true;
        if (Object.keys(newErrors).length > 0) {
            setAddErrors(newErrors);
            return;
        }
        setAddSaving(true);
        const result = await apiPost('/api/transaction', {
            date: addForm.date,
            account: addForm.account,
            category: addForm.category,
            amount: parseInt(addForm.amount),
            description: addForm.description,
        });
        setAddSaving(false);
        if (result.error) {
            showToast(result.error, 'error');
        } else {
            showToast('Transaction added');
            closeAdd();
            reloadMonth();
            fetchJSON(`/api/balance?account=${account}`).then(d => { if (d && !d.error) setBalance(d); });
        }
    }

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
            showAccount=${view !== 'mortgage'}
        />
        <main id="content">
            ${view === 'summary' && html`<${SummaryView} data=${monthData} trend=${trendData} balance=${balance} categories=${categories} account=${account} />`}
            ${view === 'transactions' && html`<${TransactionView} data=${monthData} categories=${categories} onUpdated=${reloadMonth} />`}
            ${view === 'mortgage' && html`<${MortgageView} data=${mortgageData} />`}
            ${view === 'recurring' && html`<${RecurringView} categories=${categories} accounts=${accounts} account=${account} />`}
        </main>
        <${TabBar} active=${view} onChange=${setView} onAdd=${openAdd} />
        ${showAddModal && html`
            <div class="modal-overlay" onClick=${closeAdd}>
                <div class="modal" onClick=${e => e.stopPropagation()}>
                    <div class="modal-header">
                        <span class="modal-title">Add Transaction</span>
                        <button class="btn-icon" onClick=${closeAdd}>✕</button>
                    </div>
                    <form class="modal-form" onSubmit=${handleAddSubmit}>
                        <div class="form-field">
                            <label>Date</label>
                            <input type="date" value=${addForm.date}
                                onInput=${e => setAddForm({ ...addForm, date: e.target.value })} />
                        </div>
                        <div class="form-field">
                            <label>Account</label>
                            <select value=${addForm.account}
                                onChange=${e => setAddForm({ ...addForm, account: e.target.value })}>
                                ${accounts.map(a => html`<option key=${a.id} value=${a.id}>${a.id.toUpperCase()}</option>`)}
                            </select>
                        </div>
                        <div class="form-field${addErrors.amount ? ' has-error' : ''}">
                            <label>Amount</label>
                            <${AmountInput}
                                value=${addForm.amount}
                                onInput=${digits => { setAddForm({ ...addForm, amount: digits }); clearAddError('amount'); }}
                                hasError=${!!addErrors.amount}
                            />
                            ${addErrors.amount && html`<span class="field-error">Required</span>`}
                        </div>
                        <div class="form-field${addErrors.category ? ' has-error' : ''}">
                            <label>Category</label>
                            ${topCategories.length > 0 && html`
                                <div class="quick-chips">
                                    ${topCategories.map(c => html`
                                        <button type="button" class="quick-chip${addForm.category === c ? ' active' : ''}"
                                            onClick=${() => { setAddForm({ ...addForm, category: c }); clearAddError('category'); }}>
                                            ${c.includes(':') ? c.replace(':', ' · ') : c}
                                        </button>
                                    `)}
                                </div>
                            `}
                            <${SearchableSelect}
                                options=${editCategories.map(c => ({
                                    value: c.name,
                                    label: c.name.includes(':') ? c.name.replace(':', ' - ') : c.name,
                                    color: c.color,
                                }))}
                                value=${addForm.category}
                                onChange=${val => { setAddForm({ ...addForm, category: val }); clearAddError('category'); }}
                                placeholder="Select category"
                                hasError=${!!addErrors.category}
                            />
                            ${addErrors.category && html`<span class="field-error">Required</span>`}
                        </div>
                        <div class="form-field">
                            <label>Description (Optional)</label>
                            <input type="text" placeholder="Description (optional)" value=${addForm.description}
                                onInput=${e => setAddForm({ ...addForm, description: e.target.value })} />
                        </div>
                        <div class="form-actions">
                            <button type="submit" class="btn-primary" disabled=${addSaving}>${addSaving ? 'Saving...' : 'Save'}</button>
                            <button type="button" class="btn-secondary" onClick=${closeAdd}>Cancel</button>
                        </div>
                    </form>
                </div>
            </div>
        `}
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
