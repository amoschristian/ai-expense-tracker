import { html } from '/static/lib/html.js';

export function Spinner({ text = 'Loading...' }) {
    return html`
        <section class="view">
            <div class="spinner-wrap">
                <div class="spinner"></div>
                <div class="spinner-text">${text}</div>
            </div>
        </section>
    `;
}
