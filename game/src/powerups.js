// Power-ups: the three pickups a destroyed enemy can drop. RAPID FIRE doubles the cannon's rate
// for ten seconds, AEGIS SHIELD rings the ship with a barrier that eats one hit, and NOVA BOMB
// detonates the moment it is collected, clearing every enemy on the field. This module owns
// their definitions and their slow drift; the world owns the drop roll and the pickup effects.

import { FIELD, PALETTE, POWERUP } from './config.js';

export const POWERUP_TYPES = {
  rapid: { glyph: 'R', name: 'RAPID FIRE', color: PALETTE.rapid },
  shield: { glyph: 'S', name: 'AEGIS SHIELD', color: PALETTE.shield },
  bomb: { glyph: 'B', name: 'NOVA BOMB', color: PALETTE.bomb },
};

export const POWERUP_KINDS = Object.keys(POWERUP_TYPES);

/** A fresh power-up of `kind` at (x, y), drifting slowly in a random direction. */
export function createPowerup(kind, x, y, rng) {
  const angle = rng.angle();
  return {
    kind,
    type: POWERUP_TYPES[kind],
    x, y,
    vx: Math.cos(angle) * POWERUP.driftSpeed,
    vy: Math.sin(angle) * POWERUP.driftSpeed,
    radius: POWERUP.radius,
    age: 0,
    life: POWERUP.life,
    phase: rng.range(0, Math.PI * 2),
    dead: false,
  };
}

/** Drift, bob and age a power-up; it dies quietly when its life runs out. */
export function updatePowerup(powerup, dt) {
  powerup.age += dt;
  powerup.life -= dt;
  if (powerup.life <= 0) {
    powerup.dead = true;
    return;
  }
  powerup.x += powerup.vx * dt;
  powerup.y += powerup.vy * dt;
  // Bounce softly off the arena walls so a drop never drifts out of reach.
  if (powerup.x < powerup.radius || powerup.x > FIELD.width - powerup.radius) powerup.vx *= -1;
  if (powerup.y < powerup.radius || powerup.y > FIELD.height - powerup.radius) powerup.vy *= -1;
  powerup.x = Math.min(FIELD.width - powerup.radius, Math.max(powerup.radius, powerup.x));
  powerup.y = Math.min(FIELD.height - powerup.radius, Math.max(powerup.radius, powerup.y));
}
