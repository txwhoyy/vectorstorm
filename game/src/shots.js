// The screenshot scenes behind ?shot=title|action|wave|over (with &seed=N). Each scene plays
// the real game forward from a fresh world under a simple autopilot, so the frame is what play
// actually looks like — the same seed always stages the same frame — then hands main the screen
// to draw over it. The autopilot aims at the nearest enemy with a little lead, kites away from
// whatever is close, and dives on power-ups; the `over` scene flies a reckless variant that
// holds still in the swarm, so the ship genuinely dies and the real game-over screen follows.

import { FIELD, STEP } from './config.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './hud.js';

const ACTION_SECONDS = 15;
const WAVE_SECONDS = 52;
const OVER_LIMIT_SECONDS = 240;

function nearest(list, x, y, filter) {
  let best = null;
  let bestDist = Infinity;
  for (const item of list) {
    if (filter && !filter(item)) continue;
    const dx = item.x - x;
    const dy = item.y - y;
    const dist = dx * dx + dy * dy;
    if (dist < bestDist) {
      bestDist = dist;
      best = item;
    }
  }
  return best;
}

/** One frame of autopilot controls for the ship in `state`. */
function autopilot(state, reckless) {
  const player = state.player;
  if (reckless) {
    // The doomed pilot: holds position and fires at one fixed bearing, so the swarm closes in
    // from every other side and the ship really does die.
    return { moveX: 0, moveY: 0, aimX: player.x + 220, aimY: player.y - 120, firing: true };
  }
  const controls = { moveX: 0, moveY: 0, aimX: player.x + 100, aimY: player.y, firing: false };
  const target = nearest(state.enemies, player.x, player.y, (e) => e.warp <= 0);
  if (target) {
    // Lead the target by its velocity over the bullet's flight time.
    const dist = Math.hypot(target.x - player.x, target.y - player.y);
    const lead = dist / 820;
    controls.aimX = target.x + target.vx * lead;
    controls.aimY = target.y + target.vy * lead;
    controls.firing = dist < 760;
  }

  let moveX = 0;
  let moveY = 0;
  // Repulsion from enemies and their bolts, strongest from whatever is closest.
  const threats = state.enemies.concat(state.enemyBullets);
  for (const threat of threats) {
    const dx = player.x - threat.x;
    const dy = player.y - threat.y;
    const dist = Math.hypot(dx, dy) || 1;
    const range = threat.radius + 130;
    if (dist < range) {
      const weight = (1 - dist / range) * 2.4;
      moveX += (dx / dist) * weight;
      moveY += (dy / dist) * weight;
    }
  }
  // A power-up is worth a detour when nothing is on top of the ship.
  const pickup = nearest(state.powerups, player.x, player.y, null);
  if (pickup && (moveX === 0 && moveY === 0 || Math.hypot(moveX, moveY) < 0.4)) {
    moveX += (pickup.x - player.x) / 300;
    moveY += (pickup.y - player.y) / 300;
  }
  // Drift back toward the middle so the kiting does not pin the ship in a corner.
  moveX += (FIELD.width / 2 - player.x) / 2400;
  moveY += (FIELD.height / 2 - player.y) / 2400;
  const len = Math.hypot(moveX, moveY);
  if (len > 1) {
    moveX /= len;
    moveY /= len;
  }
  controls.moveX = moveX;
  controls.moveY = moveY;
  return controls;
}

function playFor(world, seconds, reckless) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    world.step(STEP, autopilot(world.state, reckless));
    if (world.state.over) break;
  }
}

/** Live (fully warped-in) enemies, and how many of them are within `range` of the ship. */
function fieldStats(state, range) {
  let live = 0;
  let near = 0;
  for (const enemy of state.enemies) {
    if (enemy.warp > 0) continue;
    live += 1;
    const dx = enemy.x - state.player.x;
    const dy = enemy.y - state.player.y;
    if (dx * dx + dy * dy <= range * range) near += 1;
  }
  return { live, near };
}

/**
 * Play for `seconds`, then keep playing (up to `maxExtra` more) until the field makes a scene
 * worth framing: a wave actively spawning, at least `minLive` enemies materialised and at
 * least `minNear` of them closing on the ship. A few final steps run past that moment so
 * bullets and sparks are mid-flight in the frame. This keeps a scene from freezing on the
 * empty moment between two waves, or on a field spread too thin to read as action.
 */
function playUntilScene(world, seconds, minLive, minNear, maxExtra) {
  playFor(world, seconds, false);
  let extra = 0;
  for (;;) {
    const stats = fieldStats(world.state, 470);
    const framed = world.state.phase === 'active' && stats.live >= minLive && stats.near >= minNear;
    if (world.state.over || framed || extra >= maxExtra) break;
    world.step(STEP, autopilot(world.state, false));
    extra += STEP;
  }
  for (let i = 0; i < 12 && !world.state.over; i += 1) {
    world.step(STEP, autopilot(world.state, false));
  }
}

/**
 * Set `world` to the named scene and return { screen, best } for main to draw. Any name other
 * than action, wave or over stages the title.
 */
export function stageShot(name, world) {
  const state = world.state;
  if (name === 'action') {
    world.reset();
    playUntilScene(world, ACTION_SECONDS, 5, 3, 30);
    return { screen: state.over ? SCREEN_OVER : SCREEN_PLAY, best: state.score };
  }
  if (name === 'wave') {
    world.reset();
    playUntilScene(world, WAVE_SECONDS, 7, 3, 30);
    // Guarantee the frame shows a pickup moment: if none is on the field, the game drops a
    // shield just off the ship's nose, as a kill would.
    if (!state.over && state.powerups.length === 0 && state.player.alive) {
      world.dropPowerup('shield', state.player.x + 120, state.player.y - 60);
      for (let i = 0; i < 30; i += 1) world.step(STEP, autopilot(state, false));
    }
    return { screen: state.over ? SCREEN_OVER : SCREEN_PLAY, best: state.score };
  }
  if (name === 'over') {
    world.reset();
    playFor(world, OVER_LIMIT_SECONDS, true);
    // Let the explosion bloom and the wreckage settle before the frame.
    const settle = { moveX: 0, moveY: 0, aimX: state.player.x + 100, aimY: state.player.y, firing: false };
    for (let i = 0; i < 100; i += 1) world.step(STEP, settle);
    return { screen: SCREEN_OVER, best: state.score };
  }
  // title: the starfield idles behind the title screen, and no ship has launched yet.
  world.reset();
  state.player.alive = false;
  for (let i = 0; i < 150; i += 1) world.attract(STEP);
  return { screen: SCREEN_TITLE, best: 0 };
}
