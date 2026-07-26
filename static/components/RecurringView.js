import { useState, useEffect, useCallback } from 'https://esm.sh/preact@10.25.4/hooks';
import { html } from '/static/lib/html.js';
import { Calendar } from 'https://esm.sh/lucide-preact@1.21.0?deps=preact@10.25.4';
import { DEFAULT_COLOR, fmtRp, fetchJSON, apiPost, apiPut, apiDelete } from '/static/lib/utils.js';
import { showToast } from '/static/lib/toast.js';
import { CategoryIcon } from '/static/components/CategoryIcon.js';
import { Spinner } from '/static/components/Spinner.js';
import { SearchableSelect } from '/static/components/SearchableSelect.js';

export function RecurringView({ categories, accounts, account }) {
    const [items, setItems] = useState(null);
    const [editing, setEditing] = useState(null);
    const today = new Date().toISOString().slice(0, 10);
    const [form, setForm] = useState({ name: '', amount: '', category: '', account: account, frequency: 'monthly', day_of_month: '', start_date: today, end_date: '' });
    const [confirmDelete, setConfirmDelete] = useState(null);
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);

    const load = useCallback(() => {
        fetchJSON('/api/recurring').then(d => { if (d && !d.error) setItems(d); });
    }, []);

    useEffect(() => { load(); }, [load]);

    const expenseCategories = categories.filter(c => !c.is_income && !c.is_exclude);

    function formatFrequency(item) {
        if (item.frequency === 'monthly' && item.day_of_month) {
            const d = item.day_of_month;
            const suf = d === 1 || d === 21 || d === 31 ? 'st' : d === 2 || d === 22 ? 'nd' : d === 3 || d === 23 ? 'rd' : 'th';
            return `every ${d}${suf} day of month`;
        }
        if (item.frequency === 'monthly') return 'monthly';
        if (item.frequency === 'yearly') return 'yearly';
        if (item.frequency === 'weekly') return 'weekly';
        return item.frequency;
    }

    function formatCategory(cat) {
        if (!cat.includes(':')) return cat;
        return cat.replace(':', ' - ');
    }

    function resetForm() {
        const t = new Date().toISOString().slice(0, 10);
        setForm({ name: '', amount: '', category: '', account: account, frequency: 'monthly', day_of_month: '', start_date: t, end_date: '' });
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

        setSaving(true);
        const payload = { ...form, amount: parseInt(form.amount) };
        const url = editing ? `/api/recurring/${editing}` : '/api/recurring';
        const method = editing ? apiPut : apiPost;
        const result = await method(url, payload);
        setSaving(false);

        if (result.error) {
            showToast(result.error, 'error');
        } else {
            showToast(editing ? 'Recurring expense updated' : 'Recurring expense added');
            resetForm();
            load();
        }
    }

    async function handleDelete(id) {
        setSaving(true);
        const result = await apiDelete(`/api/recurring/${id}`);
        setSaving(false);
        if (result.error) {
            showToast(result.error, 'error');
        } else {
            showToast('Recurring expense deleted');
            setConfirmDelete(null);
            load();
        }
    }

    async function handlePay(id) {
        setSaving(true);
        const todayStr = new Date().toISOString().slice(0, 10);
        const result = await apiPost(`/api/recurring/${id}/pay`, { date: todayStr });
        setSaving(false);
        if (result.error) {
            showToast(result.error, 'error');
        } else {
            showToast('Marked as paid');
            load();
        }
    }

    async function handleUnpay(id) {
        setSaving(true);
        const result = await apiDelete(`/api/recurring/${id}/pay`);
        setSaving(false);
        if (result.error) {
            showToast(result.error, 'error');
        } else {
            showToast('Payment undone');
            load();
        }
    }

    if (items === null) {
        return html`<${Spinner} text="Loading recurring expenses..." />`;
    }

    const filteredItems = items.filter(item => item.account === account);

    const totalMonthly = filteredItems.reduce((sum, item) => {
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
                        <${SearchableSelect}
                            options=${expenseCategories.map(c => ({
                                value: c.name,
                                label: c.name.includes(':') ? c.name.replace(':', ' - ') : c.name,
                                color: c.color,
                            }))}
                            value=${form.category}
                            onChange=${val => { setForm({ ...form, category: val }); clearError('category'); }}
                            placeholder="Category"
                            hasError=${!!errors.category}
                        />
                        ${errors.category && html`<span class="field-error">Required</span>`}
                    </div>
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
                        <button type="submit" class="btn-primary" disabled=${saving}>${saving ? 'Saving...' : (editing ? 'Update' : 'Add')}</button>
                        ${editing && html`<button type="button" class="btn-secondary" onClick=${resetForm}>Cancel</button>`}
                    </div>
                </form>
            </div>

            <div class="card">
                <div class="card-title">Recurring Expenses (${filteredItems.length})</div>
                ${filteredItems.length ? filteredItems.map(item => {
                    const color = item.color || DEFAULT_COLOR;
                    return html`
                        <div class="recurring-row${item.paid ? ' paid' : ''}" key=${item.id}>
                            <div class="recurring-left">
                                <div class="recurring-name" style=${{ color }}>${item.name}</div>
                                <div class="recurring-cat">
                                    <${CategoryIcon} category=${item.category} size=${12} color=${color} />
                                    <span>${formatCategory(item.category)}</span>
                                </div>
                                <div class="recurring-freq">
                                    <${Calendar} size=${11} />
                                    ${formatFrequency(item)}
                                    ${item.paid && html` · <span class="paid-tag">Paid ${item.paid_date}</span>`}
                                </div>
                            </div>
                            <div class="recurring-right">
                                <div class="recurring-amt">${fmtRp(item.amount)}</div>
                            </div>
                            <div class="recurring-actions">
                                ${item.paid
                                    ? html`
                                        <button class="btn-paid" onClick=${() => handleUnpay(item.id)} title="Undo payment">Paid ✓</button>
                                    `
                                    : html`
                                        <button class="btn-pay" onClick=${() => handlePay(item.id)} disabled=${saving}>Pay</button>
                                    `
                                }
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
