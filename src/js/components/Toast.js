// Toast notifications. Rendered in the browser top layer (Popover API) so they
// stay visible above open <dialog> drawers/modals. Messages are set with
// textContent — never innerHTML — so Firebase error strings can't inject markup.
let host = null;

function ensureHost() {
  if (host && host.isConnected) return host;
  host = document.createElement('div');
  host.className = 'toasts';
  if ('popover' in HTMLElement.prototype) host.setAttribute('popover', 'manual');
  document.body.appendChild(host);
  return host;
}

// Re-show the popover so it sits above any dialog opened after it.
function raise() {
  if (!host?.showPopover) return;
  try {
    if (host.matches(':popover-open')) host.hidePopover();
    host.showPopover();
  } catch { /* popover unsupported or detached — toasts still render inline */ }
}

function settle() {
  if (host && !host.children.length && host.hidePopover) {
    try { host.hidePopover(); } catch {}
  }
}

/**
 * @param {string} message
 * @param {'success'|'error'|'info'} [type]
 * @param {{timeout?: number}} [opts]  timeout 0 = sticky
 * @returns {() => void} dismiss
 */
export function toast(message, type = 'info', { timeout = type === 'error' ? 6000 : 3500 } = {}) {
  try {
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');
    el.innerHTML = `
      <span class="toast-ico" aria-hidden="true"></span>
      <span class="toast-msg"></span>
      <button class="toast-x" type="button" aria-label="Dismiss notification">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      </button>`;
    el.querySelector('.toast-msg').textContent = String(message);

    let gone = false;
    const dismiss = () => {
      if (gone) return;
      gone = true;
      el.classList.add('out');
      setTimeout(() => { el.remove(); settle(); }, 220);
    };
    el.querySelector('.toast-x').addEventListener('click', dismiss);

    ensureHost().appendChild(el);
    raise();
    requestAnimationFrame(() => el.classList.add('in'));
    if (timeout) setTimeout(dismiss, timeout);
    return dismiss;
  } catch {
    return () => {};
  }
}
