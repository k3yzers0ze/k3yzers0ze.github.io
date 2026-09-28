// Reusable terminal UI component. Returns an HTML string.
import { esc } from '../util.js';

/**
 * @param {{title?:string, lines: {cmd:string, out:string}[], cursor?:boolean}} opts
 */
export function Terminal({ title = '~/contact', lines = [], cursor = true } = {}) {
  const rows = lines
    .map(
      (l) => `<div>
        <p class="cmd"><span class="p">$</span><span class="c">${esc(l.cmd)}</span></p>
        <p class="out">${esc(l.out)}</p>
      </div>`
    )
    .join('');

  return `<div class="term panel">
    <div class="term-bar">
      <i style="background:#ff5f57"></i>
      <i style="background:#febc2e"></i>
      <i style="background:#28c840"></i>
      <span class="t">${esc(title)}</span>
    </div>
    <div class="term-body">
      ${rows}
      ${cursor ? '<p class="cmd"><span class="p">$</span><span class="term-cursor" aria-hidden="true"></span></p>' : ''}
    </div>
  </div>`;
}
