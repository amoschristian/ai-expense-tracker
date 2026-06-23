import { useState, useEffect, useCallback } from 'https://esm.sh/preact@10.25.4/hooks';
import { html } from '/static/lib/html.js';
import { DEFAULT_COLOR, fmtRp, fetchJSON } from '/static/lib/utils.js';
import { getChildName } from '/static/lib/icons.js';
import { CategoryIcon } from '/static/components/CategoryIcon.js';

export function RecurringView({ categories }) {
    const [items, setItems] = useState([]);
    const [editing, setEditing] = useState(null);
    const today = new Date().toISOString().slice(0, 10);
    const [form, setForm] = useState({ name: '', amount: '', category: '', account: 'bca', frequency: 'monthly', day_of_month: '', start_date: today, end_date: '' });
    const [confirmDelete, setConfirmDelete] = useState(null);
    const [errors, setErrors] = useState({});

    const load = useCallback(() => {
        fetchJSON('/api/recurring').then(d => { if (d) setItems(d); });
    }, []);

    useEffect(() => { load(); }, [load]);

    const freqLabels = { monthly: 'Monthly', yearly: 'Yearly', weekly: 'Weekly' };
    const expenseCategories = categories.filter(c => !c.is_income && !c.is_transfer);

    function resetForm() {
        const t = new Date().toISOString().slice(0, 10);
        setForm({ name: '', amount: '', category: '', account: 'bca', frequency: 'monthly', day_of_month: '', start_date: t, end_date: '' });
        setEditing(null);
        setErrors({});
    }

    function startEdit(item) {
        setForm({
            name: item.name,
            amount: item.amount,
            category: item.category,
            account: item.account,
            frequency: item.frequency,
            day_of_month: item.day_of_month || '',
            start_date: item.start_date || new Date().toISOString().slice(0, 10),
            end_date: '',
        });
        setEditing(item.id);
    }

    function clearError(field) {
        if (errors[field]) setErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
    }

    async function handleSubmit(e) {
        e.preventDefault();
        const newErrors = {};
        if (!form.name.trim()) newErrors.name = true;
        if (!form.amount || parseInt(form.amount) <= 0) newErrors.amount = true;
        if (!form.category) newErrors.category = true;

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        const payload = { ...form, amount: parseInt(form.amount) };
        const url = editing ? `/api/recurring/${editing}` : '/api/recurring';
        const method = editing ? 'PUT' : 'POST';
        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (res.ok) {
            resetForm();
            load();
        }
    }

    async function handleDelete(id) {
        const res = await fetch(`/api/recurring/${id}`, { method: 'DELETE' });
        if (res.ok) {
            setConfirmDelete(null);
            load();
        }
    }

    const totalMonthly = items.reduce((sum, item) => {
        if (item.frequency === 'monthly') return sum + item.amount;
        if (item.frequency === 'yearly') return sum + Math.round(item.amount / 12);
        if (item.frequency === 'weekly') return sum + Math.round(item.amount * 4.33);
        return sum;
    }, 0);

    return html`
        <section class="view">
            <div class="card balance-card">
                <div class="label">Monthly Recurring</div>
                <div class="value red">${fmtRp(totalMonthly)}</div>
            </div>

            <div class="card">
                <div class="card-title">${editing ? 'Edit' : 'Add'} Recurring Expense</div>
                <form class="recurring-form" onSubmit=${handleSubmit}>
                    <div class="form-field${errors.name ? ' has-error' : ''}">
                        <input type="text" placeholder="Name" value=${form.name}
                            onInput=${e => { setForm({ ...form, name: e.target.value }); clearError('name'); }} />
                        ${errors.name && html`<span class="field-error">Required</span>`}
                    </div>
                    <div class="form-field${errors.amount ? ' has-error' : ''}">
                        <input type="number" placeholder="Amount" value=${form.amount}
                            onInput=${e => { setForm({ ...form, amount: e.target.value }); clearError('amount'); }} />
                        ${errors.amount && html`<span class="field-error">Required</span>`}
                    </div>
                    <div class="form-field${errors.category ? ' has-error' : ''}">
                        <select value=${form.category} onChange=${e => { setForm({ ...form, category: e.target.value }); clearError('category'); }}>
                            <option value="">Category</option>
                            ${expenseCategories.map(c => {
                                const isChild = c.name.includes(':');
                                const label = isChild ? '- ' + getChildName(c.name) : c.name;
                                return html`<option key=${c.name} value=${c.name}>${label}</option>`;
                            })}
                        </select>
                        ${errors.category && html`<span class="field-error">Required</span>`}
                    </div>
                    <select value=${form.account} onChange=${e => setForm({ ...form, account: e.target.value })}>
                        <option value="bca">BCA</option>
                        <option value="house">House</option>
                    </select>
                    <div class="form-row">
                        <select value=${form.frequency} onChange=${e => setForm({ ...form, frequency: e.target.value })}>
                            <option value="monthly">Monthly</option>
                            <option value="yearly">Yearly</option>
                            <option value="weekly">Weekly</option>
                        </select>
                        ${form.frequency === 'monthly' && html`
                            <input type="number" placeholder="Day" min="1" max="28" value=${form.day_of_month}
                                onInput=${e => setForm({ ...form, day_of_month: e.target.value })} />
                        `}
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn-primary">${editing ? 'Update' : 'Add'}</button>
                        ${editing && html`<button type="button" class="btn-secondary" onClick=${resetForm}>Cancel</button>`}
                    </div>
                </form>
            </div>

            <div class="card">
                <div class="card-title">Recurring Expenses (${items.length})</div>
                ${items.length ? items.map(item => {
                    const color = item.color || DEFAULT_COLOR;
                    const monthly = item.frequency === 'monthly' ? item.amount
                        : item.frequency === 'yearly' ? Math.round(item.amount / 12)
                        : Math.round(item.amount * 4.33);
                    return html`
                        <div class="recurring-row" key=${item.id}>
                            <div class="recurring-left">
                                <div class="recurring-name" style=${{ color }}>${item.name}</div>
                                <div class="recurring-meta">
                                    <${CategoryIcon} category=${item.category} size=${12} color=${color} />
                                    <span>${getChildName(item.category)}</span>
                                    <span> · ${freqLabels[item.frequency] || item.frequency}${item.day_of_month ? ' · day ' + item.day_of_month : ''} · ${item.account.toUpperCase()}</span>
                                </div>
                            </div>
                            <div class="recurring-right">
                                <div class="recurring-amt">${fmtRp(item.amount)}</div>
                                <div class="recurring-monthly">~${fmtRp(monthly)}/mo</div>
                            </div>
                            <div class="recurring-actions">
                                <button class="btn-icon" onClick=${() => startEdit(item)}>✎</button>
                                ${confirmDelete === item.id
                                    ? html`
                                        <button class="btn-icon btn-danger" onClick=${() => handleDelete(item.id)}>✓</button>
                                        <button class="btn-icon" onClick=${() => setConfirmDelete(null)}>✗</button>
                                    `
                                    : html`
                                        <button class="btn-icon btn-danger-outline" onClick=${() => setConfirmDelete(item.id)}>✕</button>
                                    `
                                }
                            </div>
                        </div>
                    `;
                }) : html`<div class="empty">No recurring expenses</div>`}
            </div>
        </section>
    `;
}
