import { useState } from 'https://esm.sh/preact@10.25.4/hooks';
import { html } from '/static/lib/html.js';
import { Target, Pencil, Trash2 } from 'https://esm.sh/lucide-preact@1.21.0?deps=preact@10.25.4';
import { MONTHS, fmtRp, fetchJSON, apiPost, apiPut, apiDelete } from '/static/lib/utils.js';
import { showToast } from '/static/lib/toast.js';
import { Spinner } from '/static/components/Spinner.js';
import { AmountInput } from '/static/components/AmountInput.js';

const PALETTE = ['#9ece6a', '#7dcfff', '#bb9af7', '#e0af68', '#f7768e'];

function localDateStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatTargetDate(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    return `${MONTHS[parseInt(parts[1]) - 1]} ${parts[0]}`;
}

export function GoalsView({ goals, accounts, onBack, onUpdated }) {
    const [editing, setEditing] = useState(null);
    const [confirmDelete, setConfirmDelete] = useState(null);
    const [form, setForm] = useState({ name: '', target_amount: '', account: 'amos', target_date: '', note: '' });
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);

    if (!goals) {
        return html`<${Spinner} text="Loading goals..." />`;
    }

    const list = goals.goals || [];
    const accOptions = accounts && accounts.length ? accounts : [{ id: 'bca' }, { id: 'amos' }, { id: 'house' }];

    function resetForm() {
        setForm({ name: '', target_amount: '', account: 'amos', target_date: '', note: '' });
        setEditing(null);
        setConfirmDelete(null);
        setErrors({});
    }

    function startEdit(goal) {
        setForm({
            name: goal.name,
            target_amount: String(goal.target_amount),
            account: goal.account,
            target_date: goal.target_date || '',
            note: goal.note || '',
        });
        setEditing(goal.id);
        setConfirmDelete(null);
        setErrors({});
    }

    function clearError(field) {
        if (errors[field]) setErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
    }

    async function handleSubmit(e) {
        e.preventDefault();
        const newErrors = {};
        if (!form.name.trim()) newErrors.name = true;
        if (!form.target_amount || parseInt(form.target_amount) <= 0) newErrors.target_amount = true;
        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        setSaving(true);
        const payload = {
            name: form.name.trim(),
            target_amount: parseInt(form.target_amount),
            account: form.account,
            target_date: form.target_date || null,
            note: form.note.trim() || null,
        };
        const url = editing ? `/api/goals/${editing}` : '/api/goals';
        const method = editing ? apiPut : apiPost;
        const result = await method(url, payload);
        setSaving(false);

        if (result.error) {
            showToast(result.error, 'error');
        } else {
            showToast(editing ? 'Goal updated' : 'Goal added');
            resetForm();
            onUpdated();
        }
    }

    async function handleDelete(id) {
        setSaving(true);
        const result = await apiDelete(`/api/goals/${id}`);
        setSaving(false);
        if (result.error) {
            showToast(result.error, 'error');
        } else {
            showToast('Goal deleted');
            setConfirmDelete(null);
            resetForm();
            onUpdated();
        }
    }

    return html`
        <section class="view">
            ${onBack && html`
            <button class="mortgage-back" onClick=${onBack}>
                ← Back to Summary
            </button>
            `}

            <div class="card balance-card">
                <div class="label">Saved Toward Goals</div>
                <div class="value">${fmtRp(goals.total_progress)}</div>
                <div class="progress-header" style=${{ marginTop: '12px' }}>
                    <span>of ${fmtRp(goals.total_target)} total target</span>
                    <span>${goals.total_pct}%</span>
                </div>
                <div class="progress-bar-wrap">
                    <div class="progress-bar paid" style=${{ width: goals.total_pct + '%' }}></div>
                </div>
            </div>

            <div class="card">
                <div class="card-header-row">
                    <div class="card-title">${editing ? 'Edit Goal' : 'New Goal'}</div>
                    ${editing && (confirmDelete === editing
                        ? html`
                            <div class="header-confirm">
                                <button type="button" class="btn-header-danger" onClick=${() => handleDelete(editing)}>Delete</button>
                                <button type="button" class="btn-header-ghost" onClick=${() => setConfirmDelete(null)}>Keep</button>
                            </div>
                        `
                        : html`
                            <button type="button" class="btn-header-icon btn-trash" onClick=${() => setConfirmDelete(editing)} title="Delete goal">
                                <${Trash2} size=${16} />
                            </button>
                        `
                    )}
                </div>
                <form class="recurring-form" onSubmit=${handleSubmit}>
                    <div class="form-field${errors.name ? ' has-error' : ''}">
                        <input type="text" placeholder="Goal name (e.g. VKB STECS)" value=${form.name}
                            onInput=${e => { setForm({ ...form, name: e.target.value }); clearError('name'); }} />
                        ${errors.name && html`<span class="field-error">Required</span>`}
                    </div>
                    <div class="form-field${errors.target_amount ? ' has-error' : ''}">
                        <${AmountInput}
                            value=${form.target_amount}
                            onInput=${digits => { setForm({ ...form, target_amount: digits }); clearError('target_amount'); }}
                            placeholder="Target amount"
                            hasError=${!!errors.target_amount}
                        />
                        ${errors.target_amount && html`<span class="field-error">Required</span>`}
                    </div>
                    <div class="form-row">
                        <select value=${form.account} onChange=${e => setForm({ ...form, account: e.target.value })}>
                            ${accOptions.map(a => html`<option key=${a.id} value=${a.id}>${a.id.toUpperCase()}</option>`)}
                        </select>
                        <input type="date" value=${form.target_date}
                            onInput=${e => setForm({ ...form, target_date: e.target.value })} />
                    </div>
                    <div class="form-field">
                        <input type="text" placeholder="Note (optional)" value=${form.note}
                            onInput=${e => setForm({ ...form, note: e.target.value })} />
                    </div>
                    <div class="form-hint">Progress = current ${form.account.toUpperCase()} balance vs target. Add money to the account and the bar fills itself.</div>
                    <div class="form-actions">
                        <button type="submit" class="btn-primary" disabled=${saving}>${saving ? 'Saving...' : (editing ? 'Update' : 'Add')}</button>
                        ${editing && html`<button type="button" class="btn-secondary" onClick=${resetForm}>Cancel</button>`}
                    </div>
                </form>
            </div>

            <div class="goals-list">
                <div class="card-title">Goals (${list.length})</div>
                ${list.length ? list.map(goal => {
                    const color = PALETTE[goal.id % PALETTE.length];
                    const deadline = goal.target_date
                        ? `by ${formatTargetDate(goal.target_date)}`
                        : 'no deadline';
                    return html`
                        <div class="card goal-card${goal.achieved ? ' achieved' : ''}" key=${goal.id}>
                            <div class="goal-card-head">
                                <div class="goal-card-name" style=${{ color }}>
                                    <${Target} size=${14} />
                                    ${goal.name}
                                </div>
                                <button class="btn-header-icon" onClick=${() => startEdit(goal)} title="Edit goal">
                                    <${Pencil} size=${14} />
                                </button>
                            </div>
                            <div class="goal-card-note">${deadline}${goal.account ? ` · ${goal.account.toUpperCase()}` : ''}${goal.note ? ` · ${goal.note}` : ''}</div>
                            ${goal.achieved
                                ? html`<div class="goal-achieved-tag">✓ Achieved</div>`
                                : html`
                                    <div class="progress-header">
                                        <span>${fmtRp(goal.progress)} of ${fmtRp(goal.target_amount)}</span>
                                        <span>${goal.pct}%</span>
                                    </div>
                                    <div class="progress-bar-wrap">
                                        <div class="progress-bar paid" style=${{ background: color, width: goal.pct + '%' }}></div>
                                    </div>
                                    <div class="progress-labels">
                                        <span>${fmtRp(goal.remaining)} to go</span>
                                        ${goal.monthly_needed !== null && goal.monthly_needed !== undefined
                                            ? html`<span>${fmtRp(goal.monthly_needed)}/mo needed</span>`
                                            : (goal.months_left === 0 ? html`<span>due this month</span>` : html``)}
                                    </div>
                                `}
                        </div>
                    `;
                }) : html`<div class="empty">No goals yet — add one above</div>`}
            </div>
        </section>
    `;
}
