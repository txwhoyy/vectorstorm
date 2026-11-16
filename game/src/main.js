// Boot and the one loop. The world advances in fixed 1/60 s steps (several in a slow frame,
// none in a fast one) while the renderer paints every animation frame; the game moves between
// four screens — title, play, paused, game over — and input actions drive the moves.
//
// ?seed=N fixes the run's random seed. ?shot=title|action|wave|over (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets window.__shotReady, which is how
// the entry's screenshots are taken.

import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createParticles } from './particles.js';
import {
  createWorld, EV_BOMB, EV_HURT, EV_KILL, EV_OVER, EV_POWERUP, EV_SHIELD_BREAK, EV_SHOOT, EV_WAVE, EV_WAVE_CLEAR,
} from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer } from './render.js';
import { createHud, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './hud.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const effects = createParticles();
const world = createWorld(createRandom(seed), effects);
const renderer = createRenderer(canvas, effects);
const hud = createHud(canvas);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state);
    hud.drawOverlay(world.state, scene.screen, scene.best);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  const audio = createAudio();
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.unlock();
    audio.uiStart();
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Wave 1. Good hunting.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(`Game over. Score ${world.state.score}. Best ${best}. Press Enter to retry.`);
  }

  /** Turn the world's drained events into sound. */
  function playEvents() {
    const events = world.state.events;
    for (const event of events) {
      if (event === EV_SHOOT) audio.shoot();
      else if (event === EV_KILL) audio.explosion(false);
      else if (event === EV_BOMB) audio.explosion(true);
      else if (event === EV_HURT) audio.hurt();
      else if (event === EV_SHIELD_BREAK) audio.shieldBreak();
      else if (event === EV_POWERUP) audio.powerup();
      else if (event === EV_WAVE) audio.waveStart();
      else if (event === EV_OVER) audio.gameOver();
      else if (event === EV_WAVE_CLEAR) audio.powerup();
    }
    events.length = 0;
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMuted();
      announce(muted ? 'Sound muted.' : 'Sound on.');
    }
    if (actions & ACTION_CONFIRM) audio.unlock();
    if (screen === SCREEN_TITLE && (actions & ACTION_CONFIRM)) startGame();
    else if (screen === SCREEN_OVER && (actions & ACTION_CONFIRM) && world.state.overTimer > 0.6) startGame();
    else if (screen === SCREEN_PLAY && (actions & ACTION_PAUSE)) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (screen === SCREEN_PAUSED && (actions & (ACTION_PAUSE | ACTION_CONFIRM))) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function controls() {
    const axis = input.axis();
    return {
      moveX: axis.x,
      moveY: axis.y,
      aimX: input.pointer.x,
      aimY: input.pointer.y,
      firing: input.firing(),
    };
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        world.step(STEP, controls());
        playEvents();
        accumulator -= STEP;
        if (world.state.over && world.state.overTimer > 1.1) endGame();
      }
    } else if (screen === SCREEN_TITLE) {
      // The title floats over the starfield: only the ambience advances, no wave runs.
      while (accumulator >= STEP) {
        world.attract(STEP);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
      if (screen === SCREEN_OVER) {
        // Keep the wreckage drifting behind the game-over panel.
        world.step(STEP, { moveX: 0, moveY: 0, aimX: world.state.player.x, aimY: world.state.player.y, firing: false });
        world.state.events.length = 0;
      }
    }
    renderer.draw(world.state);
    hud.drawOverlay(world.state, screen, best);
  }

  // Leaving the tab pauses a running game rather than letting the swarm feed unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  // No ship on the title screen: it launches with the first game.
  world.state.player.alive = false;
  announce('Vectorstorm. Click or press Enter to launch.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
