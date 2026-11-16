// The simulation: the ship, its bullets, the enemies and their bolts, the power-ups, the waves
// and the score. This module holds every rule of the game and nothing about how it is drawn or
// heard — the renderer reads `state`, and sound is main's job, driven by the event names step()
// leaves in `state.events` (drained by the caller each frame).
//
// One step advances the world by a fixed dt under one controls object:
//   { moveX, moveY }  thrust axes in -1..1
//   { aimX, aimY }    the point the ship's nose and cannon follow, in field coordinates
//   { firing }        whether the trigger is held

import { COMBO, ENEMY_FIRE, FIELD, PLAYER, POWERUP, STEP, WAVE } from './config.js';
import { createEnemy, updateEnemy, waveAggression, waveRoster } from './enemies.js';
import { createPowerup, POWERUP_KINDS, updatePowerup } from './powerups.js';

export const EV_SHOOT = 'shoot';
export const EV_KILL = 'kill';
export const EV_HURT = 'hurt';
export const EV_SHIELD_BREAK = 'shield-break';
export const EV_POWERUP = 'powerup';
export const EV_BOMB = 'bomb';
export const EV_WAVE = 'wave';
export const EV_WAVE_CLEAR = 'wave-clear';
export const EV_OVER = 'game-over';

const SHIP_SPAWN = { x: FIELD.width / 2, y: FIELD.height / 2 };
/** Enemies never spawn closer than this to the ship, so a warp-in is never an ambush. */
const SPAWN_MIN_DIST = 280;

export function createWorld(rng, effects) {
  const state = {
    time: 0,
    score: 0,
    kills: 0,
    combo: 0,
    comboTimer: 0,
    multiplier: 1,
    bestCombo: 0,
    wave: 0,
    phase: 'announce', // announce -> active -> intermission -> announce ...
    phaseTimer: 0,
    over: false,
    overTimer: 0,
    shake: 0,
    hurtFlash: 0,
    bombFlash: 0,
    bannerText: '',
    player: null,
    bullets: [],
    enemyBullets: [],
    enemies: [],
    powerups: [],
    spawnQueue: [],
    spawnTimer: 0,
    events: [],
  };

  function resetPlayer() {
    state.player = {
      x: SHIP_SPAWN.x, y: SHIP_SPAWN.y,
      vx: 0, vy: 0,
      angle: -Math.PI / 2,
      radius: PLAYER.radius,
      hull: PLAYER.hull,
      maxHull: PLAYER.hull,
      fireTimer: 0,
      rapidTimer: 0,
      shieldTimer: 0,
      invulnTimer: 0,
      trailTimer: 0,
      alive: true,
      thrust: 0,
    };
  }

  function reset() {
    state.time = 0;
    state.score = 0;
    state.kills = 0;
    state.combo = 0;
    state.comboTimer = 0;
    state.multiplier = 1;
    state.bestCombo = 0;
    state.wave = 0;
    state.over = false;
    state.overTimer = 0;
    state.shake = 0;
    state.hurtFlash = 0;
    state.bombFlash = 0;
    state.bullets.length = 0;
    state.enemyBullets.length = 0;
    state.enemies.length = 0;
    state.powerups.length = 0;
    state.spawnQueue.length = 0;
    state.events.length = 0;
    effects.clear();
    resetPlayer();
    beginWave(1);
  }

  function beginWave(number) {
    state.wave = number;
    state.phase = 'announce';
    state.phaseTimer = WAVE.announce;
    state.bannerText = `WAVE ${number}`;
    const roster = waveRoster(number);
    // Shuffle the roster so kinds arrive mixed, not in blocks.
    for (let i = roster.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng.next() * (i + 1));
      const held = roster[i];
      roster[i] = roster[j];
      roster[j] = held;
    }
    state.spawnQueue = roster;
    state.spawnTimer = 0;
    state.events.push(EV_WAVE);
  }

  function spawnInterval() {
    return Math.max(0.34, 0.92 - state.wave * 0.05);
  }

  function spawnPoint() {
    // A point on a random arena edge, re-rolled until it is a fair distance from the ship.
    for (let tries = 0; tries < 12; tries += 1) {
      const edge = rng.int(0, 3);
      const x = edge === 0 || edge === 1 ? rng.range(40, FIELD.width - 40) : (edge === 2 ? 44 : FIELD.width - 44);
      const y = edge === 0 ? 44 : edge === 1 ? FIELD.height - 44 : rng.range(40, FIELD.height - 40);
      const dx = x - state.player.x;
      const dy = y - state.player.y;
      if (dx * dx + dy * dy >= SPAWN_MIN_DIST * SPAWN_MIN_DIST || tries === 11) return { x, y };
    }
    return { x: 44, y: 44 };
  }

  function spawnFromQueue() {
    const kind = state.spawnQueue.shift();
    const point = spawnPoint();
    state.enemies.push(createEnemy(kind, point.x, point.y, rng, waveAggression(state.wave)));
  }

  /** Public for the screenshot scenes: drop a power-up of `kind` at a chosen point. */
  function dropPowerup(kind, x, y) {
    state.powerups.push(createPowerup(kind, x, y, rng));
  }

  function addScore(base, x, y) {
    const gained = base * state.multiplier;
    state.score += gained;
    effects.addText(x, y, `+${gained}`, '#eaf6ff', state.multiplier >= 4 ? 22 : 17);
  }

  function registerKill() {
    state.kills += 1;
    state.combo += 1;
    state.comboTimer = COMBO.window;
    state.multiplier = Math.min(COMBO.maxMultiplier, 1 + Math.floor(state.combo / COMBO.perTier));
    if (state.combo > state.bestCombo) state.bestCombo = state.combo;
  }

  function killEnemy(enemy, awardScore) {
    enemy.dead = true;
    const scale = enemy.kind === 'bulwark' ? 2.2 : 1;
    effects.explosion(enemy.x, enemy.y, enemy.type.color, scale, rng);
    if (awardScore) {
      registerKill();
      addScore(enemy.type.score, enemy.x, enemy.y - enemy.radius);
    }
    state.events.push(EV_KILL);
    if (awardScore && rng.chance(POWERUP.dropChance)) {
      dropPowerup(rng.pick(POWERUP_KINDS), enemy.x, enemy.y);
    }
  }

  function fireEnemyBullet(enemy, angle) {
    state.enemyBullets.push({
      x: enemy.x + Math.cos(angle) * (enemy.radius + 4),
      y: enemy.y + Math.sin(angle) * (enemy.radius + 4),
      vx: Math.cos(angle) * ENEMY_FIRE.bulletSpeed,
      vy: Math.sin(angle) * ENEMY_FIRE.bulletSpeed,
      radius: ENEMY_FIRE.bulletRadius,
      life: ENEMY_FIRE.bulletLife,
      dead: false,
    });
  }

  function damagePlayer(amount, sourceX, sourceY) {
    const player = state.player;
    if (!player.alive || player.invulnTimer > 0) return;
    if (player.shieldTimer > 0) {
      player.shieldTimer = 0;
      player.invulnTimer = PLAYER.invulnerable;
      effects.ring(player.x, player.y, '#39c2ff', 74, 0.4, 4);
      effects.burst(player.x, player.y, '#39c2ff', 14, 200, 0.4, 2.6, rng);
      state.events.push(EV_SHIELD_BREAK);
      return;
    }
    player.hull -= amount;
    player.invulnTimer = PLAYER.invulnerable;
    state.shake = Math.min(16, state.shake + 8);
    state.hurtFlash = 0.55;
    effects.burst(player.x, player.y, '#ff4757', 12, 220, 0.4, 2.6, rng);
    state.events.push(EV_HURT);
    if (player.hull <= 0) {
      player.hull = 0;
      player.alive = false;
      state.over = true;
      state.overTimer = 0;
      state.shake = 20;
      effects.explosion(player.x, player.y, '#35f1ff', 2.6, rng);
      effects.ring(player.x, player.y, '#35f1ff', 190, 0.7, 5);
      state.events.push(EV_OVER);
    }
  }

  function detonateBomb() {
    state.bombFlash = 0.7;
    state.shake = Math.min(20, state.shake + 12);
    effects.ring(state.player.x, state.player.y, '#ff5252', 620, 0.65, 6);
    for (const enemy of state.enemies) {
      if (!enemy.dead && enemy.warp <= 0) killEnemy(enemy, true);
    }
    state.enemyBullets.length = 0;
    state.events.push(EV_BOMB);
  }

  function collectPowerup(powerup) {
    const player = state.player;
    powerup.dead = true;
    effects.ring(powerup.x, powerup.y, powerup.type.color, 58, 0.35, 3);
    effects.addText(player.x, player.y - 30, powerup.type.name, powerup.type.color, 20);
    state.events.push(EV_POWERUP);
    if (powerup.kind === 'rapid') player.rapidTimer = POWERUP.rapidDuration;
    else if (powerup.kind === 'shield') player.shieldTimer = POWERUP.shieldDuration;
    else if (powerup.kind === 'bomb') detonateBomb();
  }

  function stepPlayer(dt, controls) {
    const player = state.player;
    if (!player.alive) return;
    player.angle = Math.atan2(controls.aimY - player.y, controls.aimX - player.x);
    player.vx += controls.moveX * PLAYER.accel * dt;
    player.vy += controls.moveY * PLAYER.accel * dt;
    const dampFactor = Math.exp(-PLAYER.damp * dt);
    if (controls.moveX === 0) player.vx *= dampFactor;
    if (controls.moveY === 0) player.vy *= dampFactor;
    const speed = Math.hypot(player.vx, player.vy);
    if (speed > PLAYER.speed) {
      player.vx = (player.vx / speed) * PLAYER.speed;
      player.vy = (player.vy / speed) * PLAYER.speed;
    }
    player.x = Math.min(FIELD.width - player.radius, Math.max(player.radius, player.x + player.vx * dt));
    player.y = Math.min(FIELD.height - player.radius, Math.max(player.radius, player.y + player.vy * dt));
    player.thrust = Math.min(1, speed / PLAYER.speed);

    // Engine trail: a mote every other step while the ship is moving.
    player.trailTimer -= dt;
    if (speed > 40 && player.trailTimer <= 0) {
      player.trailTimer = STEP * 2;
      const backX = player.x - Math.cos(player.angle) * (player.radius + 2);
      const backY = player.y - Math.sin(player.angle) * (player.radius + 2);
      effects.trail(backX, backY, -player.vx * 0.25, -player.vy * 0.25, '#1d7f96', rng);
    }

    if (player.fireTimer > 0) player.fireTimer -= dt;
    if (player.rapidTimer > 0) player.rapidTimer -= dt;
    if (player.shieldTimer > 0) player.shieldTimer -= dt;
    if (player.invulnTimer > 0) player.invulnTimer -= dt;

    if (controls.firing && player.fireTimer <= 0) {
      player.fireTimer = player.rapidTimer > 0 ? PLAYER.rapidInterval : PLAYER.fireInterval;
      const spread = rng.range(-0.016, 0.016);
      const angle = player.angle + spread;
      state.bullets.push({
        x: player.x + Math.cos(player.angle) * (player.radius + 6),
        y: player.y + Math.sin(player.angle) * (player.radius + 6),
        vx: Math.cos(angle) * PLAYER.bulletSpeed,
        vy: Math.sin(angle) * PLAYER.bulletSpeed,
        radius: PLAYER.bulletRadius,
        life: PLAYER.bulletLife,
        dead: false,
      });
      effects.burst(player.x + Math.cos(player.angle) * (player.radius + 8), player.y + Math.sin(player.angle) * (player.radius + 8), '#a5f3ff', 1, 40, 0.12, 2.4, rng);
      state.events.push(EV_SHOOT);
    }
  }

  function stepBullets(dt) {
    for (const bullet of state.bullets) {
      if (bullet.dead) continue;
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.life -= dt;
      if (bullet.life <= 0 || bullet.x < -20 || bullet.x > FIELD.width + 20 || bullet.y < -20 || bullet.y > FIELD.height + 20) {
        bullet.dead = true;
        continue;
      }
      for (const enemy of state.enemies) {
        if (enemy.dead || enemy.warp > 0) continue;
        const dx = enemy.x - bullet.x;
        const dy = enemy.y - bullet.y;
        const reach = enemy.radius + bullet.radius;
        if (dx * dx + dy * dy > reach * reach) continue;
        bullet.dead = true;
        enemy.hp -= 1;
        enemy.flash = 0.09;
        if (enemy.hp <= 0) killEnemy(enemy, true);
        else effects.burst(bullet.x, bullet.y, enemy.type.color, 5, 170, 0.3, 2.2, rng);
        break;
      }
    }
    for (const bolt of state.enemyBullets) {
      if (bolt.dead) continue;
      bolt.x += bolt.vx * dt;
      bolt.y += bolt.vy * dt;
      bolt.life -= dt;
      if (bolt.life <= 0 || bolt.x < -20 || bolt.x > FIELD.width + 20 || bolt.y < -20 || bolt.y > FIELD.height + 20) {
        bolt.dead = true;
        continue;
      }
      const player = state.player;
      if (player.alive) {
        const dx = player.x - bolt.x;
        const dy = player.y - bolt.y;
        const reach = player.radius + bolt.radius;
        if (dx * dx + dy * dy <= reach * reach) {
          bolt.dead = true;
          damagePlayer(ENEMY_FIRE.damage, bolt.x, bolt.y);
        }
      }
    }
    state.bullets = state.bullets.filter((b) => !b.dead);
    state.enemyBullets = state.enemyBullets.filter((b) => !b.dead);
  }

  function stepContacts() {
    const player = state.player;
    if (!player.alive) return;
    for (const enemy of state.enemies) {
      if (enemy.dead || enemy.warp > 0) continue;
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const reach = player.radius + enemy.radius - 3;
      if (dx * dx + dy * dy > reach * reach) continue;
      killEnemy(enemy, false);
      damagePlayer(enemy.type.damage, enemy.x, enemy.y);
      if (!player.alive) return;
    }
    for (const powerup of state.powerups) {
      if (powerup.dead) continue;
      const dx = player.x - powerup.x;
      const dy = player.y - powerup.y;
      const reach = player.radius + powerup.radius + 4;
      if (dx * dx + dy * dy <= reach * reach) collectPowerup(powerup);
    }
  }

  function stepWaves(dt) {
    if (state.phase === 'announce') {
      state.phaseTimer -= dt;
      if (state.phaseTimer <= 0) state.phase = 'active';
      return;
    }
    if (state.phase === 'active') {
      if (state.spawnQueue.length > 0) {
        state.spawnTimer -= dt;
        if (state.spawnTimer <= 0) {
          state.spawnTimer = spawnInterval();
          // Spawn in small packs so the field builds pressure instead of trickling.
          const pack = state.wave >= 6 ? 3 : state.wave >= 3 ? 2 : 1;
          for (let i = 0; i < pack && state.spawnQueue.length > 0; i += 1) spawnFromQueue();
        }
      } else if (state.enemies.length === 0 && !state.over) {
        const bonus = WAVE.clearBonusPerWave * state.wave;
        state.score += bonus;
        effects.addText(FIELD.width / 2, FIELD.height / 2 - 90, `WAVE ${state.wave} CLEAR  +${bonus}`, '#3dffb0', 26);
        state.events.push(EV_WAVE_CLEAR);
        state.phase = 'intermission';
        state.phaseTimer = WAVE.intermission;
      }
      return;
    }
    // intermission
    state.phaseTimer -= dt;
    if (state.phaseTimer <= 0 && !state.over) beginWave(state.wave + 1);
  }

  function step(dt, controls) {
    state.time += dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 34);
    if (state.hurtFlash > 0) state.hurtFlash -= dt;
    if (state.bombFlash > 0) state.bombFlash -= dt;
    if (state.over) state.overTimer += dt;

    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) {
        state.combo = 0;
        state.multiplier = 1;
      }
    }

    stepWaves(dt);
    stepPlayer(dt, controls);
    for (const enemy of state.enemies) {
      if (!enemy.dead) updateEnemy(enemy, state.player, dt, fireEnemyBullet);
    }
    for (const powerup of state.powerups) updatePowerup(powerup, dt);
    stepBullets(dt);
    stepContacts();
    state.enemies = state.enemies.filter((e) => !e.dead);
    state.powerups = state.powerups.filter((p) => !p.dead);
    effects.update(dt);
  }

  /**
   * Advance only the ambience — the clock, the particles and the flashes — for the title
   * backdrop, where no wave runs and nothing hunts the ship.
   */
  function attract(dt) {
    state.time += dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 34);
    if (state.hurtFlash > 0) state.hurtFlash -= dt;
    if (state.bombFlash > 0) state.bombFlash -= dt;
    effects.update(dt);
  }

  resetPlayer();
  state.player.hull = PLAYER.hull;

  return { state, reset, step, attract, dropPowerup };
}
