// Tiny Canvas bar chart (Phase 4.3) — no dependencies.
export function barChart(canvas, data, opts = {}) {
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || 480;
  const cssH = canvas.clientHeight || 200;
  canvas.width = cssW * dpr;
  canvas.height = cssH * dpr;
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, cssW, cssH);

  const pad = { l: 8, r: 8, t: 10, b: 46 };
  const items = data.slice(0, 8);
  if (!items.length) {
    ctx.fillStyle = '#5a6180';
    ctx.font = '12px "JetBrains Mono", monospace';
    ctx.fillText('no data', pad.l, 24);
    return;
  }
  const max = Math.max(...items.map((d) => d.value), 1);
  const plotW = cssW - pad.l - pad.r;
  const plotH = cssH - pad.t - pad.b;
  const gap = 10;
  const bw = Math.max(10, (plotW - gap * (items.length - 1)) / items.length);

  items.forEach((d, i) => {
    const x = pad.l + i * (bw + gap);
    const h = Math.round((d.value / max) * plotH);
    const y = pad.t + (plotH - h);
    const grad = ctx.createLinearGradient(0, y, 0, y + h);
    grad.addColorStop(0, opts.color || '#22d3ee');
    grad.addColorStop(1, opts.color2 || '#ff2e88');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, bw, h);

    ctx.fillStyle = '#e9edf8';
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(String(d.value), x + bw / 2, y - 4);

    ctx.save();
    ctx.fillStyle = '#8b93ad';
    ctx.font = '9px "JetBrains Mono", monospace';
    ctx.translate(x + bw / 2, cssH - pad.b + 12);
    ctx.rotate(-Math.PI / 4);
    ctx.textAlign = 'right';
    const label = d.label.length > 14 ? d.label.slice(0, 13) + '…' : d.label;
    ctx.fillText(label, 0, 0);
    ctx.restore();
    ctx.textAlign = 'left';
  });
}
