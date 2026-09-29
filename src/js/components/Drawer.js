// Slide-out drawer + confirm modal, built on native <dialog>:
// showModal() gives focus trapping, Esc handling and an inert background.
let uid = 0;
let openCount = 0;

const X_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

function lockScroll(on) {
  openCount = Math.max(0, openCount + (on ? 1 : -1));
  document.documentElement.classList.toggle('modal-open', openCount > 0);
}

/**
 * Open a right-hand drawer.
 * @param {{title:string, subtitle?:string, body?:string, footer?:string,
 *          beforeClose?: () => boolean|Promise<boolean>}} opts
 *   body/footer are trusted template HTML (callers escape dynamic values).
 * @returns {{dialog:HTMLDialogElement, body:HTMLElement, footer:HTMLElement|null, close:(force?:boolean)=>Promise<void>}}
 */
export function openDrawer({ title, subtitle = '', body = '', footer = '', beforeClose } = {}) {
  const id = `drawer${++uid}`;
  const returnFocus = document.activeElement;
  const dlg = document.createElement('dialog');
  dlg.className = 'drawer';
  dlg.setAttribute('aria-labelledby', `${id}-t`);
  dlg.innerHTML = `
    <div class="drawer-panel">
      <header class="drawer-h">
        <div class="drawer-hx">
          <h2 class="drawer-t" id="${id}-t"></h2>
          <p class="drawer-s"></p>
        </div>
        <button class="iconbtn" type="button" data-close aria-label="Close panel">${X_ICON}</button>
      </header>
      <div class="drawer-b">${body}</div>
      ${footer ? `<footer class="drawer-f">${footer}</footer>` : ''}
    </div>`;
  dlg.querySelector('.drawer-t').textContent = title;
  const sub = dlg.querySelector('.drawer-s');
  if (subtitle) sub.textContent = subtitle;
  else sub.remove();

  let closing = false;
  const close = async (force = false) => {
    if (closing) return;
    if (!force && beforeClose) {
      try { if (!(await beforeClose())) return; } catch { return; }
    }
    closing = true;
    dlg.classList.add('closing');
    setTimeout(() => {
      try { dlg.close(); } catch {}
      dlg.remove();
      lockScroll(false);
      try { returnFocus?.focus?.({ preventScroll: true }); } catch {}
    }, 200);
  };

  dlg.querySelector('[data-close]').addEventListener('click', () => close());
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(); }); // Esc
  dlg.addEventListener('mousedown', (e) => { if (e.target === dlg) close(); }); // backdrop

  document.body.appendChild(dlg);
  lockScroll(true);
  dlg.showModal();
  dlg.querySelector('.drawer-b :is(input:not([type=hidden]):not([disabled]), textarea, select)')?.focus();

  return { dialog: dlg, body: dlg.querySelector('.drawer-b'), footer: dlg.querySelector('.drawer-f'), close };
}

/**
 * Promise-based confirm modal. Resolves true on confirm, false otherwise.
 * Focus starts on Cancel so a stray Enter never confirms a destructive action.
 */
export function confirmDialog({ title = 'Are you sure?', message = '', confirmText = 'Confirm', cancelText = 'Cancel', danger = false } = {}) {
  return new Promise((resolve) => {
    const id = `modal${++uid}`;
    const returnFocus = document.activeElement;
    const dlg = document.createElement('dialog');
    dlg.className = 'modal';
    dlg.setAttribute('aria-labelledby', `${id}-t`);
    dlg.setAttribute('aria-describedby', `${id}-d`);
    dlg.innerHTML = `
      <div class="modal-card">
        <h2 class="modal-t" id="${id}-t"></h2>
        <p class="modal-d" id="${id}-d"></p>
        <div class="modal-a">
          <button type="button" class="abtn ghost" data-no></button>
          <button type="button" class="abtn ${danger ? 'danger' : 'primary'}" data-yes></button>
        </div>
      </div>`;
    dlg.querySelector('.modal-t').textContent = title;
    dlg.querySelector('.modal-d').textContent = message;
    dlg.querySelector('[data-no]').textContent = cancelText;
    dlg.querySelector('[data-yes]').textContent = confirmText;

    let done = false;
    const finish = (v) => {
      if (done) return;
      done = true;
      try { dlg.close(); } catch {}
      dlg.remove();
      lockScroll(false);
      try { returnFocus?.focus?.({ preventScroll: true }); } catch {}
      resolve(v);
    };
    dlg.querySelector('[data-yes]').addEventListener('click', () => finish(true));
    dlg.querySelector('[data-no]').addEventListener('click', () => finish(false));
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); finish(false); });
    dlg.addEventListener('mousedown', (e) => { if (e.target === dlg) finish(false); });

    document.body.appendChild(dlg);
    lockScroll(true);
    dlg.showModal();
    dlg.querySelector('[data-no]').focus();
  });
}
