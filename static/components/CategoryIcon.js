import { html } from '../lib/html.js';
import { PARENT_ICONS, getParentName } from '../lib/icons.js';

export function CategoryIcon({ category, size = 16, color }) {
    const parent = getParentName(category);
    const Icon = PARENT_ICONS[parent] || PARENT_ICONS.Other;
    return html`<span class="cat-icon" style=${{ color: color || 'currentColor' }}><${Icon} size=${size} /></span>`;
}
