import { useState } from 'https://esm.sh/preact@10.25.4/hooks';
import { html } from '/static/lib/html.js';
import { DEFAULT_COLOR, fmtRp, getCatColor, shortDate } from '/static/lib/utils.js';
import { getChildName } from '/static/lib/icons.js';
import { CategoryIcon } from '/static/components/CategoryIcon.js';

export function TransactionView({ data, categories, onUpdated }) {
    const [query, setQuery] = useState('');
    const [catFilter, setCatFilter] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({ category: '', amount: '', description: '', date: '' });
    const [errors, setErrors] = useState({});

    if (!data || !data.transactions || !data.transactions.length) {
        return html`<section class="view"><div class="card empty">No transactions</div></section>`;
    }

    const q = query.toLowerCase();
    const filtered = data.transactions.filter(t => {
        if (catFilter) {
            const isChild = catFilter.includes(':');
            if (isChild) {
                if (t.category !== catFilter) return false;
            } else {
                if (t.category !== catFilter && !t.category.startsWith(catFilter + ':')) return false;
            }
        }
        if (dateFrom && t.date < dateFrom) return false;
        if (dateTo && t.date > dateTo) return false;
        if (!q) return true;
        return t.date.includes(q) ||
            t.category.toLowerCase().includes(q) ||
            t.description.toLowerCase().includes(q) ||
            String(t.amount).includes(q);
    });

    const editCategories = categories.filter(c => !c.is_exclude);

    const totalAmount = filtered.reduce((s, t) => s + (t.is_income ? t.amount : -t.amount), 0);

    const uniqueCats = [...new Set(data.transactions.map(t => t.category))];
    const childCats = uniqueCats.filter(c => c.includes(':'));
    const parentCats = uniqueCats.filter(c => !c.includes(':'));
    const impliedParents = [...new Set(childCats.map(c => c.split(':')[0]))];
    const parents = [...new Set([...parentCats, ...impliedParents])].sort();
    const childMap = {};
    childCats.forEach(c => {
        const p = c.split(':')[0];
        if (!childMap[p]) childMap[p] = [];
        childMap[p].push(c);
    });
    Object.values(childMap).forEach(arr => arr.sort());
    const sortedCats = parents.flatMap(p => [p, ...(childMap[p] || [])]);

    function startEdit(t) {
        setEditing(t);
        setForm({
            category: t.category,
            amount: t.amount,
            description: t.description || '',
            date: t.date,
        });
        setErrors({});
    }

    function closeModal() {
        setEditing(null);
        setErrors({});
    }

    function clearError(field) {
        if (errors[field]) setErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
    }

    async function handleSubmit(e) {
        e.preventDefault();
        const newErrors = {};
        if (!form.category) newErrors.category = true;
        if (!form.amount || parseInt(form.amount) <= 0) newErrors.amount = true;

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        const res = await fetch(`/api/transaction/${editing.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                category: form.category,
                amount: parseInt(form.amount),
                description: form.description,
                date: form.date,
            }),
        });

        if (res.ok) {
            closeModal();
            if (onUpdated) onUpdated();
        }
    }

    return html`
        <section class="view">
            <div class="tx-filters">
                <input
                    type="text"
                    id="tx-search"
                    placeholder="Search..."
                    autocomplete="off"
                    value=${query}
                    onInput=${e => setQuery(e.target.value)}
                />
                <select value=${catFilter} onChange=${e => setCatFilter(e.target.value)}>
                    <option value="">All categories</option>
                    ${sortedCats.map(c => {
                        const isChild = c.includes(':');
                        const label = isChild ? '- ' + getChildName(c) : c;
                        return html`<option key=${c} value=${c}>${label}</option>`;
                    })}
                </select>
            </div>
            <div class="tx-date-filters">
                <input
                    type="date"
                    placeholder="From"
                    value=${dateFrom}
                    onInput=${e => setDateFrom(e.target.value)}
                />
                <span class="tx-date-sep">–</span>
                <input
                    type="date"
                    placeholder="To"
                    value=${dateTo}
                    onInput=${e => setDateTo(e.target.value)}
                />
                ${(dateFrom || dateTo) && html`
                    <button class="btn-icon tx-date-clear" onClick=${() => { setDateFrom(''); setDateTo(''); }}>✕</button>
                `}
            </div>
            <div class="tx-summary">
                <span class="tx-summary-count">${filtered.length} item${filtered.length !== 1 ? 's' : ''}</span>
                <span class="tx-summary-total ${totalAmount >= 0 ? 'green' : 'red'}">${fmtRp(Math.abs(totalAmount))}</span>
            </div>
            <div class="tx-list">
                ${filtered.map((t, i) => {
                    const color = t.is_income ? '#9ece6a' : (t.color || getCatColor(t.category, categories));
                    const amt = t.is_income ? '+' + fmtRp(t.amount) : fmtRp(t.amount);
                    const cls = t.is_income ? 'green' : '';
                    const displayName = getChildName(t.category);
                    return html`
                        <div class="tx-row tx-editable" key=${i} onClick=${() => startEdit(t)}>
                            <div class="tx-left">
                                <div class="tx-date">${shortDate(t.date)}</div>
                                <div class="tx-cat" style=${{ color }}>
                                    <${CategoryIcon} category=${t.category} size=${14} color=${color} />
                                    <span>${displayName}</span>
                                </div>
                            </div>
                            <div class="tx-right">
                                <div class="tx-amt ${cls}">${amt}</div>
                                <div class="tx-desc">${t.description || ''}</div>
                            </div>
                        </div>
                    `;
                })}
            </div>

            ${editing && html`
                <div class="modal-overlay" onClick=${closeModal}>
                    <div class="modal" onClick=${e => e.stopPropagation()}>
                        <div class="modal-header">
                            <span class="modal-title">Edit Transaction</span>
                            <button class="btn-icon" onClick=${closeModal}>✕</button>
                        </div>
                        <form class="modal-form" onSubmit=${handleSubmit}>
                            <div class="form-field">
                                <label>Date</label>
                                <input type="date" value=${form.date}
                                    onInput=${e => setForm({ ...form, date: e.target.value })} />
                            </div>
                            <div class="modal-field">
                                <label>Account</label>
                                <div class="modal-value">${editing.account.toUpperCase()}</div>
                            </div>
                            <div class="form-field${errors.amount ? ' has-error' : ''}">
                                <label>Amount</label>
                                <input type="number" placeholder="Amount" value=${form.amount}
                                    onInput=${e => { setForm({ ...form, amount: e.target.value }); clearError('amount'); }} />
                                ${errors.amount && html`<span class="field-error">Required</span>`}
                            </div>
                            <div class="form-field${errors.category ? ' has-error' : ''}">
                                <label>Category</label>
                                <select value=${form.category} onChange=${e => { setForm({ ...form, category: e.target.value }); clearError('category'); }}>
                                    <option value="">Select category</option>
                                    ${editCategories.map(c => {
                                        const isChild = c.name.includes(':');
                                        const label = isChild ? '- ' + getChildName(c.name) : c.name;
                                        return html`<option key=${c.name} value=${c.name}>${label}</option>`;
                                    })}
                                </select>
                                ${errors.category && html`<span class="field-error">Required</span>`}
                            </div>
                            <div class="form-field">
                                <label>Description (Optional)</label>
                                <input type="textare" placeholder="Description (optional)" value=${form.description}
                                    onInput=${e => setForm({ ...form, description: e.target.value })} />
                            </div>
                            <div class="form-actions">
                                <button type="submit" class="btn-primary">Save</button>
                                <button type="button" class="btn-secondary" onClick=${closeModal}>Cancel</button>
                            </div>
                        </form>
                    </div>
                </div>
            `}
        </section>
    `;
}
