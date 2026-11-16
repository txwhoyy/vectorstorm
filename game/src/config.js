// VECTORSTORM tuning: every number and colour the game runs on lives here, so the feel of the
// game can be adjusted in one place. The arena is a fixed 1280x720 logical field; the renderer
// scales it to the window, so no rule below depends on the player's screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 14,
  /** Top speed in px/s; the ship accelerates toward it and glides to a stop when keys release. */
  speed: 348,
  accel: 2700,
  /** Exponential damping per second applied to velocity when no thrust is held. */
  damp: 5.2,
  hull: 100,
  /** Seconds between shots on the standard cannon, and on the rapid-fire power-up. */
  fireInterval: 0.155,
  rapidInterval: 0.068,
  bulletSpeed: 820,
  bulletLife: 0.85,
  bulletRadius: 4,
  /** Seconds of invulnerability after taking a hit, so one crowd cannot drain the hull at once. */
  invulnerable: 0.9,
};

export const COMBO = {
  /** Seconds a kill chain stays alive without another kill. */
  window: 2.6,
  /** Kills per multiplier tier: the multiplier is 1 + floor(combo / perTier), capped. */
  perTier: 6,
  maxMultiplier: 8,
};

/** Enemy bullets: fired only by the shooter kind, tuned slower than the player's own. */
export const ENEMY_FIRE = {
  bulletSpeed: 265,
  bulletRadius: 4.5,
  bulletLife: 3.2,
  damage: 10,
  interval: 2.3,
  range: 540,
};

export const POWERUP = {
  radius: 15,
  /** Chance that a destroyed enemy drops a power-up. */
  dropChance: 0.085,
  /** Seconds a dropped power-up drifts before it fades away. */
  life: 11,
  driftSpeed: 26,
  rapidDuration: 10,
  shieldDuration: 14,
};

export const WAVE = {
  /** Seconds the "WAVE N" banner holds before the first spawn of the wave. */
  announce: 1.7,
  /** Breathing room between the last kill of a wave and the next banner. */
  intermission: 2.4,
  /** Points for clearing a wave, times the wave number. */
  clearBonusPerWave: 100,
};

export const PALETTE = {
  backdrop: '#05060f',
  deepSpace: '#090b1d',
  grid: '#123043',
  gridGlow: '#0d5a74',
  star: '#9fd8e8',
  player: '#35f1ff',
  playerCore: '#eafcff',
  bullet: '#a5f3ff',
  enemyBullet: '#ff5d8f',
  dart: '#ff3860',
  weaver: '#ffc53d',
  orbiter: '#c77dff',
  shooter: '#2ee6a8',
  bulwark: '#ff6b35',
  rapid: '#ffe93d',
  shield: '#39c2ff',
  bomb: '#ff5252',
  text: '#eaf6ff',
  muted: '#7d8db0',
  hullGood: '#3dffb0',
  hullBad: '#ff4757',
  panel: 'rgba(8, 12, 28, 0.72)',
  panelEdge: '#1e5f74',
};

export const FONT = '"Segoe UI", system-ui, -apple-system, sans-serif';
export const FONT_MONO = '"Consolas", "SF Mono", ui-monospace, monospace';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'vectorstorm.best';
