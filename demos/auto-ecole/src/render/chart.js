// Fitness-over-generations chart: best (gold) and class mean (gray).
// Redrawn only when a generation ends or on resize.

const PX_PER_METER = 10;

export function createChart(canvas) {
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

  // history: [{gen, best, mean}] in px; lapLength in px.
  function draw(history, lapLength) {
    const w = canvas.width;
    const h = canvas.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.font = `${10 * dpr}px system-ui, sans-serif`;

    if (!history.length) {
      ctx.fillStyle = '#9aa8b8';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('La première promotion est en piste…', w / 2, h / 2);
      return;
    }

    const padL = 34 * dpr;
    const padR = 8 * dpr;
    const padT = 10 * dpr;
    const padB = 18 * dpr;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    let maxY = lapLength; // always show the "1 lap" line
    for (const p of history) maxY = Math.max(maxY, p.best);
    maxY *= 1.08;
    const maxX = Math.max(history.length - 1, 1);

    const X = (i) => padL + (i / maxX) * plotW;
    const Y = (v) => padT + plotH - (v / maxY) * plotH;

    // Horizontal grid + labels (in meters).
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const gridSteps = 4;
    for (let g = 0; g <= gridSteps; g++) {
      const v = (maxY / gridSteps) * g;
      const y = Y(v);
      ctx.strokeStyle = 'rgba(42, 52, 66, 0.8)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(w - padR, y);
      ctx.stroke();
      ctx.fillStyle = '#9aa8b8';
      ctx.fillText(String(Math.round(v / PX_PER_METER)), padL - 4 * dpr, y);
    }

    // Lap-length milestones: 1 tour, 2 tours…
    for (let lap = 1; lap * lapLength < maxY; lap++) {
      const y = Y(lap * lapLength);
      ctx.strokeStyle = 'rgba(76, 217, 123, 0.45)';
      ctx.setLineDash([4 * dpr, 4 * dpr]);
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(w - padR, y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(76, 217, 123, 0.9)';
      ctx.textAlign = 'left';
      ctx.fillText(lap === 1 ? '1 tour' : `${lap} tours`, padL + 4 * dpr, y - 6 * dpr);
      ctx.textAlign = 'right';
    }

    function polyline(key, style, width) {
      ctx.strokeStyle = style;
      ctx.lineWidth = width * dpr;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      history.forEach((p, i) => {
        if (i === 0) ctx.moveTo(X(i), Y(p[key]));
        else ctx.lineTo(X(i), Y(p[key]));
      });
      ctx.stroke();
    }

    // Dashed mean vs solid best: the two series differ by pattern, not
    // only by hue (matches the caption's legend).
    ctx.setLineDash([5 * dpr, 4 * dpr]);
    polyline('mean', 'rgba(154, 168, 184, 0.8)', 1.4);
    ctx.setLineDash([]);
    polyline('best', '#ffd166', 2);

    // X axis label.
    ctx.fillStyle = '#9aa8b8';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(
      `promotions (${history.length}) — distances en mètres`,
      padL + plotW / 2,
      h - 5 * dpr,
    );
  }

  return { resize, draw };
}
