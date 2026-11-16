// Keyboard and mouse, read as game intent. The rest of the game never touches DOM events: it
// asks this module for a movement axis, an aim point, whether the trigger is held, and which
// one-shot actions (confirm, pause, mute) were pressed since the last frame.
//
// The canvas fills a letterboxed 1280x720 stage, so pointer positions are converted from client
// pixels into the game's logical coordinates here, where the canvas's box is known.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;

const MOVE_KEYS = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
};

export function createInput(canvas) {
  const held = new Set();
  const pointer = { x: 640, y: 300, down: false };
  let pendingActions = 0;

  function toLogical(event) {
    const box = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - box.left) / box.width) * 1280,
      y: ((event.clientY - box.top) / box.height) * 720,
    };
  }

  window.addEventListener('keydown', (event) => {
    if (MOVE_KEYS[event.code] || event.code === 'Space') event.preventDefault();
    if (event.repeat) return;
    held.add(event.code);
    if (event.code === 'Enter' || event.code === 'Space') pendingActions |= ACTION_CONFIRM;
    if (event.code === 'KeyP' || event.code === 'Escape') pendingActions |= ACTION_PAUSE;
    if (event.code === 'KeyM') pendingActions |= ACTION_MUTE;
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  window.addEventListener('blur', () => {
    held.clear();
    pointer.down = false;
  });

  canvas.addEventListener('pointermove', (event) => {
    const point = toLogical(event);
    pointer.x = point.x;
    pointer.y = point.y;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const point = toLogical(event);
    pointer.x = point.x;
    pointer.y = point.y;
    pointer.down = true;
    pendingActions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => {
    pointer.down = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    pointer,
    /** The thrust direction from the movement keys: each axis in -1..1, diagonals normalised. */
    axis() {
      let x = 0;
      let y = 0;
      for (const code of held) {
        const direction = MOVE_KEYS[code];
        if (direction === 'left') x -= 1;
        else if (direction === 'right') x += 1;
        else if (direction === 'up') y -= 1;
        else if (direction === 'down') y += 1;
      }
      if (x !== 0 && y !== 0) {
        x *= Math.SQRT1_2;
        y *= Math.SQRT1_2;
      }
      return { x, y };
    },
    /** The trigger: the mouse button held, or Space held. */
    firing() {
      return pointer.down || held.has('Space');
    },
    /** The one-shot actions pressed since the last call; reading them clears them. */
    takeActions() {
      const actions = pendingActions;
      pendingActions = 0;
      return actions;
    },
  };
}
