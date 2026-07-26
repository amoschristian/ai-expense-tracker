import { useState, useEffect, useRef } from 'https://esm.sh/preact@10.25.4/hooks';
import { html } from '/static/lib/html.js';

export function SearchableSelect({ options, value, onChange, placeholder, hasError }) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [highlight, setHighlight] = useState(-1);
    const containerRef = useRef(null);
    const inputRef = useRef(null);

    const selectedOption = options.find(o => {
        const v = typeof o === 'string' ? o : o.value;
        return v === value;
    });

    function getLabel(opt) {
        if (!opt) return '';
        if (typeof opt === 'string') return opt;
        return opt.label || opt.name || '';
    }

    function getColor(opt) {
        if (typeof opt === 'string') return null;
        return opt.color || null;
    }

    const displayValue = open ? query : getLabel(selectedOption);

    const filtered = options.filter(opt => {
        if (!query) return true;
        const text = getLabel(opt).toLowerCase();
        return text.includes(query.toLowerCase());
    });

    useEffect(() => {
        function handleClick(e) {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setOpen(false);
                setQuery('');
            }
        }
        if (open) {
            document.addEventListener('mousedown', handleClick);
            return () => document.removeEventListener('mousedown', handleClick);
        }
    }, [open]);

    useEffect(() => {
        setHighlight(-1);
    }, [query]);

    function select(opt) {
        const val = typeof opt === 'string' ? opt : (opt.value || opt.name);
        onChange(val);
        setOpen(false);
        setQuery('');
    }

    function handleFocus() {
        setOpen(true);
        setQuery('');
        if (inputRef.current) inputRef.current.select();
    }

    function handleKeyDown(e) {
        if (!open) { setOpen(true); return; }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlight(h => Math.min(h + 1, filtered.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlight(h => Math.max(h - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (highlight >= 0 && filtered[highlight]) {
                select(filtered[highlight]);
            } else if (filtered.length === 1) {
                select(filtered[0]);
            }
        } else if (e.key === 'Escape') {
            setOpen(false);
            setQuery('');
        }
    }

    function handleClear(e) {
        e.stopPropagation();
        onChange('');
        setQuery('');
    }

    const hasValue = value !== '' && value != null;
    const cls = 'ss-container' + (hasError ? ' has-error' : '') + (open ? ' ss-open' : '');

    return html`
        <div class=${cls} ref=${containerRef}>
            <input
                ref=${inputRef}
                type="text"
                class="ss-input"
                placeholder=${placeholder || 'Select...'}
                value=${displayValue}
                onInput=${e => setQuery(e.target.value)}
                onFocus=${handleFocus}
                onKeyDown=${handleKeyDown}
                autocomplete="off"
            />
            ${hasValue && !open && html`
                <button class="ss-clear" onClick=${handleClear} type="button" tabIndex=${-1}>×</button>
            `}
            ${open && html`
                <div class="ss-dropdown">
                    ${filtered.length === 0 && html`
                        <div class="ss-empty">No matches</div>
                    `}
                    ${filtered.map((opt, i) => {
                        const label = getLabel(opt);
                        const color = getColor(opt);
                        const isSelected = (typeof opt === 'string' ? opt : (opt.value || opt.name)) === value;
                        const isHighlight = i === highlight;
                        let cls2 = 'ss-option';
                        if (isSelected) cls2 += ' ss-selected';
                        if (isHighlight) cls2 += ' ss-highlight';
                        return html`
                            <div class=${cls2} key=${i}
                                onMouseDown=${e => { e.preventDefault(); select(opt); }}
                                onMouseEnter=${() => setHighlight(i)}>
                                ${color && html`<span class="ss-dot" style=${{ background: color }}></span>`}
                                <span>${label}</span>
                            </div>
                        `;
                    })}
                </div>
            `}
        </div>
    `;
}
