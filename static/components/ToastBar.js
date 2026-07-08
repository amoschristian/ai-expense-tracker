import { useState, useEffect } from 'https://esm.sh/preact@10.25.4/hooks';
import { html } from '/static/lib/html.js';
import { addToastListener } from '/static/lib/toast.js';

export function ToastBar() {
    const [toasts, setToasts] = useState([]);

    useEffect(() => {
        return addToastListener((message, type) => {
            const id = Date.now() + Math.random();
            setToasts(prev => [...prev, { id, message, type }]);
            setTimeout(() => {
                setToasts(prev => prev.filter(t => t.id !== id));
            }, 3000);
        });
    }, []);

    if (!toasts.length) return null;

    return html`
        <div class="toast-container">
            ${toasts.map(t => html`
                <div key=${t.id} class="toast toast-${t.type}">
                    <span>${t.message}</span>
                    <button class="toast-close" onClick=${() => setToasts(prev => prev.filter(x => x.id !== t.id))}>✕</button>
                </div>
            `)}
        </div>
    `;
}
