export const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
export const DEFAULT_COLOR = '#a9b1d6';

export function fmtRp(n) {
    return 'Rp ' + n.toLocaleString('id-ID');
}

export function shortDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    return `${days[d.getDay()]}, ${String(d.getDate()).padStart(2,'0')} ${MONTHS[d.getMonth()]}`;
}

export function getCatColor(cat, categories) {
    const match = categories && categories.find(c => c.name === cat);
    return match ? match.color : DEFAULT_COLOR;
}

let csrfToken = null;

export async function fetchCSRF() {
    const res = await fetch('/api/csrf-token');
    if (res.ok) {
        const data = await res.json();
        csrfToken = data.token;
    }
}

export async function fetchJSON(url) {
    const res = await fetch(url);
    if (!res.ok) {
        let msg;
        try { const d = await res.json(); msg = d.error; } catch { msg = res.statusText; }
        return { error: msg || `HTTP ${res.status}`, status: res.status };
    }
    return res.json();
}

async function apiFetch(url, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (csrfToken && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(options.method)) {
        headers['X-CSRF-Token'] = csrfToken;
    }
    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
        let msg;
        try { const d = await res.json(); msg = d.error; } catch { msg = res.statusText; }
        return { error: msg || `HTTP ${res.status}`, status: res.status };
    }
    return res.json();
}

export function apiPost(url, body) {
    return apiFetch(url, { method: 'POST', body: JSON.stringify(body) });
}

export function apiPut(url, body) {
    return apiFetch(url, { method: 'PUT', body: JSON.stringify(body) });
}

export function apiDelete(url) {
    return apiFetch(url, { method: 'DELETE' });
}
