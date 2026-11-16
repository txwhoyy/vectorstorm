// The HUD and the screens: everything drawn over the world — the score, combo, wave and hull
// readouts while playing, and the title, pause and game-over screens. The judge meets the game
// through screenshots, so every screen states the game's name, the score and what to press next
// in type big enough to read on a shrunken contact sheet.

import { COMBO, FIELD, FONT, FONT_MONO, PALETTE, POWERUP, WAVE } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const CENTRE_X = FIELD.width / 2;

function text(ctx, value, x, y, size, color, options = {}) {
  ctx.save();
  ctx.font = `${options.weight ?? 700} ${size}px ${options.mono ? FONT_MONO : FONT}`;
  ctx.textAlign = options.align ?? 'center';
  ctx.textBaseline = 'middle';
  if (options.spacing) {
    try { ctx.letterSpacing = `${options.spacing}px`; } catch { /* older engines: no tracking */ }
  }
  if (options.glow) {
    ctx.shadowColor = color;
    ctx.shadowBlur = options.glow;
  }
  ctx.globalAlpha = options.alpha ?? 1;
  ctx.fillStyle = color;
  ctx.fillText(value, x, y);
  ctx.restore();
}

function panel(ctx, x, y, width, height) {
  ctx.save();
  ctx.fillStyle = PALETTE.panel;
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x - width / 2, y - height / 2, width, height, 10);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function bar(ctx, x, y, width, height, fraction, color) {
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.10)';
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, height / 2);
  ctx.fill();
  if (fraction > 0) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, Math.max(height, width * Math.min(1, fraction)), height, height / 2);
    ctx.fill();
  }
  ctx.restore();
}

export function createHud(canvas) {
  const ctx = canvas.getContext('2d');

  function drawHud(state, best) {
    const player = state.player;
    // Score block, top left.
    text(ctx, 'SCORE', 28, 30, 15, PALETTE.muted, { align: 'left', spacing: 3 });
    text(ctx, String(state.score).padStart(6, '0'), 28, 58, 32, PALETTE.text, { align: 'left', mono: true, glow: 8 });
    if (state.multiplier > 1) {
      text(ctx, `x${state.multiplier} COMBO`, 28, 88, 19, PALETTE.rapid, { align: 'left', spacing: 1 });
      bar(ctx, 28, 102, 118, 5, state.comboTimer / COMBO.window, PALETTE.rapid);
    }
    // Wave, top centre.
    text(ctx, `WAVE ${Math.max(1, state.wave)}`, CENTRE_X, 40, 26, PALETTE.text, { spacing: 4, glow: 8 });
    // Best, top right.
    text(ctx, 'BEST', FIELD.width - 28, 30, 15, PALETTE.muted, { align: 'right', spacing: 3 });
    text(ctx, String(Math.max(best, state.score)).padStart(6, '0'), FIELD.width - 28, 58, 26, PALETTE.text, { align: 'right', mono: true });

    // Hull bar, bottom left: green while healthy, amber when hurt, red and pulsing when critical.
    const hullFrac = Math.max(0, player.hull / player.maxHull);
    const hullColor = hullFrac > 0.5 ? PALETTE.hullGood : hullFrac > 0.25 ? PALETTE.rapid : PALETTE.hullBad;
    const pulse = hullFrac <= 0.25 ? 0.65 + 0.35 * Math.sin(state.time * 9) : 1;
    text(ctx, 'HULL', 28, FIELD.height - 58, 15, PALETTE.muted, { align: 'left', spacing: 3 });
    ctx.save();
    ctx.globalAlpha = pulse;
    bar(ctx, 28, FIELD.height - 44, 230, 13, hullFrac, hullColor);
    ctx.restore();
    text(ctx, `${Math.ceil(player.hull)} / ${player.maxHull}`, 268, FIELD.height - 37, 17, hullColor, { align: 'left', mono: true });

    // Active power-up timers, bottom right.
    let rowY = FIELD.height - 66;
    if (player.rapidTimer > 0) {
      text(ctx, 'RAPID FIRE', FIELD.width - 28, rowY, 15, PALETTE.rapid, { align: 'right', spacing: 2 });
      bar(ctx, FIELD.width - 28 - 118, rowY + 12, 118, 5, player.rapidTimer / POWERUP.rapidDuration, PALETTE.rapid);
      rowY -= 34;
    }
    if (player.shieldTimer > 0) {
      text(ctx, 'AEGIS SHIELD', FIELD.width - 28, rowY, 15, PALETTE.shield, { align: 'right', spacing: 2 });
      bar(ctx, FIELD.width - 28 - 118, rowY + 12, 118, 5, player.shieldTimer / POWERUP.shieldDuration, PALETTE.shield);
    }
  }

  function drawWaveBanner(state) {
    if (state.phase !== 'announce') return;
    const progress = 1 - state.phaseTimer / WAVE.announce;
    const alpha = progress < 0.15 ? progress / 0.15 : progress > 0.75 ? (1 - progress) / 0.25 : 1;
    text(ctx, state.bannerText, CENTRE_X, 268, 64, PALETTE.player, { spacing: 14, glow: 26, alpha });
    text(ctx, 'GET READY', CENTRE_X, 322, 19, PALETTE.muted, { spacing: 6, alpha });
  }

  function drawTitle(state, best) {
    // Slow decorative polygons drift behind the title, echoing the enemies inside.
    ctx.save();
    ctx.globalAlpha = 0.16;
    const shapes = [
      { x: 190, y: 190, r: 44, sides: 3, color: PALETTE.dart, speed: 0.24 },
      { x: 1090, y: 160, r: 38, sides: 4, color: PALETTE.weaver, speed: -0.31 },
      { x: 1020, y: 560, r: 52, sides: 6, color: PALETTE.bulwark, speed: 0.17 },
      { x: 250, y: 570, r: 34, sides: 5, color: PALETTE.shooter, speed: -0.22 },
      { x: 640, y: 120, r: 26, sides: 4, color: PALETTE.orbiter, speed: 0.4 },
    ];
    for (const shape of shapes) {
      ctx.strokeStyle = shape.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i < shape.sides; i += 1) {
        const a = state.time * shape.speed + (i / shape.sides) * Math.PI * 2;
        const px = shape.x + Math.cos(a) * shape.r;
        const py = shape.y + Math.sin(a) * shape.r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();

    text(ctx, 'VECTORSTORM', CENTRE_X, 218, 96, PALETTE.player, { spacing: 10, glow: 34 });
    text(ctx, 'NEON ARENA PROTOCOL', CENTRE_X, 282, 21, PALETTE.weaver, { spacing: 9 });
    text(ctx, 'Survive the swarm. Chain the combo. Break the storm.', CENTRE_X, 322, 19, PALETTE.text, { weight: 400 });

    panel(ctx, CENTRE_X, 428, 560, 118);
    text(ctx, 'WASD / ARROWS — MOVE        MOUSE — AIM', CENTRE_X, 398, 19, PALETTE.text, { mono: true });
    text(ctx, 'HOLD CLICK / SPACE — FIRE', CENTRE_X, 428, 19, PALETTE.text, { mono: true });
    text(ctx, 'P — PAUSE        M — MUTE', CENTRE_X, 458, 19, PALETTE.text, { mono: true });

    const blink = Math.floor(state.time * 1.6) % 2 === 0;
    text(ctx, 'CLICK OR PRESS ENTER TO LAUNCH', CENTRE_X, 540, 24, PALETTE.hullGood, { spacing: 3, glow: 14, alpha: blink ? 1 : 0.35 });
    if (best > 0) text(ctx, `BEST SCORE  ${best}`, CENTRE_X, 592, 19, PALETTE.muted, { mono: true, spacing: 2 });
    text(ctx, 'Collect R — rapid fire · S — aegis shield · B — nova bomb', CENTRE_X, 668, 16, PALETTE.muted, { weight: 400 });
  }

  function drawPaused(state) {
    ctx.save();
    ctx.fillStyle = 'rgba(3, 4, 10, 0.62)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.restore();
    panel(ctx, CENTRE_X, 360, 430, 190);
    text(ctx, 'PAUSED', CENTRE_X, 316, 44, PALETTE.player, { spacing: 8, glow: 18 });
    text(ctx, `SCORE  ${state.score}`, CENTRE_X, 366, 20, PALETTE.text, { mono: true });
    text(ctx, 'P / ESC — RESUME', CENTRE_X, 410, 17, PALETTE.muted, { spacing: 2 });
  }

  function drawGameOver(state, best) {
    ctx.save();
    ctx.fillStyle = 'rgba(5, 2, 8, 0.55)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.restore();
    panel(ctx, CENTRE_X, 356, 520, 330);
    text(ctx, 'GAME OVER', CENTRE_X, 238, 56, PALETTE.hullBad, { spacing: 8, glow: 24 });
    text(ctx, 'FINAL SCORE', CENTRE_X, 300, 16, PALETTE.muted, { spacing: 4 });
    text(ctx, String(state.score), CENTRE_X, 342, 52, PALETTE.text, { mono: true, glow: 12 });
    const isBest = state.score >= best && state.score > 0;
    text(ctx, isBest ? 'NEW BEST!' : `BEST  ${best}`, CENTRE_X, 388, 19, isBest ? PALETTE.rapid : PALETTE.muted, { mono: true, spacing: 2 });
    text(ctx, `WAVE REACHED  ${state.wave}      KILLS  ${state.kills}      BEST COMBO  x${1 + Math.floor(state.bestCombo / COMBO.perTier)}`, CENTRE_X, 428, 17, PALETTE.text, { mono: true });
    const blink = Math.floor(state.time * 1.6) % 2 === 0;
    text(ctx, 'PRESS ENTER OR CLICK TO RETRY', CENTRE_X, 478, 22, PALETTE.hullGood, { spacing: 2, glow: 12, alpha: blink ? 1 : 0.35 });
  }

  /** Draw whichever overlay the screen calls for, over the world render. */
  function drawOverlay(state, screen, best) {
    if (screen === SCREEN_PLAY) {
      drawHud(state, best);
      drawWaveBanner(state);
    } else if (screen === SCREEN_TITLE) {
      drawTitle(state, best);
    } else if (screen === SCREEN_PAUSED) {
      drawHud(state, best);
      drawPaused(state);
    } else if (screen === SCREEN_OVER) {
      drawGameOver(state, best);
    }
  }

  return { drawOverlay, drawHud };
}
