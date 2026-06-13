// Flick gesture detection and projectile management
class FlickDetector {
  constructor(canvas) {
    this.canvas = canvas;
    this.touches = new Map();
    this.onFlick = null;
    this._bind();
  }

  _bind() {
    this.canvas.addEventListener('touchstart', e => this._onStart(e), { passive: true });
    this.canvas.addEventListener('touchmove', e => this._onMove(e), { passive: true });
    this.canvas.addEventListener('touchend', e => this._onEnd(e), { passive: true });
    this.canvas.addEventListener('touchcancel', e => this._onEnd(e), { passive: true });

    this._mouseDown = false;
    this._mouseStart = null;
    this.canvas.addEventListener('mousedown', e => {
      this._mouseDown = true;
      this._mouseStart = { x: e.clientX, y: e.clientY, time: performance.now() };
    });
    this.canvas.addEventListener('mousemove', e => {
      if (this._mouseDown) this._mouseCur = { x: e.clientX, y: e.clientY };
    });
    this.canvas.addEventListener('mouseup', e => {
      if (!this._mouseDown || !this._mouseStart) return;
      this._mouseDown = false;
      const dx = e.clientX - this._mouseStart.x;
      const dy = e.clientY - this._mouseStart.y;
      const dt = (performance.now() - this._mouseStart.time) / 1000;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 20 && dt < 0.6) {
        const speed = Math.min(dist / dt / 100, 15);
        if (this.onFlick) this.onFlick(Math.atan2(dy, dx), speed, this._mouseStart.x, this._mouseStart.y);
      }
      this._mouseStart = null;
    });
  }

  _onStart(e) {
    for (const t of e.changedTouches) {
      this.touches.set(t.identifier, {
        startX: t.clientX, startY: t.clientY,
        x: t.clientX, y: t.clientY,
        startTime: performance.now(),
      });
    }
  }

  _onMove(e) {
    for (const t of e.changedTouches) {
      const d = this.touches.get(t.identifier);
      if (d) { d.x = t.clientX; d.y = t.clientY; }
    }
  }

  _onEnd(e) {
    for (const t of e.changedTouches) {
      const d = this.touches.get(t.identifier);
      if (!d) continue;
      this.touches.delete(t.identifier);
      const dx = t.clientX - d.startX, dy = t.clientY - d.startY;
      const dt = (performance.now() - d.startTime) / 1000;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 30 && dt < 0.5) {
        const speed = Math.min(dist / dt / 80, 18);
        if (this.onFlick) this.onFlick(Math.atan2(dy, dx), speed, d.startX, d.startY);
      }
    }
  }

  getActiveTouches() { return Array.from(this.touches.values()); }
}

// ── Projectile ──
class Projectile {
  constructor(x, y, angle, speed, opts = {}) {
    const { damage = 1, sizeBonus = 0, pierce = false,
            homing = false, explosive = false, isSplit = false } = opts;

    this.x = x; this.y = y;
    this.angle = angle;
    this.speed = speed * 380;
    this.vx = Math.cos(angle) * this.speed;
    this.vy = Math.sin(angle) * this.speed;
    this.radius = (isSplit ? 10 : 14) + damage * 3 + sizeBonus;
    this.damage = damage;
    this.pierce = pierce;
    this.homing = homing;
    this.explosive = explosive;
    this.isSplit = isSplit;
    this.hitEnemies = pierce ? new Set() : null;
    this.dead = false;
    this.age = 0;
    this.maxAge = isSplit ? 0.7 : 1.2;
    this.trail = [];

    // Color by type
    if (explosive) {
      this.color = '#ff6b35'; this.glowColor = 'rgba(255,107,53,0.6)';
    } else if (homing) {
      this.color = '#30d158'; this.glowColor = 'rgba(48,209,88,0.5)';
    } else if (pierce) {
      this.color = '#00ffaa'; this.glowColor = 'rgba(0,255,170,0.5)';
    } else if (isSplit) {
      this.color = '#ffd60a'; this.glowColor = 'rgba(255,214,10,0.5)';
    } else {
      const colors = ['#00d4ff', '#ffd60a', '#bf5af2', '#ff2d55', '#ff9f0a'];
      this.color = colors[Math.min(damage - 1, colors.length - 1)];
      const glows = ['rgba(0,212,255,0.5)', 'rgba(255,214,10,0.5)', 'rgba(191,90,242,0.5)', 'rgba(255,45,85,0.5)', 'rgba(255,159,10,0.5)'];
      this.glowColor = glows[Math.min(damage - 1, glows.length - 1)];
    }
  }

  update(dt, cw, ch, enemyList = null) {
    if (this.dead) return;

    // Homing: gently steer toward nearest enemy
    if (this.homing && enemyList && enemyList.length > 0) {
      let nearest = null, minDist = Infinity;
      for (const e of enemyList) {
        if (e.dead) continue;
        const dx = e.x - this.x, dy = e.y - this.y;
        const d = dx * dx + dy * dy;
        if (d < minDist) { minDist = d; nearest = e; }
      }
      if (nearest) {
        const target = Math.atan2(nearest.y - this.y, nearest.x - this.x);
        let diff = target - this.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.angle += Math.sign(diff) * Math.min(Math.abs(diff), 3.5 * dt);
        const spd = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
        this.vx = Math.cos(this.angle) * spd;
        this.vy = Math.sin(this.angle) * spd;
      }
    }

    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 8) this.trail.shift();
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.age += dt;

    if (this.age > this.maxAge || this.x < -80 || this.x > cw + 80 || this.y < -80 || this.y > ch + 80) {
      this.dead = true;
    }
  }

  draw(ctx) {
    if (this.dead) return;
    const alpha = Math.max(0, 1 - this.age / this.maxAge);

    // Trail
    for (let i = 0; i < this.trail.length; i++) {
      const t = this.trail[i];
      const ta = (i / this.trail.length) * 0.4 * alpha;
      ctx.save();
      ctx.globalAlpha = ta;
      ctx.fillStyle = this.color;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(t.x, t.y, this.radius * (i / this.trail.length) * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = this.glowColor;
    ctx.shadowBlur = 22;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();

    // Core
    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius * 0.38, 0, Math.PI * 2);
    ctx.fill();

    // Explosive: pulsing ring
    if (this.explosive) {
      const pulse = 0.5 + Math.sin(this.age * 18) * 0.35;
      ctx.strokeStyle = '#ff6b35';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#ff6b35';
      ctx.shadowBlur = 12;
      ctx.globalAlpha = alpha * pulse;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius * 1.7, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Homing: orbiting dot
    if (this.homing) {
      const orb = this.age * 9;
      ctx.fillStyle = '#30d158';
      ctx.shadowColor = '#30d158';
      ctx.shadowBlur = 10;
      ctx.globalAlpha = alpha * 0.85;
      ctx.beginPath();
      ctx.arc(
        this.x + Math.cos(orb) * (this.radius + 7),
        this.y + Math.sin(orb) * (this.radius + 7),
        3.5, 0, Math.PI * 2
      );
      ctx.fill();
    }

    ctx.restore();
  }
}

// ── Projectile Manager ──
class ProjectileManager {
  constructor() { this.projectiles = []; }

  fire(x, y, angle, speedFactor, opts = {}) {
    this.projectiles.push(new Projectile(x, y, angle, speedFactor, opts));
  }

  update(dt, cw, ch, enemyList = null) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      this.projectiles[i].update(dt, cw, ch, enemyList);
      if (this.projectiles[i].dead) this.projectiles.splice(i, 1);
    }
  }

  draw(ctx) { for (const p of this.projectiles) p.draw(ctx); }

  get active() { return this.projectiles.filter(p => !p.dead); }
}
