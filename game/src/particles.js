// Particles and floating text: the game's juice. Sparks, explosion shards, engine trails,
// shockwave rings and rising score popups all live here, in fixed pools allocated once at boot
// so play never allocates. Nothing in this module knows the rules; the world asks for an effect
// at a position and this module runs and draws it.

const MAX_PARTICLES = 900;
const MAX_TEXTS = 48;
const MAX_RINGS = 24;

export function createParticles() {
  const sparks = [];
  for (let i = 0; i < MAX_PARTICLES; i += 1) {
    sparks.push({ alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: '#ffffff', drag: 1, gravity: 0, shrink: true });
  }
  const texts = [];
  for (let i = 0; i < MAX_TEXTS; i += 1) {
    texts.push({ alive: false, x: 0, y: 0, life: 0, maxLife: 1, value: '', color: '#ffffff', size: 18 });
  }
  const rings = [];
  for (let i = 0; i < MAX_RINGS; i += 1) {
    rings.push({ alive: false, x: 0, y: 0, life: 0, maxLife: 1, maxRadius: 60, width: 3, color: '#ffffff' });
  }
  let cursor = 0;

  function spawn(x, y, vx, vy, life, size, color, drag, gravity, shrink) {
    const p = sparks[cursor];
    cursor = (cursor + 1) % MAX_PARTICLES;
    p.alive = true;
    p.x = x; p.y = y; p.vx = vx; p.vy = vy;
    p.life = life; p.maxLife = life;
    p.size = size; p.color = color;
    p.drag = drag; p.gravity = gravity; p.shrink = shrink;
  }

  return {
    /** A radial burst of sparks, as when a bullet lands or a small enemy breaks up. */
    burst(x, y, color, count, speed, life, size, rng) {
      for (let i = 0; i < count; i += 1) {
        const angle = rng.angle();
        const v = speed * rng.range(0.25, 1);
        spawn(x, y, Math.cos(angle) * v, Math.sin(angle) * v, life * rng.range(0.5, 1.1), size * rng.range(0.6, 1.3), color, 2.6, 0, true);
      }
    },

    /** An enemy's death: a fan of glowing shards under slight gravity, a white core flash and
     *  a shockwave ring. `scale` grows the whole effect for the big kinds and the ship itself. */
    explosion(x, y, color, scale, rng) {
      const count = Math.round(16 * scale);
      for (let i = 0; i < count; i += 1) {
        const angle = rng.angle();
        const v = rng.range(60, 340) * scale;
        spawn(x, y, Math.cos(angle) * v, Math.sin(angle) * v, rng.range(0.35, 0.8), rng.range(2, 4.5) * scale, color, 1.8, 130, true);
      }
      // A bright core flash: a few fast, short, fat sparks at the centre.
      for (let i = 0; i < 6; i += 1) {
        const angle = rng.angle();
        const v = rng.range(20, 90);
        spawn(x, y, Math.cos(angle) * v, Math.sin(angle) * v, 0.16, 7 * scale, '#ffffff', 3.5, 0, true);
      }
      this.ring(x, y, color, 46 * scale, 0.32, 3);
    },

    /** A single engine-trail mote behind the ship. */
    trail(x, y, vx, vy, color, rng) {
      spawn(x, y, vx + rng.range(-14, 14), vy + rng.range(-14, 14), rng.range(0.2, 0.42), rng.range(2, 3.6), color, 2.2, 0, true);
    },

    /** An expanding shockwave ring. */
    ring(x, y, color, maxRadius, life, width) {
      for (const r of rings) {
        if (r.alive) continue;
        r.alive = true;
        r.x = x; r.y = y; r.life = life; r.maxLife = life;
        r.maxRadius = maxRadius; r.width = width; r.color = color;
        return;
      }
    },

    /** A floating score popup that rises and fades. */
    addText(x, y, value, color, size = 18) {
      for (const t of texts) {
        if (t.alive) continue;
        t.alive = true;
        t.x = x; t.y = y; t.life = 0.95; t.maxLife = 0.95;
        t.value = value; t.color = color; t.size = size;
        return;
      }
    },

    update(dt) {
      for (const p of sparks) {
        if (!p.alive) continue;
        p.life -= dt;
        if (p.life <= 0) { p.alive = false; continue; }
        const dragFactor = Math.max(0, 1 - p.drag * dt);
        p.vx *= dragFactor;
        p.vy = p.vy * dragFactor + p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
      for (const t of texts) {
        if (!t.alive) continue;
        t.life -= dt;
        if (t.life <= 0) { t.alive = false; continue; }
        t.y -= 44 * dt;
      }
      for (const r of rings) {
        if (!r.alive) continue;
        r.life -= dt;
        if (r.life <= 0) r.alive = false;
      }
    },

    draw(ctx) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const p of sparks) {
        if (!p.alive) continue;
        const fade = p.life / p.maxLife;
        const size = p.shrink ? p.size * fade : p.size;
        if (size <= 0.2) continue;
        ctx.globalAlpha = Math.min(1, fade * 1.6);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fill();
      }
      for (const r of rings) {
        if (!r.alive) continue;
        const progress = 1 - r.life / r.maxLife;
        ctx.globalAlpha = (1 - progress) * 0.8;
        ctx.strokeStyle = r.color;
        ctx.lineWidth = r.width * (1 - progress) + 0.5;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.maxRadius * (0.2 + 0.8 * progress), 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const t of texts) {
        if (!t.alive) continue;
        const fade = Math.min(1, (t.life / t.maxLife) * 2);
        ctx.globalAlpha = fade;
        ctx.font = `700 ${t.size}px "Segoe UI", system-ui, sans-serif`;
        ctx.fillStyle = t.color;
        ctx.fillText(t.value, t.x, t.y);
      }
      ctx.restore();
    },

    clear() {
      for (const p of sparks) p.alive = false;
      for (const t of texts) t.alive = false;
      for (const r of rings) r.alive = false;
    },
  };
}
