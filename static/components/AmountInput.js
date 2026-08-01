import { html } from '/static/lib/html.js';

/**
 * AmountInput — number-only input with live id-ID thousand separators.
 * The displayed value shows dots (1.250.000); the stored value passed via
 * onInput is always raw digits (1250000).
 *
 * Props:
 *   value       — raw digits (string or number), no separators
 *   onInput     — (rawDigits: string) => void
 *   placeholder — optional placeholder text
 *   hasError    — boolean, adds .has-error styling
 */
export function AmountInput({ value, onInput, placeholder = 'Amount', hasError = false }) {
    const display = value === '' || value === null || value === undefined
        ? ''
        : Number(value).toLocaleString('id-ID');
    return html`
        <input
            type="text"
            inputmode="numeric"
            placeholder=${placeholder}
            class=${hasError ? 'has-error' : ''}
            value=${display}
            onInput=${e => {
                const digits = e.target.value.replace(/\D/g, '');
                onInput(digits);
            }}
        />
    `;
}
