export const KEYS = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'jump', KeyW: 'jump', Space: 'jump', ArrowDown: 'slide', KeyS: 'slide',
  Escape: 'pause',
};

export function classifySwipe(dx, dy, min = 30) {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < min) return null;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy < 0 ? 'jump' : 'slide';
}

// Keys on window, swipes on touchTarget. A swipe fires as soon as it crosses the threshold.
export function bindInput(touchTarget, onAction) {
  let start = null;
  const onKey = (e) => {
    const a = KEYS[e.code];
    if (!a || e.repeat) return;
    e.preventDefault();
    onAction(a);
  };
  const onStart = (e) => { const t = e.changedTouches[0]; start = { x: t.clientX, y: t.clientY }; };
  const onMove = (e) => {
    e.preventDefault(); // no page scroll, no pull-to-refresh
    if (!start) return;
    const t = e.changedTouches[0];
    const a = classifySwipe(t.clientX - start.x, t.clientY - start.y);
    if (a) { start = null; onAction(a); }
  };
  addEventListener('keydown', onKey);
  touchTarget.addEventListener('touchstart', onStart, { passive: true });
  touchTarget.addEventListener('touchmove', onMove, { passive: false });
  return () => {
    removeEventListener('keydown', onKey);
    touchTarget.removeEventListener('touchstart', onStart);
    touchTarget.removeEventListener('touchmove', onMove);
  };
}
