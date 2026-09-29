// Performance / low-power handling (Phase 3.3).
// Disables the animated "scene" (petals + rotating polygon) for users who
// request reduced motion or are on constrained devices (mobile, Save-Data,
// low memory). Static gradients/scrim remain — only the CPU-costly animation
// is dropped. CSS `.no-fx` (base.css) does the actual disabling; here we detect
// and toggle it, and physically remove petals so they stop compositing.

const reduceMQ = window.matchMedia('(prefers-reduced-motion: reduce)');

function isLowPower() {
  const c = navigator.connection || {};
  if (c.saveData) return true;
  if (typeof navigator.deviceMemory === 'number' && navigator.deviceMemory <= 2) return true;
  // phones: small viewport + coarse pointer
  if (window.matchMedia('(max-width: 760px) and (pointer: coarse)').matches) return true;
  return false;
}

export function fxDisabled() {
  return reduceMQ.matches || isLowPower();
}

export function initPerf() {
  const apply = () => {
    const off = fxDisabled();
    document.body.classList.toggle('no-fx', off);
    if (off) document.querySelectorAll('.stage .petal').forEach((p) => p.remove());
  };
  apply();
  // react if the user flips the OS reduced-motion setting
  if (reduceMQ.addEventListener) reduceMQ.addEventListener('change', apply);
}
