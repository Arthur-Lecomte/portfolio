// Pointer and keyboard interaction: select, drag, rotate (handle, two
// fingers, or keyboard). Mouse and touch share the same pointer code path.

import { angleOf, dist, sub } from './geometry.js';
import { hitTest } from './objects.js';
import { handlePosition } from './render.js';

export function initInteraction(app) {
  const { canvas, state, view } = app;
  const pointers = new Map(); // pointerId -> world position
  let mode = 'none'; // 'move' | 'rotate' | 'pinch'
  let gestureId = null; // object grabbed at pointerdown; selection may change mid-gesture
  let grabOffset = { x: 0, y: 0 };
  let pinch = null;

  function worldPos(e) {
    const r = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left - view.ox) / view.scale,
      y: (e.clientY - r.top - view.oy) / view.scale,
    };
  }

  function selectedObj() {
    return state.objects.find((o) => o.id === state.selectedId);
  }

  function objById(id) {
    return state.objects.find((o) => o.id === id);
  }

  function clampToWorld(obj) {
    obj.x = Math.min(state.world.w - 20, Math.max(20, obj.x));
    obj.y = Math.min(state.world.h - 20, Math.max(20, obj.y));
  }

  function handleRadius() {
    // Screen-constant-ish grab radius, generous for touch.
    return Math.max(20, 26 / view.scale);
  }

  function topObjectAt(p) {
    for (let i = state.objects.length - 1; i >= 0; i--) {
      if (hitTest(state.objects[i], p)) return state.objects[i];
    }
    return null;
  }

  function startPinch() {
    const obj = selectedObj();
    if (!obj || pointers.size !== 2) return false;
    const [a, b] = [...pointers.values()];
    pinch = {
      id: obj.id,
      baseAngle: angleOf(sub(b, a)),
      objAngle: obj.angle,
      baseCenter: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      objPos: { x: obj.x, y: obj.y },
    };
    mode = 'pinch';
    return true;
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return; // primary button only (touch/pen report 0)
    if (pointers.size >= 2) return; // ignore fingers beyond the pinch pair
    canvas.focus({ preventScroll: true });
    canvas.setPointerCapture(e.pointerId);
    const p = worldPos(e);
    pointers.set(e.pointerId, p);

    if (pointers.size === 2 && startPinch()) return;
    if (pointers.size > 1) return;

    const sel = selectedObj();
    if (sel && dist(p, handlePosition(sel)) <= handleRadius()) {
      mode = 'rotate';
      gestureId = sel.id;
      return;
    }
    const hit = topObjectAt(p);
    if (hit) {
      app.select(hit.id);
      gestureId = hit.id;
      grabOffset = sub({ x: hit.x, y: hit.y }, p);
      mode = 'move';
    } else {
      app.select(null);
      gestureId = null;
      mode = 'none';
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) {
      // Hover feedback (mouse only)
      if (e.pointerType === 'mouse' && mode === 'none') {
        const p = worldPos(e);
        const sel = selectedObj();
        const overHandle = sel && dist(p, handlePosition(sel)) <= handleRadius();
        canvas.style.cursor = overHandle ? 'grab' : topObjectAt(p) ? 'move' : 'default';
      }
      return;
    }
    const p = worldPos(e);
    pointers.set(e.pointerId, p);
    // Act on the object the gesture started on, even if the selection
    // changed mid-gesture (keyboard N, toolbar tap with another finger).
    const obj = mode === 'pinch' ? pinch && objById(pinch.id) : objById(gestureId);
    if (!obj) return;

    if (mode === 'move') {
      obj.x = p.x + grabOffset.x;
      obj.y = p.y + grabOffset.y;
      clampToWorld(obj);
      app.changed();
    } else if (mode === 'rotate') {
      obj.angle = angleOf(sub(p, { x: obj.x, y: obj.y }));
      app.changed();
    } else if (mode === 'pinch' && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      obj.angle = pinch.objAngle + angleOf(sub(b, a)) - pinch.baseAngle;
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      obj.x = pinch.objPos.x + cx - pinch.baseCenter.x;
      obj.y = pinch.objPos.y + cy - pinch.baseCenter.y;
      clampToWorld(obj);
      app.changed();
    }
  });

  function endPointer(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (mode === 'pinch' && pointers.size < 2) {
      const obj = pinch && objById(pinch.id);
      pinch = null;
      if (obj && pointers.size === 1) {
        // Hand the surviving finger a plain drag of the pinched object.
        const [p] = [...pointers.values()];
        gestureId = obj.id;
        grabOffset = sub({ x: obj.x, y: obj.y }, p);
        mode = 'move';
      } else {
        gestureId = null;
        mode = 'none';
      }
    } else if (pointers.size === 0) {
      gestureId = null;
      mode = 'none';
    }
  }

  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);

  canvas.addEventListener('keydown', (e) => {
    // Leave browser shortcuts (Ctrl+R, Cmd+R, Alt+arrows...) alone.
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const obj = selectedObj();
    const step = e.shiftKey ? 30 : 6;
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowRight':
      case 'ArrowUp':
      case 'ArrowDown': {
        if (!obj) return;
        e.preventDefault();
        if (e.key === 'ArrowLeft') obj.x -= step;
        if (e.key === 'ArrowRight') obj.x += step;
        if (e.key === 'ArrowUp') obj.y -= step;
        if (e.key === 'ArrowDown') obj.y += step;
        clampToWorld(obj);
        app.changed();
        break;
      }
      case 'r':
      case 'R': {
        if (!obj) return;
        e.preventDefault();
        app.rotateSelected(((e.shiftKey ? -3 : 3) * Math.PI) / 180);
        break;
      }
      case 'n':
      case 'N': {
        e.preventDefault();
        app.cycleSelection(1);
        break;
      }
      case 'Delete':
      case 'Backspace': {
        if (!obj) return;
        e.preventDefault();
        app.deleteSelected();
        break;
      }
      case 'Escape': {
        if (!obj) return;
        e.preventDefault();
        app.select(null);
        break;
      }
    }
  });
}
