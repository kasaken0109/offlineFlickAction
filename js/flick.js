// Flick gesture detection and projectile management
class FlickDetector {
  constructor(canvas) {
    this.canvas = canvas;
    this.touches = new Map(); // touchId -> { startX, startY, startTime, x, y }
    this.onFlick = null; // callback(angle, speed, startX, startY)
    this._bind();
  }

  _bind() {
    this.canvas.addEventListener('touchstart', e => this._onStart(e), { passive: true });
    this.canvas.addEventListener('touchmove', e => this._onMove(e), { passive: true });
    this.canvas.addEventListener('touchend', e => this._onEnd(e), { passive: true });
    this.canvas.addEventListener('touchcancel', e => this._onEnd(e), { passive: true });

    // Mouse fallback for desktop testing
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
        const angle = Math.atan2(dy, dx);
        if (this.onFlick) this.onFlick(angle, speed, this._mouseStart.x, this._mouseStart.y);
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
      const data = this.touches.get(t.identifier);
      if (data) { data.x = t.clientX; data.y = t.clientY; }
    }
  }

  _onEnd(e) {
    for (const t of e.changedTouches) {
      const data = this.touches.get(t.identifier);
      if (!data) continue;
      this.touches.delete(t.identifier);

      const dx = t.clientX - data.startX;
      const dy = t.clientY - data.startY;
      const dt = (performance.now() - data.startTime) / 1000;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Flick: minimum distance 30px, maximum time 0.5s
      if (dist > 30 && dt < 0.5) {
        const speed = Math.min(dist / dt / 80, 18);
        const angle = Math.atan2(dy, dx);
        if (this.onFlick) this.onFlick(angle, speed, data.startX, data.startY);
      }
    }
  }

  getActiveTouches() {
    return Array.from(this.touches.values());
  }
}

class Projectile {
  constructor(x, y, angle, speed, damage = 1) {
    this.x = x;
    this.y = y;
    this.startX = x;
    this.startY = y;
    this.angle = angle;
    this.speed = speed * 380;
    this.vx = Math.cos(angle) * this.speed;
    this.vy = Math.sin(angle) * this.speed;
    this.radius = 8 + damage * 2;
    this.damage = damage;
    this.dead = false;
    this.age = 0;
    this.maxAge = 1.2;
    this.trail = [];
    this.color = damage > 1 ? '#ffd60a' : '#00d4ff';
    this.glowColor = damage > 1 ? 'rgba(255,214,10,0.5)' : 'rgba(0,212,255,0.5)';
  }

  update(dt, cw, ch) {
    if (this.dead) return;
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 8) this.trail.shift();

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.age += dt;

    if (this.age > this.maxAge || this.x < -60 || this.x > cw + 60 || this.y < -60 || this.y > ch + 60) {
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
      const tr = this.radius * (i / this.trail.length) * 0.7;
      ctx.beginPath();
      ctx.arc(t.x, t.y, tr, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Projectile
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.shadowColor = this.glowColor;
    ctx.shadowBlur = 20;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();

    // Inner bright core
    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

class ProjectileManager {
  constructor() {
    this.projectiles = [];
  }

  fire(x, y, angle, speedFactor, damage = 1) {
    this.projectiles.push(new Projectile(x, y, angle, speedFactor, damage));
  }

  update(dt, cw, ch) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      this.projectiles[i].update(dt, cw, ch);
      if (this.projectiles[i].dead) this.projectiles.splice(i, 1);
    }
  }

  draw(ctx) {
    for (const p of this.projectiles) p.draw(ctx);
  }

  get active() { return this.projectiles.filter(p => !p.dead); }
}
