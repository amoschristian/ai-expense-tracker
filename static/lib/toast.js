const listeners = new Set();

export function addToastListener(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

export function showToast(message, type = 'success', action = null) {
    listeners.forEach(fn => fn(message, type, action));
}
