// Enemy definitions and logic
const ENEMY_TYPES = {
  grunt: {
    color: '#ff6b35',
    glowColor: 'rgba(255,107,53,0.4)',
    radius: 18,
    hp: 1,
    speed: 90,
    score: 100,
    shape: 'circle',
  },
  fast: {
    color: '#ff2d55',
    glowColor: 'rgba(255,45,85,0.4)',
    radius: 14,
    hp: 1,
    speed: 160,
    score: 150,
    shape: 'diamond',
  },
  tank: {
    color: '#bf5af2',
    glowColor: 'rgba(191,90,242,0.4)',
    radius: 28,
    hp: 3,
    speed: 55,
    score: 300,
    shape: 'hexagon',
  },
  shooter: {
    color: '#ffd60a',
    glowColor: 'rgba(255,214,10,0.4)',
    radius: 16,
    hp: 2,
    speed: 70,
    score: 200,
    shape: 'triangle',
  },
  boss: {
    color: '#ff3b30',
    glowColor: 'rgba(255,59,48,0.5)',
    radius: 40,
    hp: 10,
    speed: 40,
    score: 1000,
    shape: 'star',
  },
};

class Enemy {
  constructor(type, x, y, targetX, targetY) {
    const def = ENEMY_TYPES[type];
    Object.assign(this, def);
    this.type = type;
    this.x = x;
    this.y = y;
    this.maxHp = def.hp;
    // hitRadius is larger than visual radius for more forgiving hit detection
    this.hitRadius = def.radius * 1.6;
    this.angle = Math.atan2(targetY - y, targetX - x);
    this.vx = Math.cos(this.angle) * this.speed;
    this.vy = Math.sin(this.angle) * this.speed;
    this.dead = false;
    this.hitFlash = 0;
    this.pulsePhase = Math.random() * Math.PI * 2;
    this.wobble = 0;
  }

  update(dt, playerX, playerY) {
    if (this.dead) return;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.pulsePhase += dt * 3;
    if (this.hitFlash > 0) this.hitFlash -= dt;
    this.wobble += dt * 5;

    // Shooter type zigzags
    if (this.type === 'fast') {
      const perp = this.angle + Math.PI / 2;
      this.x += Math.sin(this.wobble * 2) * 1.2;
      this.y += Math.cos(this.wobble * 2) * 1.2;
    }
  }

  hit(dmg = 1) {
    this.hp -= dmg;
    this.hitFlash = 0.15;
    return this.hp <= 0;
  }

  draw(ctx) {
    if (this.dead) return;
    const pulse = 1 + Math.sin(this.pulsePhase) * 0.06;
    const r = this.radius * pulse;
    const flash = this.hitFlash > 0;

    ctx.save();
    ctx.translate(this.x, this.y);

    // Glow
    ctx.shadowColor = this.glowColor;
    ctx.shadowBlur = 20 + Math.sin(this.pulsePhase) * 8;

    const color = flash ? '#ffffff' : this.color;

    if (this.shape === 'circle') {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    } else if (this.shape === 'diamond') {
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(r * 0.7, 0);
      ctx.lineTo(0, r);
      ctx.lineTo(-r * 0.7, 0);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    } else if (this.shape === 'hexagon') {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 6;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    } else if (this.shape === 'triangle') {
      const rot = this.pulsePhase * 0.5;
      ctx.rotate(rot);
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    } else if (this.shape === 'star') {
      ctx.rotate(this.pulsePhase * 0.3);
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        const rad = i % 2 === 0 ? r : r * 0.45;
        ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
      }
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
    }

    // HP bar for multi-hp enemies
    if (this.maxHp > 1) {
      const bw = r * 2;
      const bh = 4;
      const by = r + 6;
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(-bw / 2, by, bw, bh);
      ctx.fillStyle = this.hp / this.maxHp > 0.5 ? '#30d158' : this.hp / this.maxHp > 0.25 ? '#ffd60a' : '#ff2d55';
      ctx.fillRect(-bw / 2, by, bw * (this.hp / this.maxHp), bh);
    }

    ctx.restore();
  }
}

class EnemyManager {
  constructor() {
    this.enemies = [];
    this.spawnTimer = 0;
    this.wave = 1;
    this.waveConfig = this._buildWaveConfig(1);
  }

  _buildWaveConfig(wave) {
    const base = {
      spawnInterval: Math.max(0.6, 2.0 - wave * 0.1),
      types: ['grunt'],
      maxEnemies: 8 + wave * 2,
    };
    if (wave >= 2) base.types.push('fast');
    if (wave >= 3) base.types.push('tank');
    if (wave >= 4) base.types.push('shooter');
    if (wave >= 6) base.spawnInterval = Math.max(0.4, base.spawnInterval);
    return base;
  }

  setWave(wave) {
    this.wave = wave;
    this.waveConfig = this._buildWaveConfig(wave);
    this.enemies = [];
    this.spawnTimer = 0;

    // Boss wave every 5 waves
    if (wave % 5 === 0) {
      this.pendingBoss = true;
    }
  }

  spawnEnemy(cw, ch) {
    const cfg = this.waveConfig;
    const type = cfg.types[Math.floor(Math.random() * cfg.types.length)];
    const cx = cw / 2, cy = ch / 2;

    // Spawn on edge
    let x, y;
    const side = Math.floor(Math.random() * 4);
    if (side === 0) { x = Math.random() * cw; y = -40; }
    else if (side === 1) { x = cw + 40; y = Math.random() * ch; }
    else if (side === 2) { x = Math.random() * cw; y = ch + 40; }
    else { x = -40; y = Math.random() * ch; }

    this.enemies.push(new Enemy(type, x, y, cx, cy));
  }

  spawnBoss(cw, ch) {
    const x = cw / 2;
    const y = -60;
    this.enemies.push(new Enemy('boss', x, y, cw / 2, ch / 2));
    this.pendingBoss = false;
  }

  update(dt, cw, ch, playerRadius) {
    const cfg = this.waveConfig;

    // Spawn logic
    if (this.enemies.length < cfg.maxEnemies) {
      this.spawnTimer += dt;
      if (this.spawnTimer >= cfg.spawnInterval) {
        this.spawnTimer = 0;
        if (this.pendingBoss && this.enemies.length === 0) {
          this.spawnBoss(cw, ch);
        } else if (!this.pendingBoss) {
          this.spawnEnemy(cw, ch);
        }
      }
    }

    const cx = cw / 2, cy = ch / 2;
    const reached = [];

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      e.update(dt, cx, cy);

      if (e.dead) { this.enemies.splice(i, 1); continue; }

      const dx = e.x - cx, dy = e.y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < playerRadius + e.radius) {
        reached.push(e);
        this.enemies.splice(i, 1);
      }
    }

    return reached;
  }

  checkProjectileHits(projectiles, particles) {
    const hits = [];
    for (const proj of projectiles) {
      if (proj.dead) continue;
      for (const enemy of this.enemies) {
        if (enemy.dead) continue;
        if (proj.hitEnemies && proj.hitEnemies.has(enemy)) continue;
        const dx = proj.x - enemy.x, dy = proj.y - enemy.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < proj.radius + enemy.hitRadius) {
          const killed = enemy.hit(proj.damage || 1);

          if (proj.pierce) {
            proj.hitEnemies.add(enemy);
          } else {
            proj.dead = true;
          }

          const hitAngle = Math.atan2(dy, dx);
          particles.emitHit(enemy.x, enemy.y, hitAngle, enemy.color);

          if (killed) {
            enemy.dead = true;
            particles.emitRing(enemy.x, enemy.y, { color: enemy.color, maxRadius: enemy.radius * 3, life: 0.4 });
          }

          hits.push({ enemy, killed, score: killed ? enemy.score : 0 });
          if (!proj.pierce) break;
        }
      }
    }
    return hits;
  }

  draw(ctx) {
    for (const e of this.enemies) e.draw(ctx);
  }

  get count() { return this.enemies.length; }
}
