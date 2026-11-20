// Demo rule: localStorage keys are prefixed with the slug, because all
// demos share the same origin.
const KEY = 'projet-exemple:count';

const countEl = document.getElementById('count');
let count = Number(localStorage.getItem(KEY)) || 0;
countEl.textContent = String(count);

document.getElementById('bump').addEventListener('click', () => {
  count += 1;
  localStorage.setItem(KEY, String(count));
  countEl.textContent = String(count);
});

document.getElementById('reset').addEventListener('click', () => {
  count = 0;
  localStorage.removeItem(KEY);
  countEl.textContent = '0';
});
