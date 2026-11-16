// The renderer: everything the world looks like, drawn on one canvas in the 1280x720 logical
// field. Procedural vector art only — every shape is a path computed at draw time, lit by stroking
// it twice (a wide, faint pass for the halo, then the bright core pass) instead of shadow blur,
// which keeps a full field of enemies cheap to paint. This module reads the world; it never
// changes it.

import { FIELD, PALETTE } from './config.js';
import { createRandom } from './random.js';

/** The starfield is pretty, not gameplay, so it has its own fixed seed and never changes. */
function makeStars() {
  const rng = createRandom(20261115);
  const stars = [];
  for (let i = 0; i < 150; i += 1) {
    stars.push({
      x: rng.range(0, FIELD.width),
      y: rng.range(0, FIELD.height),
      size: rng.range(0.6, 2.1),
      depth: rng.range(0.15, 1),
      twinkle: rng.range(0, Math.PI * 2),
    });
  }
  return stars;
}

/** Stroke a closed path with the neon two-pass treatment in `color`. */
function neonPath(ctx, path, color, coreWidth = 2) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.16;
  ctx.lineWidth = coreWidth + 5;
  ctx.stroke(path);
  ctx.globalAlpha = 0.9;
  ctx.lineWidth = coreWidth;
  ctx.stroke(path);
  ctx.restore();
}

/** A regular polygon path centred at (x, y). */
function polygonPath(x, y, radius, sides, angle) {
  const path = new Path2D();
  for (let i = 0; i < sides; i += 1) {
    const a = angle + (i / sides) * Math.PI * 2;
    const px = x + Math.cos(a) * radius;
    const py = y + Math.sin(a) * radius;
    if (i === 0) path.moveTo(px, py);
    else path.lineTo(px, py);
  }
  path.closePath();
  return path;
}

export function createRenderer(canvas, effects) {
  const ctx = canvas.getContext('2d');
  const stars = makeStars();

  function drawBackdrop(state) {
    const gradient = ctx.createLinearGradient(0, 0, 0, FIELD.height);
    gradient.addColorStop(0, PALETTE.deepSpace);
    gradient.addColorStop(0.55, PALETTE.backdrop);
    gradient.addColorStop(1, '#03040a');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);

    // Stars drift slowly against the ship's position for a whisper of parallax.
    const px = state.player ? state.player.x : FIELD.width / 2;
    const py = state.player ? state.player.y : FIELD.height / 2;
    ctx.save();
    ctx.fillStyle = PALETTE.star;
    for (const star of stars) {
      const ox = ((star.x - (px - FIELD.width / 2) * 0.03 * star.depth) % FIELD.width + FIELD.width) % FIELD.width;
      const oy = ((star.y - (py - FIELD.height / 2) * 0.03 * star.depth) % FIELD.height + FIELD.height) % FIELD.height;
      ctx.globalAlpha = 0.25 + 0.55 * star.depth * (0.7 + 0.3 * Math.sin(state.time * 1.7 + star.twinkle));
      ctx.fillRect(ox, oy, star.size, star.size);
    }
    ctx.restore();

    // The arena grid: quiet lines, with a soft pulse travelling through them.
    ctx.save();
    ctx.strokeStyle = PALETTE.grid;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= FIELD.width; x += 64) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, FIELD.height);
    }
    for (let y = 0; y <= FIELD.height; y += 64) {
      ctx.moveTo(0, y);
      ctx.lineTo(FIELD.width, y);
    }
    ctx.stroke();
    ctx.strokeStyle = PALETTE.gridGlow;
    ctx.globalAlpha = 0.10 + 0.05 * Math.sin(state.time * 0.8);
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, FIELD.width - 2, FIELD.height - 2);
    ctx.restore();
  }

  function drawPlayer(state) {
    const player = state.player;
    if (!player || !player.alive) return;
    // While invulnerable after a hit the ship strobes, so the player can see the grace window.
    const alpha = player.invulnTimer > 0 ? 0.45 + 0.3 * Math.sin(state.time * 30) : 1;
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);
    ctx.globalAlpha = alpha;

    // Engine flame: a flickering triangle behind the ship, longer the faster it moves.
    const flame = 10 + player.thrust * 16 + Math.sin(state.time * 41) * 3;
    const flamePath = new Path2D();
    flamePath.moveTo(-player.radius - 2, -5);
    flamePath.lineTo(-player.radius - 2 - flame, 0);
    flamePath.lineTo(-player.radius - 2, 5);
    flamePath.closePath();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(53, 241, 255, 0.35)';
    ctx.fill(flamePath);
    ctx.restore();

    // The hull: a sleek dart — nose at +x, swept wings, a notch cut from the tail.
    const r = player.radius;
    const hull = new Path2D();
    hull.moveTo(r + 6, 0);
    hull.lineTo(-r + 2, -r);
    hull.lineTo(-r + 7, 0);
    hull.lineTo(-r + 2, r);
    hull.closePath();
    ctx.fillStyle = 'rgba(53, 241, 255, 0.14)';
    ctx.fill(hull);
    neonPath(ctx, hull, PALETTE.player, 2.2);
    ctx.fillStyle = PALETTE.playerCore;
    ctx.beginPath();
    ctx.arc(1, 0, 3.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // The shield ring, when the AEGIS is up: a breathing circle with two orbiting nodes.
    if (player.shieldTimer > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const ringRadius = player.radius + 13 + Math.sin(state.time * 3.2) * 1.6;
      ctx.strokeStyle = PALETTE.shield;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(player.x, player.y, ringRadius, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 2; i += 1) {
        const a = state.time * 2.4 + i * Math.PI;
        ctx.globalAlpha = 0.95;
        ctx.fillStyle = PALETTE.shield;
        ctx.beginPath();
        ctx.arc(player.x + Math.cos(a) * ringRadius, player.y + Math.sin(a) * ringRadius, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawEnemy(enemy) {
    const type = enemy.type;
    const warpScale = enemy.warp > 0 ? 1 - enemy.warp / 0.6 : 1;
    const scale = 0.3 + 0.7 * warpScale;
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.globalAlpha = enemy.warp > 0 ? 0.25 + 0.75 * warpScale : 1;

    // A warp-in warning ring collapses onto the spawn point while the enemy materialises.
    if (enemy.warp > 0) {
      ctx.strokeStyle = type.color;
      ctx.globalAlpha = 0.7;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, enemy.radius + 16 * (enemy.warp / 0.6), 0, Math.PI * 2);
      ctx.stroke();
    }

    const body = polygonPath(0, 0, enemy.radius * scale, type.sides, enemy.angle);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fill(body);
    const color = enemy.flash > 0 ? '#ffffff' : type.color;
    neonPath(ctx, body, color, enemy.kind === 'bulwark' ? 3 : 2);

    // Inner detail per kind: a core for all, sized by remaining hull on the tough kinds.
    const hpFrac = enemy.hp / enemy.maxHp;
    if (enemy.kind === 'bulwark' || enemy.kind === 'orbiter') {
      const inner = polygonPath(0, 0, enemy.radius * 0.55 * scale, type.sides, -enemy.angle * 1.4);
      ctx.save();
      ctx.globalAlpha = 0.85;
      neonPath(ctx, inner, color, 1.6);
      ctx.restore();
      if (hpFrac < 1) {
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.arc(0, 0, 3.4 * hpFrac + 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (enemy.kind === 'shooter') {
      // The core swells as the next bolt charges, so a player can read the shot coming.
      const charge = 1 - Math.max(0, enemy.fireTimer) / 2.3;
      ctx.fillStyle = PALETTE.enemyBullet;
      ctx.globalAlpha = 0.5 + 0.5 * charge;
      ctx.beginPath();
      ctx.arc(0, 0, 2.4 + 3.4 * charge, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(0, 0, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawBullets(state) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const bullet of state.bullets) {
      const angle = Math.atan2(bullet.vy, bullet.vx);
      ctx.strokeStyle = PALETTE.bullet;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(bullet.x - Math.cos(angle) * 13, bullet.y - Math.sin(angle) * 13);
      ctx.lineTo(bullet.x, bullet.y);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#eafcff';
      ctx.beginPath();
      ctx.moveTo(bullet.x - Math.cos(angle) * 9, bullet.y - Math.sin(angle) * 9);
      ctx.lineTo(bullet.x, bullet.y);
      ctx.stroke();
    }
    for (const bolt of state.enemyBullets) {
      ctx.fillStyle = PALETTE.enemyBullet;
      ctx.globalAlpha = 0.3;
      ctx.beginPath();
      ctx.arc(bolt.x, bolt.y, bolt.radius + 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(bolt.x, bolt.y, bolt.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(bolt.x, bolt.y, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPowerup(powerup, state) {
    const bob = Math.sin(state.time * 3 + powerup.phase) * 3;
    const blink = powerup.life < 2.5 ? (Math.floor(state.time * 9) % 2 === 0 ? 0.25 : 1) : 1;
    ctx.save();
    ctx.translate(powerup.x, powerup.y + bob);
    ctx.rotate(state.time * 1.6 + powerup.phase);
    ctx.globalAlpha = blink;
    const hex = polygonPath(0, 0, powerup.radius, 6, 0);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fill(hex);
    neonPath(ctx, hex, powerup.type.color, 2);
    ctx.rotate(-(state.time * 1.6 + powerup.phase));
    ctx.fillStyle = powerup.type.color;
    ctx.font = '700 15px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(powerup.type.glyph, 0, 1);
    ctx.restore();
  }

  /** Paint one frame of the world (never the HUD or screens — hud.js owns those). */
  function draw(state) {
    ctx.save();
    if (state.shake > 0.2) {
      const mag = state.shake;
      ctx.translate((Math.random() - 0.5) * mag, (Math.random() - 0.5) * mag);
    }
    drawBackdrop(state);
    for (const powerup of state.powerups) drawPowerup(powerup, state);
    for (const enemy of state.enemies) drawEnemy(enemy);
    drawBullets(state);
    drawPlayer(state);
    effects.draw(ctx);
    ctx.restore();

    // Full-field flashes sit above the shake transform: a bomb's white-out, a hit's red bloom.
    if (state.bombFlash > 0) {
      ctx.fillStyle = `rgba(255, 240, 230, ${Math.min(0.55, state.bombFlash * 0.8)})`;
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    }
    if (state.hurtFlash > 0) {
      const edge = ctx.createRadialGradient(640, 360, 260, 640, 360, 720);
      edge.addColorStop(0, 'rgba(255, 40, 60, 0)');
      edge.addColorStop(1, `rgba(255, 40, 60, ${Math.min(0.5, state.hurtFlash * 0.75)})`);
      ctx.fillStyle = edge;
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    }
  }

  return { draw };
}
