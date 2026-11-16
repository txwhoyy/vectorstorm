// The five enemy kinds: what each one is (size, toughness, score, colour, polygon) and how each
// one flies. The world owns the enemy list and calls updateEnemy for each; this module owns the
// behaviours and the wave rosters, so adding a kind means one table entry and one flight
// function, nothing else.
//
//   dart     a fast triangle that dives straight at the ship
//   weaver   a diamond that corkscrews in, quick and hard to lead
//   orbiter  a square that closes in, then circles the ship at range, striking in pulses
//   shooter  a pentagon that holds its distance and fires bolts at the ship
//   bulwark  a slow hexagon with a thick hull, the wave's anchor

import { ENEMY_FIRE, FIELD, PALETTE } from './config.js';

export const ENEMY_TYPES = {
  dart: { radius: 15, hp: 1, speed: 122, score: 50, damage: 14, color: PALETTE.dart, sides: 3 },
  weaver: { radius: 14, hp: 1, speed: 148, score: 75, damage: 12, color: PALETTE.weaver, sides: 4 },
  orbiter: { radius: 16, hp: 2, speed: 172, score: 100, damage: 14, color: PALETTE.orbiter, sides: 4 },
  shooter: { radius: 17, hp: 2, speed: 98, score: 125, damage: 12, color: PALETTE.shooter, sides: 5 },
  bulwark: { radius: 31, hp: 6, speed: 54, score: 250, damage: 24, color: PALETTE.bulwark, sides: 6 },
};

/** Seconds an enemy spends warping in: visible and growing, but harmless and unhittable. */
export const WARP_IN = 0.6;

/** A fresh enemy of `kind` at (x, y). `aggression` (1 and up) scales speed and fire rate. */
export function createEnemy(kind, x, y, rng, aggression) {
  const type = ENEMY_TYPES[kind];
  return {
    kind,
    type,
    x, y,
    vx: 0, vy: 0,
    hp: type.hp,
    maxHp: type.hp,
    radius: type.radius,
    angle: rng.angle(),
    spin: rng.range(-1.4, 1.4),
    age: 0,
    warp: WARP_IN,
    flash: 0,
    phase: rng.range(0, Math.PI * 2),
    fireTimer: rng.range(1.1, ENEMY_FIRE.interval),
    orbitDir: rng.chance(0.5) ? 1 : -1,
    orbitPulse: rng.range(0, 2.4),
    aggression,
    dead: false,
  };
}

function steer(enemy, targetX, targetY, speed, dt, turn) {
  const dx = targetX - enemy.x;
  const dy = targetY - enemy.y;
  const dist = Math.hypot(dx, dy) || 1;
  const wantX = (dx / dist) * speed;
  const wantY = (dy / dist) * speed;
  const blend = Math.min(1, turn * dt);
  enemy.vx += (wantX - enemy.vx) * blend;
  enemy.vy += (wantY - enemy.vy) * blend;
}

const BEHAVIOURS = {
  dart(enemy, player, dt) {
    steer(enemy, player.x, player.y, enemy.type.speed * enemy.aggression, dt, 2.6);
    enemy.angle = Math.atan2(enemy.vy, enemy.vx);
  },

  weaver(enemy, player, dt) {
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const dist = Math.hypot(dx, dy) || 1;
    const sway = Math.sin(enemy.age * 5.2 + enemy.phase) * 0.95;
    const px = -dy / dist;
    const py = dx / dist;
    const speed = enemy.type.speed * enemy.aggression;
    enemy.vx = (dx / dist + px * sway) * speed;
    enemy.vy = (dy / dist + py * sway) * speed;
    enemy.angle += dt * 3.2;
  },

  orbiter(enemy, player, dt) {
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const dist = Math.hypot(dx, dy) || 1;
    const orbitRadius = 168;
    enemy.orbitPulse -= dt;
    if (enemy.orbitPulse <= 0) enemy.orbitPulse = 2.4;
    // Inside two seconds of each pulse the orbiter dives at the ship; the rest of the time it
    // holds its circle, sliding around the ship in its chosen direction.
    const diving = enemy.orbitPulse < 0.85;
    const radial = diving ? 1 : (dist > orbitRadius + 26 ? 0.85 : dist < orbitRadius - 26 ? -0.7 : 0);
    const speed = enemy.type.speed * enemy.aggression;
    const tx = (dx / dist) * radial + (-dy / dist) * enemy.orbitDir * 0.9;
    const ty = (dy / dist) * radial + (dx / dist) * enemy.orbitDir * 0.9;
    const len = Math.hypot(tx, ty) || 1;
    enemy.vx = (tx / len) * speed;
    enemy.vy = (ty / len) * speed;
    enemy.angle += dt * 2.4;
  },

  shooter(enemy, player, dt, fire) {
    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const dist = Math.hypot(dx, dy) || 1;
    const holdRadius = 330;
    const radial = dist > holdRadius + 30 ? 1 : dist < holdRadius - 30 ? -0.8 : 0;
    const strafe = Math.sin(enemy.age * 0.9 + enemy.phase) * 0.5;
    const speed = enemy.type.speed * enemy.aggression;
    const tx = (dx / dist) * radial + (-dy / dist) * strafe;
    const ty = (dy / dist) * radial + (dx / dist) * strafe;
    const len = Math.hypot(tx, ty) || 1;
    enemy.vx = (tx / len) * speed * (radial === 0 ? 0.45 : 1);
    enemy.vy = (ty / len) * speed * (radial === 0 ? 0.45 : 1);
    enemy.angle += dt * 0.9;
    enemy.fireTimer -= dt * enemy.aggression;
    if (enemy.fireTimer <= 0 && dist < ENEMY_FIRE.range) {
      // The jitter comes from the enemy's own phase, never Math.random, so a seeded run replays
      // exactly (see random.js).
      const jitter = 0.9 + 0.25 * (0.5 + 0.5 * Math.sin(enemy.phase * 7.3 + enemy.age * 1.7));
      enemy.fireTimer = ENEMY_FIRE.interval * jitter;
      fire(enemy, Math.atan2(dy, dx));
    }
  },

  bulwark(enemy, player, dt) {
    steer(enemy, player.x, player.y, enemy.type.speed * (0.8 + 0.2 * enemy.aggression), dt, 1.1);
    enemy.angle += dt * 0.55;
  },
};

/**
 * Advance one enemy for a step. `fire(enemy, angle)` is called when a shooter lets off a bolt.
 * Warping-in enemies hang still and do nothing else.
 */
export function updateEnemy(enemy, player, dt, fire) {
  enemy.age += dt;
  if (enemy.flash > 0) enemy.flash -= dt;
  if (enemy.warp > 0) {
    enemy.warp -= dt;
    return;
  }
  BEHAVIOURS[enemy.kind](enemy, player, dt, fire);
  enemy.x += enemy.vx * dt;
  enemy.y += enemy.vy * dt;
  // Keep enemies inside the arena once they have arrived; a hunter that reaches the wall slides
  // along it rather than leaving the fight.
  enemy.x = Math.min(FIELD.width - enemy.radius, Math.max(enemy.radius, enemy.x));
  enemy.y = Math.min(FIELD.height - enemy.radius, Math.max(enemy.radius, enemy.y));
  if (enemy.kind !== 'weaver' && enemy.kind !== 'dart') enemy.angle += enemy.spin * dt * 0.3;
}

/**
 * The roster of one wave: which kinds to spawn, in spawn order (shuffled by the caller).
 * Every wave is bigger than the last; new kinds join as the waves climb, and from wave 5 a
 * bulwark anchors each wave, with more on every third wave after that.
 */
export function waveRoster(wave) {
  const roster = [];
  const add = (kind, count) => {
    for (let i = 0; i < count; i += 1) roster.push(kind);
  };
  add('dart', 5 + wave * 2);
  if (wave >= 2) add('weaver', 2 + wave);
  if (wave >= 3) add('orbiter', wave);
  if (wave >= 4) add('shooter', Math.floor(wave / 2));
  if (wave >= 5) add('bulwark', 1 + Math.floor((wave - 5) / 3));
  return roster;
}

/** How much faster and more eager wave `wave`'s enemies are than wave 1's. */
export function waveAggression(wave) {
  return 1 + Math.min(0.75, (wave - 1) * 0.07);
}
