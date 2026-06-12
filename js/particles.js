// Particle system for visual effects
class ParticleSystem {
  constructor() {
    this.particles = [];
  }

  emit(x, y, opts = {}) {
    const {
      count = 8,
      color = '#00d4ff',
      speed = 3,
      spreadAngle = Math.PI * 2,
      dirAngle = 0,
      size = 4,
      life = 0.6,
      gravity = 0,
      type = 'circle',
    } = opts;

    for (let i = 0; i < count; i++) {
      const angle = dirAngle + (spreadAngle * (Math.random() - 0.5));
      const spd = speed * (0.5 + Math.random() * 0.8);
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        size: size * (0.6 + Math.random() * 0.8),
        color,
        life,
        maxLife: life,
        gravity,
        type,
      });
    }
  }

  emitHit(x, y, dirAngle, color = '#ff6b35') {
    // Main burst
    this.emit(x, y, { count: 12, color, speed: 5, spreadAngle: Math.PI * 0.8, dirAngle, size: 5, life: 0.5, gravity: 0.05 });
    // Sparks
    this.emit(x, y, { count: 6, color: '#ffd60a', speed: 8, spreadAngle: Math.PI * 0.6, dirAngle, size: 3, life: 0.4, gravity: 0.1 });
    // Ring
    this.emitRing(x, y, { color, radius: 0, maxRadius: 40, life: 0.3 });
  }

  emitRing(x, y, opts = {}) {
    const { color = '#00d4ff', radius = 0, maxRadius = 60, life = 0.4, lineWidth = 2 } = opts;
    this.particles.push({ type: 'ring', x, y, radius, maxRadius, color, life, maxLife: life, lineWidth });
  }

  emitDamage(cx, cy) {
    this.emit(cx, cy, { count: 20, color: '#ff2d55', speed: 6, size: 6, life: 0.7, gravity: 0.08 });
    this.emitRing(cx, cy, { color: '#ff2d55', maxRadius: 80, life: 0.4, lineWidth: 3 });
  }

  emitScore(x, y, text, color = '#ffd60a') {
    this.particles.push({ type: 'text', x, y, vy: -1.5, text, color, life: 0.9, maxLife: 0.9 });
  }

  emitTrail(x, y, color = '#00d4ff', size = 3) {
    this.particles.push({
      type: 'circle', x, y,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      size, color, life: 0.25, maxLife: 0.25, gravity: 0,
    });
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) { this.particles.splice(i, 1); continue; }

      if (p.type === 'ring') {
        p.radius += (p.maxRadius / p.maxLife) * dt;
        continue;
      }
      if (p.type === 'text') {
        p.y += p.vy;
        continue;
      }
      p.x += p.vx;
      p.y += p.vy;
      if (p.gravity) p.vy += p.gravity;
    }
  }

  draw(ctx) {
    for (const p of this.particles) {
      const alpha = Math.max(0, p.life / p.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;

      if (p.type === 'ring') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.lineWidth * alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.type === 'text') {
        ctx.fillStyle = p.color;
        ctx.font = `bold ${20 * (0.7 + alpha * 0.3)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 10;
        ctx.fillText(p.text, p.x, p.y);
      } else {
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = p.size * 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }
}
