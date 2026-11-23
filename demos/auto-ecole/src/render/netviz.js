// Live neural-network visualization: nodes lit by activation, connections
// weighted by |w|. Drawn only for the single highlighted car, and only
// when the caller requests a frame.

import { SIM } from '../sim/simulation.js';
import { weightAt } from '../sim/nn.js';

const INPUT_LABELS = ['◄◄', '◄', '▲', '►', '►►', 'vitesse'];
const OUTPUT_LABELS = ['volant', 'gaz'];

export function createNetviz(canvas) {
  const ctx = canvas.getContext('2d');
  let cssW = 0;
  let cssH = 0;
  let dpr = 1;

  function resize() {
    const r = canvas.getBoundingClientRect();
    const nDpr = Math.min(window.devicePixelRatio || 1, 2);
    if (r.width === cssW && r.height === cssH && nDpr === dpr) return false;
    cssW = r.width;
    cssH = r.height;
    dpr = nDpr;
    canvas.width = Math.max(1, Math.round(cssW * dpr));
    canvas.height = Math.max(1, Math.round(cssH * dpr));
    return true;
  }

  function nodePos(layers, l, i) {
    const w = canvas.width;
    const h = canvas.height;
    const padL = 60 * dpr;
    const padR = 96 * dpr; // room for "volant/gaz" labels and values
    const x = padL + (l / (layers.length - 1)) * (w - padL - padR);
    const n = layers[l];
    const span = h * 0.78;
    const y = h / 2 + (n === 1 ? 0 : (i / (n - 1) - 0.5) * span);
    return { x, y };
  }

  function actColor(a, alpha = 1) {
    // Positive: cyan; negative: warm orange; brightness tracks |a|.
    const m = Math.min(1, Math.abs(a));
    return a >= 0
      ? `rgba(82, 214, 251, ${(0.15 + 0.85 * m) * alpha})`
      : `rgba(255, 159, 67, ${(0.15 + 0.85 * m) * alpha})`;
  }

  // trace: per-layer activation arrays (from forwardTrace); genome: flat
  // weights, for connection strengths.
  function draw(trace, genome) {
    const layers = SIM.layers;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let l = 0; l < layers.length - 1; l++) {
      for (let i = 0; i < layers[l]; i++) {
        const a = nodePos(layers, l, i);
        for (let j = 0; j < layers[l + 1]; j++) {
          const b = nodePos(layers, l + 1, j);
          const w = weightAt(layers, genome, l, i, j);
          const m = Math.min(1, Math.abs(w) / 2.5);
          if (m < 0.04) continue;
          ctx.strokeStyle =
            w >= 0
              ? `rgba(82, 214, 251, ${0.08 + 0.4 * m})`
              : `rgba(255, 159, 67, ${0.08 + 0.4 * m})`;
          ctx.lineWidth = (0.5 + 1.8 * m) * dpr;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    const rNode = 7 * dpr;
    ctx.font = `${11 * dpr}px system-ui, sans-serif`;
    ctx.textBaseline = 'middle';
    for (let l = 0; l < layers.length; l++) {
      for (let i = 0; i < layers[l]; i++) {
        const p = nodePos(layers, l, i);
        const a = trace ? trace[l][i] : 0;
        ctx.fillStyle = actColor(a);
        ctx.beginPath();
        ctx.arc(p.x, p.y, rNode, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = 'rgba(228, 235, 243, 0.35)';
        ctx.lineWidth = 1 * dpr;
        ctx.stroke();

        if (l === 0) {
          ctx.fillStyle = '#9aa8b8';
          ctx.textAlign = 'right';
          ctx.fillText(INPUT_LABELS[i] ?? '', p.x - rNode - 5 * dpr, p.y);
        } else if (l === layers.length - 1) {
          ctx.fillStyle = '#9aa8b8';
          ctx.textAlign = 'left';
          const label = OUTPUT_LABELS[i] ?? '';
          const val = trace
            ? ` ${trace[l][i] >= 0 ? '+' : '−'}${Math.abs(trace[l][i]).toFixed(1)}`
            : '';
          ctx.fillText(label + val, p.x + rNode + 5 * dpr, p.y);
        }
      }
    }
  }

  return { resize, draw };
}
