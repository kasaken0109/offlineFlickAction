// Main game engine
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game states
const STATE = { MENU: 'menu', PLAYING: 'playing', PAUSED: 'paused', GAMEOVER: 'gameover', UPGRADING: 'upgrading' };

// ── Upgrade pool ──
const UPGRADE_POOL = [
  {
    id: 'damage', name: 'ダメージ+1', desc: '全ての弾のダメージが1増加する',
    icon: '⚔️', rarity: 'rare',
    apply: g => g.upgrades.damage++,
    available: g => g.upgrades.damage < 5,
  },
  {
    id: 'double_shot', name: 'ダブルショット', desc: 'フリックで2発同時に発射',
    icon: '🔫', rarity: 'rare',
    apply: g => g.upgrades.fireCount++,
    available: g => g.upgrades.fireCount < 3,
  },
  {
    id: 'triple_shot', name: 'トリプルショット', desc: '3発同時発射に強化',
    icon: '🔥', rarity: 'epic',
    apply: g => { g.upgrades.fireCount = 3; },
    available: g => g.upgrades.fireCount < 3,
  },
  {
    id: 'spread', name: 'スプレッドショット', desc: 'メイン弾の左右にも弾を追加発射',
    icon: '🎯', rarity: 'epic',
    apply: g => { g.upgrades.spread = true; },
    available: g => !g.upgrades.spread,
  },
  {
    id: 'pierce', name: '貫通弾', desc: '弾が敵を貫通して飛び続ける',
    icon: '🏹', rarity: 'epic',
    apply: g => { g.upgrades.pierce = true; },
    available: g => !g.upgrades.pierce,
  },
  {
    id: 'speed', name: '弾速アップ', desc: '弾の速度が大幅に上昇',
    icon: '⚡', rarity: 'common',
    apply: g => { g.upgrades.speedBonus = Math.min(g.upgrades.speedBonus + 0.4, 1.6); },
    available: g => g.upgrades.speedBonus < 1.6,
  },
  {
    id: 'big_shot', name: 'ビッグショット', desc: '弾が大きくなり当たりやすくなる',
    icon: '💫', rarity: 'common',
    apply: g => { g.upgrades.sizeBonus = Math.min(g.upgrades.sizeBonus + 8, 24); },
    available: g => g.upgrades.sizeBonus < 24,
  },
  {
    id: 'heal', name: 'ライフ回復', desc: 'ライフを1回復する',
    icon: '💊', rarity: 'rare',
    apply: g => { g.lives = Math.min(g.lives + 1, g.maxLives); updateHearts(); },
    available: g => g.lives < g.maxLives,
  },
  {
    id: 'shield', name: 'シールド付与', desc: '次の被弾を1回防ぐシールドを展開',
    icon: '🛡️', rarity: 'common',
    apply: g => { g.shieldActive = true; g.shieldTimer = 9999; },
    available: g => !g.shieldActive,
  },
];

// ── Game globals ──
const game = {
  state: STATE.MENU,
  score: 0,
  bestScore: parseInt(localStorage.getItem('flickstrike_best') || '0'),
  lives: 3,
  maxLives: 3,
  wave: 1,
  combo: 0,
  maxCombo: 0,
  comboTimer: 0,
  comboTimeout: 2.5,
  waveKills: 0,
  waveKillTarget: 10,
  waveTransition: false,
  frameTime: 0,
  lastTime: 0,
  bgStars: [],
  shieldActive: false,
  shieldTimer: 0,
  upgrades: {
    damage: 1,
    fireCount: 1,
    speedBonus: 0,
    sizeBonus: 0,
    spread: false,
    pierce: false,
  },
};

// ── Systems ──
const particles = new ParticleSystem();
const enemies = new EnemyManager();
const projectiles = new ProjectileManager();
let flickDetector;

// ── Player ──
const player = {
  x: 0, y: 0,
  radius: 26,
  pulse: 0,
  shieldRadius: 48,
};

// ── Canvas resize ──
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  player.x = canvas.width / 2;
  player.y = canvas.height / 2;
}
window.addEventListener('resize', resize);
resize();

// ── Background stars ──
function initStars() {
  game.bgStars = [];
  for (let i = 0; i < 80; i++) {
    game.bgStars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.5,
      a: Math.random(),
      speed: 0.2 + Math.random() * 0.5,
    });
  }
}

// ── UI elements ──
const ui = {
  hud: document.getElementById('hud'),
  scoreEl: document.getElementById('score'),
  waveEl: document.getElementById('wave'),
  heartsEl: document.getElementById('lives-hearts'),
  comboDisplay: document.getElementById('combo-display'),
  comboCount: document.getElementById('combo-count'),
  waveAnnounce: document.getElementById('wave-announce'),
  startScreen: document.getElementById('start-screen'),
  pauseScreen: document.getElementById('pause-screen'),
  gameoverScreen: document.getElementById('gameover-screen'),
  upgradeScreen: document.getElementById('upgrade-screen'),
  upgradeCards: document.getElementById('upgrade-cards'),
  upgradeWaveLabel: document.getElementById('upgrade-wave-label'),
  finalScore: document.getElementById('final-score'),
  finalWave: document.getElementById('final-wave'),
  finalCombo: document.getElementById('final-combo'),
  finalBest: document.getElementById('final-best'),
  newRecordRow: document.getElementById('new-record-row'),
  bestScoreDisplay: document.getElementById('best-score-display'),
  bestScoreVal: document.getElementById('best-score'),
};

// ── Damage flash overlay ──
const damageFlash = document.createElement('div');
damageFlash.id = 'damage-flash';
document.body.appendChild(damageFlash);

// ── Score display ──
let scoreDisplayVal = 0;
function updateScoreDisplay() {
  const diff = game.score - scoreDisplayVal;
  if (diff === 0) return;
  scoreDisplayVal += Math.ceil(diff * 0.15);
  if (Math.abs(game.score - scoreDisplayVal) < 5) scoreDisplayVal = game.score;
  ui.scoreEl.textContent = scoreDisplayVal;
}

function updateHearts() {
  ui.heartsEl.innerHTML = '';
  for (let i = 0; i < game.maxLives; i++) {
    const span = document.createElement('span');
    span.textContent = i < game.lives ? '❤️' : '🖤';
    ui.heartsEl.appendChild(span);
  }
}

function showWaveAnnounce(text) {
  ui.waveAnnounce.textContent = text;
  ui.waveAnnounce.classList.remove('hidden');
  setTimeout(() => ui.waveAnnounce.classList.add('hidden'), 2000);
}

// ── Game state transitions ──
function showScreen(name) {
  [ui.startScreen, ui.pauseScreen, ui.gameoverScreen, ui.upgradeScreen].forEach(s => s.classList.add('hidden'));
  ui.hud.classList.add('hidden');
  if (name === 'start') {
    ui.startScreen.classList.remove('hidden');
    if (game.bestScore > 0) {
      ui.bestScoreDisplay.classList.remove('hidden');
      ui.bestScoreVal.textContent = game.bestScore;
    }
  } else if (name === 'hud') {
    ui.hud.classList.remove('hidden');
  } else if (name === 'pause') {
    ui.hud.classList.remove('hidden');
    ui.pauseScreen.classList.remove('hidden');
  } else if (name === 'gameover') {
    ui.gameoverScreen.classList.remove('hidden');
  } else if (name === 'upgrade') {
    ui.hud.classList.remove('hidden');
    ui.upgradeScreen.classList.remove('hidden');
  }
}

function startGame() {
  game.state = STATE.PLAYING;
  game.score = 0;
  scoreDisplayVal = 0;
  game.lives = game.maxLives;
  game.wave = 1;
  game.combo = 0;
  game.maxCombo = 0;
  game.comboTimer = 0;
  game.waveKills = 0;
  game.waveKillTarget = getWaveKillTarget(1);
  game.waveTransition = false;
  game.shieldActive = false;
  game.shieldTimer = 0;
  game.upgrades = { damage: 1, fireCount: 1, speedBonus: 0, sizeBonus: 0, spread: false, pierce: false };

  player.x = canvas.width / 2;
  player.y = canvas.height / 2;

  enemies.setWave(1);
  particles.particles = [];
  projectiles.projectiles = [];

  ui.scoreEl.textContent = '0';
  ui.waveEl.textContent = '1';
  updateHearts();

  showScreen('hud');
  showWaveAnnounce('WAVE 1');
  Audio.waveStart(1);

  game.lastTime = performance.now();
  requestAnimationFrame(loop);
}

function getWaveKillTarget(wave) {
  return 8 + wave * 3;
}

function takeDamage() {
  if (game.shieldActive) {
    game.shieldActive = false;
    game.shieldTimer = 0;
    particles.emitRing(player.x, player.y, { color: '#00d4ff', maxRadius: 80, life: 0.4, lineWidth: 4 });
    return;
  }
  game.lives--;
  game.combo = 0;
  ui.comboDisplay.classList.add('hidden');
  Audio.damage();
  updateHearts();
  particles.emitDamage(player.x, player.y);

  game.shakeTime = 0.3;
  game.shakeIntensity = 12;

  damageFlash.classList.add('active');
  setTimeout(() => damageFlash.classList.remove('active'), 100);

  if (navigator.vibrate) navigator.vibrate([30, 20, 50]);

  if (game.lives <= 0) triggerGameOver();
}

function addScore(pts) {
  const multiplier = 1 + Math.floor(game.combo / 5) * 0.5;
  const actual = Math.round(pts * multiplier);
  game.score += actual;
  return actual;
}

function incrementCombo() {
  game.combo++;
  game.comboTimer = game.comboTimeout;
  if (game.combo > game.maxCombo) game.maxCombo = game.combo;

  if (game.combo >= 3) {
    ui.comboDisplay.classList.remove('hidden');
    ui.comboCount.textContent = game.combo;
    Audio.combo(game.combo);
    if (game.combo % 5 === 0) {
      particles.emitRing(player.x, player.y, { color: '#ffd60a', maxRadius: 70, life: 0.5, lineWidth: 3 });
    }
  }
}

// ── Upgrade system ──
function advanceWave() {
  game.wave++;
  game.waveKills = 0;
  game.waveKillTarget = getWaveKillTarget(game.wave);
  projectiles.projectiles = [];
  ui.waveEl.textContent = game.wave;

  game.state = STATE.UPGRADING;
  showUpgradeScreen();
}

function showUpgradeScreen() {
  ui.upgradeWaveLabel.textContent = `WAVE ${game.wave - 1} CLEAR!`;

  const available = UPGRADE_POOL.filter(u => !u.available || u.available(game));
  // Pick 3 non-duplicate upgrades (weighted: epic rarer)
  const shuffled = [...available].sort(() => Math.random() - 0.5).slice(0, 3);

  ui.upgradeCards.innerHTML = '';
  for (const upg of shuffled) {
    const btn = document.createElement('button');
    btn.className = `upgrade-card rarity-${upg.rarity}`;
    btn.innerHTML = `
      <span class="upgrade-icon">${upg.icon}</span>
      <div class="upgrade-info">
        <div class="upgrade-name">${upg.name}</div>
        <div class="upgrade-desc">${upg.desc}</div>
      </div>
      <span class="upgrade-rarity-badge rarity-${upg.rarity}">${
        upg.rarity === 'epic' ? 'EPIC' : upg.rarity === 'rare' ? 'RARE' : 'COM'
      }</span>
    `;
    btn.addEventListener('click', () => selectUpgrade(upg));
    ui.upgradeCards.appendChild(btn);
  }

  showScreen('upgrade');
}

function selectUpgrade(upg) {
  upg.apply(game);
  Audio.unlock();
  particles.emitRing(player.x, player.y, { color: '#ffd60a', maxRadius: 80, life: 0.5, lineWidth: 4 });
  particles.emit(player.x, player.y, { count: 15, color: '#ffd60a', speed: 5, size: 5, life: 0.6 });

  enemies.setWave(game.wave);
  game.state = STATE.PLAYING;
  showScreen('hud');
  showWaveAnnounce(`WAVE ${game.wave}${game.wave % 5 === 0 ? ' ⚠️ BOSS' : ''}`);
  Audio.waveStart(game.wave);

  game.lastTime = performance.now();
  requestAnimationFrame(loop);
}

function triggerGameOver() {
  game.state = STATE.GAMEOVER;
  Audio.gameOver();

  const isNewRecord = game.score > game.bestScore;
  if (isNewRecord) {
    game.bestScore = game.score;
    localStorage.setItem('flickstrike_best', game.bestScore);
  }

  ui.finalScore.textContent = game.score;
  ui.finalWave.textContent = game.wave;
  ui.finalCombo.textContent = game.maxCombo;
  ui.finalBest.textContent = game.bestScore;
  ui.newRecordRow.style.display = isNewRecord ? 'flex' : 'none';

  showScreen('gameover');
}

// ── Flick handler ──
function handleFlick(angle, speed, startX, startY) {
  if (game.state !== STATE.PLAYING) return;
  Audio.flick();

  const spd = Math.min(speed, 15) + game.upgrades.speedBonus;
  const opts = {
    damage: game.upgrades.damage,
    sizeBonus: game.upgrades.sizeBonus,
    pierce: game.upgrades.pierce,
  };

  // Main shot(s)
  for (let i = 0; i < game.upgrades.fireCount; i++) {
    const offset = i === 0 ? 0 : (i % 2 === 1 ? 1 : -1) * 0.12 * Math.ceil(i / 2);
    projectiles.fire(player.x, player.y, angle + offset, spd, opts);
  }

  // Spread side shots (slightly weaker)
  if (game.upgrades.spread) {
    const sideOpts = { ...opts, damage: Math.max(1, opts.damage - 1) };
    projectiles.fire(player.x, player.y, angle + 0.4, spd * 0.85, sideOpts);
    projectiles.fire(player.x, player.y, angle - 0.4, spd * 0.85, sideOpts);
  }

  particles.emitTrail(startX, startY, '#00d4ff', 5);
  particles.emit(player.x, player.y, {
    count: 5 + game.upgrades.fireCount,
    color: '#00d4ff',
    speed: 4,
    spreadAngle: Math.PI * 0.4,
    dirAngle: angle,
    size: 4,
    life: 0.3,
  });
}

// ── Camera shake ──
function applyCameraShake(dt) {
  if (!game.shakeTime) return;
  game.shakeTime -= dt;
  if (game.shakeTime <= 0) { game.shakeTime = 0; return; }
  const intensity = game.shakeIntensity * (game.shakeTime / 0.3);
  ctx.translate(
    (Math.random() - 0.5) * intensity,
    (Math.random() - 0.5) * intensity
  );
}

// ── Draw background ──
function drawBackground(dt) {
  ctx.fillStyle = '#0a0a1a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (const star of game.bgStars) {
    star.a += dt * star.speed;
    const alpha = (Math.sin(star.a) * 0.5 + 0.5) * 0.6 + 0.1;
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();
  }

  const cx = canvas.width / 2, cy = canvas.height / 2;
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(canvas.width, canvas.height) * 0.5);
  grad.addColorStop(0, 'rgba(0,100,180,0.06)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const closest = getClosestEnemyDist();
  if (closest < 200) {
    const danger = 1 - closest / 200;
    const ringGrad = ctx.createRadialGradient(cx, cy, player.radius + 20, cx, cy, player.radius + 80);
    ringGrad.addColorStop(0, `rgba(255,45,85,${danger * 0.15})`);
    ringGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = ringGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

function getClosestEnemyDist() {
  let min = Infinity;
  for (const e of enemies.enemies) {
    const dx = e.x - player.x, dy = e.y - player.y;
    min = Math.min(min, Math.sqrt(dx * dx + dy * dy));
  }
  return min;
}

// ── Proximity radar: always-visible enemy direction indicators ──
function drawProximityRadar() {
  const cx = player.x, cy = player.y;
  const radarR = player.radius + 55; // ring just outside player glow
  const w = canvas.width, h = canvas.height;
  const margin = 26;

  for (const e of enemies.enemies) {
    const dx = e.x - cx, dy = e.y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);

    // ── Proximity dot on the radar ring (always visible) ──
    const dotX = cx + Math.cos(angle) * radarR;
    const dotY = cy + Math.sin(angle) * radarR;
    const proximity = Math.max(0, 1 - dist / 320);
    const dotAlpha = 0.3 + proximity * 0.65;
    const dotSize = 3.5 + proximity * 4.5;

    ctx.save();
    ctx.globalAlpha = dotAlpha;
    ctx.fillStyle = e.color;
    ctx.shadowColor = e.color;
    ctx.shadowBlur = dotSize * 2.5;
    ctx.beginPath();
    ctx.arc(dotX, dotY, dotSize, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // ── Edge arrow for off-screen enemies ──
    const halfW = w / 2 - margin, halfH = h / 2 - margin;
    const absDx = Math.abs(dx), absDy = Math.abs(dy);
    if (absDx === 0 && absDy === 0) continue;
    const scaleX = absDx > 0 ? halfW / absDx : Infinity;
    const scaleY = absDy > 0 ? halfH / absDy : Infinity;
    const edgeScale = Math.min(scaleX, scaleY);

    if (edgeScale < 1) {
      const ex = cx + dx * edgeScale;
      const ey = cy + dy * edgeScale;
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(angle);
      ctx.globalAlpha = 0.75;
      ctx.fillStyle = e.color;
      ctx.shadowColor = e.color;
      ctx.shadowBlur = 12;
      const s = 8;
      ctx.beginPath();
      ctx.moveTo(s + 2, 0);
      ctx.lineTo(-s, -s * 0.65);
      ctx.lineTo(-s, s * 0.65);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
}

// ── Draw player ──
function drawPlayer() {
  const { x, y, radius } = player;
  player.pulse = (player.pulse || 0) + 0.04;
  const scale = 1 + Math.sin(player.pulse) * 0.04;

  ctx.save();
  ctx.translate(x, y);

  if (game.shieldActive) {
    const shieldAlpha = 0.3 + Math.sin(player.pulse * 3) * 0.2;
    ctx.strokeStyle = `rgba(0,212,255,${shieldAlpha})`;
    ctx.lineWidth = 3;
    ctx.shadowColor = '#00d4ff';
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(0, 0, player.shieldRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = `rgba(0,212,255,${shieldAlpha * 0.15})`;
    ctx.fill();
  }

  ctx.strokeStyle = 'rgba(0,212,255,0.3)';
  ctx.lineWidth = 2;
  ctx.shadowColor = '#00d4ff';
  ctx.shadowBlur = 15;
  ctx.beginPath();
  ctx.arc(0, 0, radius * scale * 1.4, 0, Math.PI * 2);
  ctx.stroke();

  const grad = ctx.createRadialGradient(-4, -4, 2, 0, 0, radius * scale);
  grad.addColorStop(0, '#80e8ff');
  grad.addColorStop(0.5, '#00d4ff');
  grad.addColorStop(1, '#0060ff');
  ctx.fillStyle = grad;
  ctx.shadowColor = '#00d4ff';
  ctx.shadowBlur = 25;
  ctx.beginPath();
  ctx.arc(0, 0, radius * scale, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(-4, -4, radius * 0.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ── Draw flick indicator ──
function drawFlickHint() {
  if (!flickDetector) return;
  const touches = flickDetector.getActiveTouches();
  for (const t of touches) {
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = '#00d4ff';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(t.startX, t.startY);
    ctx.lineTo(t.x || t.startX, t.y || t.startY);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.strokeStyle = '#00d4ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(t.startX, t.startY, 20, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

// ── Draw wave progress ──
function drawWaveProgress() {
  const w = canvas.width;
  const barW = Math.min(200, w * 0.4);
  const barH = 4;
  const bx = w / 2 - barW / 2;
  const by = 72;
  const pct = Math.min(1, game.waveKills / game.waveKillTarget);

  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.fillRect(bx, by, barW, barH);

  const barGrad = ctx.createLinearGradient(bx, 0, bx + barW, 0);
  barGrad.addColorStop(0, '#00d4ff');
  barGrad.addColorStop(1, '#0080ff');
  ctx.fillStyle = barGrad;
  ctx.shadowColor = '#00d4ff';
  ctx.shadowBlur = 6;
  ctx.fillRect(bx, by, barW * pct, barH);
  ctx.restore();
}

// ── Draw active upgrade icons ──
function drawUpgradeIcons() {
  const icons = [];
  if (game.upgrades.damage > 1) icons.push({ icon: '⚔️', label: `×${game.upgrades.damage}` });
  if (game.upgrades.fireCount > 1) icons.push({ icon: '🔫', label: `×${game.upgrades.fireCount}` });
  if (game.upgrades.spread) icons.push({ icon: '🎯', label: '' });
  if (game.upgrades.pierce) icons.push({ icon: '🏹', label: '' });
  if (game.upgrades.speedBonus > 0) icons.push({ icon: '⚡', label: '' });
  if (game.upgrades.sizeBonus > 0) icons.push({ icon: '💫', label: '' });
  if (game.shieldActive) icons.push({ icon: '🛡️', label: '' });
  if (!icons.length) return;

  const iconSize = 18;
  const gap = 4;
  const totalW = icons.length * (iconSize + gap) - gap;
  let x = canvas.width / 2 - totalW / 2;
  const y = canvas.height - 28 - (window.visualViewport?.offsetTop || 0);

  ctx.save();
  ctx.font = `${iconSize}px sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  for (const item of icons) {
    ctx.globalAlpha = 0.85;
    ctx.fillText(item.icon, x, y);
    if (item.label) {
      ctx.globalAlpha = 0.9;
      ctx.font = 'bold 10px sans-serif';
      ctx.fillStyle = '#ffd60a';
      ctx.fillText(item.label, x + iconSize - 2, y + 6);
      ctx.font = `${iconSize}px sans-serif`;
    }
    x += iconSize + gap;
  }
  ctx.restore();
}

// ── Main game loop ──
function loop(timestamp) {
  if (game.state !== STATE.PLAYING) return;

  const dt = Math.min((timestamp - game.lastTime) / 1000, 0.05);
  game.lastTime = timestamp;

  ctx.save();
  applyCameraShake(dt);

  update(dt);

  drawBackground(dt);
  drawFlickHint();
  particles.draw(ctx);
  projectiles.draw(ctx);
  enemies.draw(ctx);
  drawPlayer();
  drawProximityRadar();
  drawWaveProgress();
  drawUpgradeIcons();

  ctx.restore();

  updateScoreDisplay();

  requestAnimationFrame(loop);
}

function update(dt) {
  if (game.shieldActive && game.shieldTimer < 9999) {
    game.shieldTimer -= dt;
    if (game.shieldTimer <= 0) game.shieldActive = false;
  }

  if (game.combo > 0) {
    game.comboTimer -= dt;
    if (game.comboTimer <= 0) {
      game.combo = 0;
      ui.comboDisplay.classList.add('hidden');
    }
  }

  particles.update(dt);
  projectiles.update(dt, canvas.width, canvas.height);

  const hits = enemies.checkProjectileHits(projectiles.active, particles);
  for (const hit of hits) {
    if (hit.killed) {
      const pts = addScore(hit.enemy.score);
      game.waveKills++;
      incrementCombo();
      particles.emitScore(hit.enemy.x, hit.enemy.y - hit.enemy.radius - 10, `+${pts}`, '#ffd60a');
      Audio.enemyDeath();
    } else {
      Audio.hit();
    }
  }

  const reached = enemies.update(dt, canvas.width, canvas.height, player.radius + (game.shieldActive ? player.shieldRadius - player.radius : 0));
  if (reached.length > 0) takeDamage();

  if (!game.waveTransition && game.waveKills >= game.waveKillTarget) {
    game.waveTransition = true;
    setTimeout(() => {
      game.waveTransition = false;
      advanceWave();
    }, 800);
  }
}

// ── Button bindings ──
document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('retry-btn').addEventListener('click', startGame);
document.getElementById('title-btn').addEventListener('click', () => { game.state = STATE.MENU; showScreen('start'); });
document.getElementById('quit-btn').addEventListener('click', () => { game.state = STATE.MENU; showScreen('start'); });
document.getElementById('resume-btn').addEventListener('click', () => {
  game.state = STATE.PLAYING;
  game.lastTime = performance.now();
  showScreen('hud');
  requestAnimationFrame(loop);
});
document.getElementById('pause-btn').addEventListener('click', () => {
  if (game.state === STATE.PLAYING) {
    game.state = STATE.PAUSED;
    showScreen('pause');
  }
});

// ── Init ──
initStars();
showScreen('start');

window.addEventListener('load', () => {
  flickDetector = new FlickDetector(canvas);
  flickDetector.onFlick = handleFlick;
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
