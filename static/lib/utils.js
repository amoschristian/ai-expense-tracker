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

export async function fetchJSON(url) {
    const res = await fetch(url);
    if (!res.ok) return null;
    return res.json();
}
