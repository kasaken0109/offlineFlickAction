// Main game engine
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game states
const STATE = { MENU: 'menu', PLAYING: 'playing', PAUSED: 'paused', GAMEOVER: 'gameover' };

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
  flickPower: 1,
  powerups: [],
  bgStars: [],
  shieldActive: false,
  shieldTimer: 0,
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
  hitFlash: 0,
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
  [ui.startScreen, ui.pauseScreen, ui.gameoverScreen].forEach(s => s.classList.add('hidden'));
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
  game.powerups = [];
  game.shieldActive = false;

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

  // Camera shake
  game.shakeTime = 0.3;
  game.shakeIntensity = 12;

  // Damage flash
  damageFlash.classList.add('active');
  setTimeout(() => damageFlash.classList.remove('active'), 100);

  // Haptic feedback
  if (navigator.vibrate) navigator.vibrate([30, 20, 50]);

  if (game.lives <= 0) {
    triggerGameOver();
  }
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

function advanceWave() {
  game.wave++;
  game.waveKills = 0;
  game.waveKillTarget = getWaveKillTarget(game.wave);
  enemies.setWave(game.wave);
  projectiles.projectiles = [];

  ui.waveEl.textContent = game.wave;
  showWaveAnnounce(`WAVE ${game.wave}${game.wave % 5 === 0 ? ' ⚠️ BOSS' : ''}`);
  Audio.waveStart(game.wave);

  // Grant power-up every few waves
  if (game.wave % 3 === 0) grantShield();
}

function grantShield() {
  game.shieldActive = true;
  game.shieldTimer = 8;
  Audio.unlock();
  particles.emitRing(player.x, player.y, { color: '#00d4ff', maxRadius: 60, life: 0.5, lineWidth: 3 });
  particles.emitScore(player.x, player.y - 50, 'SHIELD!', '#00d4ff');
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
  projectiles.fire(player.x, player.y, angle, Math.min(speed, 15));
  // Spawn trail at start point toward player
  particles.emitTrail(startX, startY, '#00d4ff', 5);
  particles.emit(player.x, player.y, {
    count: 5,
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

  // Animated stars
  for (const star of game.bgStars) {
    star.a += dt * star.speed;
    const alpha = (Math.sin(star.a) * 0.5 + 0.5) * 0.6 + 0.1;
    ctx.fillStyle = `rgba(255,255,255,${alpha})`;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Radial glow from center
  const cx = canvas.width / 2, cy = canvas.height / 2;
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(canvas.width, canvas.height) * 0.5);
  grad.addColorStop(0, 'rgba(0,100,180,0.06)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Danger rings when enemies are close
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

// ── Draw player ──
function drawPlayer() {
  const { x, y, radius } = player;
  player.pulse = (player.pulse || 0) + 0.04;
  const scale = 1 + Math.sin(player.pulse) * 0.04;

  ctx.save();
  ctx.translate(x, y);

  // Shield
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

  // Outer glow ring
  ctx.strokeStyle = 'rgba(0,212,255,0.3)';
  ctx.lineWidth = 2;
  ctx.shadowColor = '#00d4ff';
  ctx.shadowBlur = 15;
  ctx.beginPath();
  ctx.arc(0, 0, radius * scale * 1.4, 0, Math.PI * 2);
  ctx.stroke();

  // Main body
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

  // Inner core
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

    // Touch start indicator
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

// ── Main game loop ──
function loop(timestamp) {
  if (game.state !== STATE.PLAYING) return;

  const dt = Math.min((timestamp - game.lastTime) / 1000, 0.05);
  game.lastTime = timestamp;

  ctx.save();
  applyCameraShake(dt);

  // Update
  update(dt);

  // Draw
  drawBackground(dt);
  drawFlickHint();
  particles.draw(ctx);
  projectiles.draw(ctx);
  enemies.draw(ctx);
  drawPlayer();
  drawWaveProgress();

  ctx.restore();

  updateScoreDisplay();

  requestAnimationFrame(loop);
}

function update(dt) {
  // Shield timer
  if (game.shieldActive) {
    game.shieldTimer -= dt;
    if (game.shieldTimer <= 0) game.shieldActive = false;
  }

  // Combo timeout
  if (game.combo > 0) {
    game.comboTimer -= dt;
    if (game.comboTimer <= 0) {
      game.combo = 0;
      ui.comboDisplay.classList.add('hidden');
    }
  }

  // Particles
  particles.update(dt);

  // Projectiles
  projectiles.update(dt, canvas.width, canvas.height);

  // Check projectile-enemy hits
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

  // Enemies reaching player
  const reached = enemies.update(dt, canvas.width, canvas.height, player.radius + (game.shieldActive ? player.shieldRadius - player.radius : 0));
  if (reached.length > 0) {
    takeDamage();
  }

  // Wave progression
  if (!game.waveTransition && game.waveKills >= game.waveKillTarget) {
    game.waveTransition = true;
    setTimeout(() => {
      game.waveTransition = false;
      advanceWave();
    }, 1000);
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

// Register flick detector after DOM is ready
window.addEventListener('load', () => {
  flickDetector = new FlickDetector(canvas);
  flickDetector.onFlick = handleFlick;
});

// ── Service Worker registration ──
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
