/* Shadow Crawl — dark side-scrolling action prototype */
(() => {
'use strict';

// ============ Setup ============
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const startBtn = document.getElementById('start-btn');
const hpBar = document.getElementById('hp-bar');
const hpText = document.getElementById('hp-text');
const distEl = document.getElementById('distance');
const killsEl = document.getElementById('kills');
const weaponBtn = document.getElementById('weapon-btn');
const weaponIcon = document.getElementById('weapon-icon');
const weaponName = document.getElementById('weapon-name');
const attackBtn = document.getElementById('attack-btn');
const joyZone = document.getElementById('joy-zone');
const joyBase = document.getElementById('joy-base');
const joyStick = document.getElementById('joy-stick');

let W = 0, H = 0;
const DPR = Math.min(window.devicePixelRatio || 1, 2);

// Walkable depth band (top-down-ish in side-view perspective)
let bandTop = 0, bandBot = 0;

function resize() {
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  bandTop = H * 0.55;
  bandBot = H * 0.92;
}
window.addEventListener('resize', resize);
resize();

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist2 = (ax, ay, bx, by) => (ax-bx)*(ax-bx) + (ay-by)*(ay-by);

// ============ Input ============
const input = {
  move: { x: 0, y: 0 },
  attack: false,
  attackPressed: false,
  switchWeapon: false,
  keys: new Set(),
};

// Keyboard
window.addEventListener('keydown', e => {
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
  if (!game.running && (e.code === 'Space' || e.code === 'Enter')) { startGame(); return; }
  input.keys.add(e.code);
  if (e.code === 'Space') { input.attack = true; input.attackPressed = true; }
  if (e.code === 'KeyQ' || e.code === 'Tab') { input.switchWeapon = true; e.preventDefault(); }
});
window.addEventListener('keyup', e => {
  input.keys.delete(e.code);
  if (e.code === 'Space') input.attack = false;
});

function readKeyboardMove() {
  let x = 0, y = 0;
  if (input.keys.has('ArrowLeft') || input.keys.has('KeyA')) x -= 1;
  if (input.keys.has('ArrowRight') || input.keys.has('KeyD')) x += 1;
  if (input.keys.has('ArrowUp') || input.keys.has('KeyW')) y -= 1;
  if (input.keys.has('ArrowDown') || input.keys.has('KeyS')) y += 1;
  if (x || y) {
    const m = Math.hypot(x, y) || 1;
    return { x: x / m, y: y / m };
  }
  return null;
}

// Virtual joystick
let joyTouchId = null;
const joyCenter = { x: 0, y: 0 };
const JOY_RADIUS = 55;

function joyStart(e) {
  const t = e.changedTouches ? e.changedTouches[0] : e;
  if (joyTouchId !== null) return;
  joyTouchId = e.changedTouches ? t.identifier : 'mouse';
  const rect = joyZone.getBoundingClientRect();
  // place base at touch start
  const x = t.clientX - rect.left;
  const y = t.clientY - rect.top;
  joyBase.style.left = (x - 55) + 'px';
  joyBase.style.bottom = (rect.height - y - 55) + 'px';
  joyCenter.x = t.clientX;
  joyCenter.y = t.clientY;
  joyMove(e);
}

function joyMove(e) {
  if (joyTouchId === null) return;
  let t;
  if (e.changedTouches) {
    for (const ch of e.changedTouches) if (ch.identifier === joyTouchId) { t = ch; break; }
    if (!t) return;
  } else {
    t = e;
  }
  const dx = t.clientX - joyCenter.x;
  const dy = t.clientY - joyCenter.y;
  const d = Math.hypot(dx, dy);
  const k = d > JOY_RADIUS ? JOY_RADIUS / d : 1;
  const sx = dx * k, sy = dy * k;
  joyStick.style.transform = `translate(calc(-50% + ${sx}px), calc(-50% + ${sy}px))`;
  const mag = Math.min(d / JOY_RADIUS, 1);
  if (mag < 0.15) {
    input.move.x = 0; input.move.y = 0;
  } else {
    input.move.x = (dx / (d || 1)) * mag;
    input.move.y = (dy / (d || 1)) * mag;
  }
}

function joyEnd(e) {
  if (joyTouchId === null) return;
  if (e.changedTouches) {
    let found = false;
    for (const ch of e.changedTouches) if (ch.identifier === joyTouchId) { found = true; break; }
    if (!found) return;
  }
  joyTouchId = null;
  joyStick.style.transform = `translate(-50%, -50%)`;
  input.move.x = 0; input.move.y = 0;
}

joyZone.addEventListener('touchstart', e => { e.preventDefault(); joyStart(e); }, { passive: false });
joyZone.addEventListener('touchmove', e => { e.preventDefault(); joyMove(e); }, { passive: false });
joyZone.addEventListener('touchend', e => { e.preventDefault(); joyEnd(e); }, { passive: false });
joyZone.addEventListener('touchcancel', e => { e.preventDefault(); joyEnd(e); }, { passive: false });
joyZone.addEventListener('mousedown', e => { e.preventDefault(); joyStart(e); });
window.addEventListener('mousemove', e => joyMove(e));
window.addEventListener('mouseup', e => joyEnd(e));

// Action buttons
function addPress(el, onDown, onUp) {
  el.addEventListener('touchstart', e => { e.preventDefault(); onDown(); }, { passive: false });
  el.addEventListener('touchend',   e => { e.preventDefault(); if (onUp) onUp(); }, { passive: false });
  el.addEventListener('mousedown',  e => { e.preventDefault(); onDown(); });
  el.addEventListener('mouseup',    e => { e.preventDefault(); if (onUp) onUp(); });
  el.addEventListener('mouseleave', () => { if (onUp) onUp(); });
}

addPress(attackBtn,
  () => { input.attack = true; input.attackPressed = true; },
  () => { input.attack = false; }
);
addPress(weaponBtn,
  () => { input.switchWeapon = true; },
  null
);

// ============ Weapons ============
const WEAPONS = [
  {
    id: 'sword',
    name: 'Épée',
    icon: '⚔',
    cooldown: 0.32,
    range: 70,
    arc: Math.PI * 0.7,
    damage: 25,
    knockback: 80,
    color: '#d8d4c0',
    swingTime: 0.18,
    type: 'melee',
  },
  {
    id: 'bow',
    name: 'Arc',
    icon: '🏹',
    cooldown: 0.55,
    damage: 22,
    knockback: 50,
    color: '#a08660',
    swingTime: 0.12,
    type: 'ranged',
    projectileSpeed: 720,
  },
  {
    id: 'hammer',
    name: 'Marteau',
    icon: '🔨',
    cooldown: 0.95,
    range: 85,
    arc: Math.PI * 1.0,
    damage: 65,
    knockback: 200,
    color: '#7a5a3a',
    swingTime: 0.32,
    type: 'melee',
  },
];

// ============ Game state ============
const game = {
  running: false,
  t: 0,
  player: null,
  enemies: [],
  projectiles: [],
  particles: [],
  damageNums: [],
  cameraX: 0,
  spawnTimer: 0,
  kills: 0,
  weaponIndex: 0,
  shake: 0,
};

// ============ Player ============
function makePlayer() {
  return {
    x: 200,                // world x
    y: (bandTop + bandBot) / 2,
    w: 36, h: 56,
    speed: 220,
    facing: 1,
    hp: 100, maxHp: 100,
    attackTimer: 0,
    swingTimer: 0,
    swingDir: 1,           // 1 = right, -1 = left
    invuln: 0,
    flash: 0,
  };
}

function attackPlayer() {
  const p = game.player;
  const w = WEAPONS[game.weaponIndex];
  if (p.attackTimer > 0) return;
  p.attackTimer = w.cooldown;
  p.swingTimer = w.swingTime;
  p.swingDir = p.facing;

  if (w.type === 'melee') {
    // Hit all enemies in arc
    for (const e of game.enemies) {
      if (e.dead) continue;
      const dx = (e.x - p.x) * p.facing; // require enemy in front
      if (dx < 0) continue;
      const cx = p.x + p.facing * (w.range * 0.4);
      const cy = p.y;
      const ddx = e.x - cx, ddy = e.y - cy;
      if (ddx*ddx + ddy*ddy < (w.range + e.r) * (w.range + e.r)) {
        damageEnemy(e, w.damage, p.facing * w.knockback);
      }
    }
    spawnSwingParticles(p, w);
    game.shake = Math.max(game.shake, w.id === 'hammer' ? 14 : 5);
  } else if (w.type === 'ranged') {
    game.projectiles.push({
      x: p.x + p.facing * 22,
      y: p.y - 6,
      vx: p.facing * w.projectileSpeed,
      vy: 0,
      damage: w.damage,
      knockback: w.knockback,
      life: 1.4,
      friendly: true,
      kind: 'arrow',
    });
    game.shake = Math.max(game.shake, 3);
  }
}

function spawnSwingParticles(p, w) {
  const n = w.id === 'hammer' ? 14 : 8;
  for (let i = 0; i < n; i++) {
    const a = rand(-0.6, 0.6);
    const sp = rand(120, 280);
    game.particles.push({
      x: p.x + p.facing * w.range * 0.5,
      y: p.y - 10 + rand(-12, 12),
      vx: p.facing * Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 60,
      life: 0.35, maxLife: 0.35,
      color: w.color,
      size: 2 + Math.random() * 2,
    });
  }
}

// ============ Enemies ============
const ENEMY_TYPES = {
  skeleton: {
    w: 32, h: 52, r: 22,
    hp: 50, speed: 95, damage: 10,
    color: '#c8c0b0', accent: '#5a3a3a',
    score: 1,
    contactCooldown: 0.8,
  },
  bat: {
    w: 28, h: 24, r: 18,
    hp: 22, speed: 160, damage: 6,
    color: '#3a2a4a', accent: '#7a3a8a',
    score: 1,
    contactCooldown: 0.6,
    flying: true,
  },
  brute: {
    w: 50, h: 70, r: 32,
    hp: 140, speed: 70, damage: 22,
    color: '#5a2a2a', accent: '#3a1010',
    score: 3,
    contactCooldown: 1.0,
  },
};

function spawnEnemy(typeId, x, y) {
  const t = ENEMY_TYPES[typeId];
  return {
    typeId, type: t,
    x, y,
    w: t.w, h: t.h, r: t.r,
    hp: t.hp, maxHp: t.hp,
    speed: t.speed,
    vx: 0, vy: 0,
    knockback: 0,
    knockbackDir: 0,
    flash: 0,
    contactTimer: 0,
    bobble: Math.random() * Math.PI * 2,
    dead: false,
    deathTimer: 0,
  };
}

function spawnWave() {
  const camRight = game.cameraX + W + 80;
  const r = Math.random();
  if (r < 0.55) {
    spawnAt('skeleton', camRight + rand(20, 200));
    if (Math.random() < 0.3) spawnAt('skeleton', camRight + rand(220, 380));
  } else if (r < 0.85) {
    const n = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) spawnAt('bat', camRight + rand(20, 250));
  } else {
    spawnAt('brute', camRight + rand(40, 200));
    if (Math.random() < 0.4) spawnAt('skeleton', camRight + rand(60, 220));
  }
}

function spawnAt(id, x) {
  const t = ENEMY_TYPES[id];
  const y = t.flying
    ? rand(bandTop - 40, bandBot - 60)
    : rand(bandTop + 10, bandBot - 10);
  game.enemies.push(spawnEnemy(id, x, y));
}

function damageEnemy(e, dmg, knockback) {
  e.hp -= dmg;
  e.flash = 0.15;
  e.knockback = Math.abs(knockback);
  e.knockbackDir = Math.sign(knockback) || 1;
  game.damageNums.push({
    x: e.x, y: e.y - e.h * 0.6,
    vy: -60,
    text: '' + Math.round(dmg),
    life: 0.7, maxLife: 0.7,
    color: dmg >= 50 ? '#ffcc40' : '#ff7070',
  });
  if (e.hp <= 0 && !e.dead) {
    e.dead = true;
    e.deathTimer = 0.4;
    game.kills += e.type.score;
    killsEl.textContent = game.kills + ' kills';
    spawnDeathParticles(e);
  }
}

function spawnDeathParticles(e) {
  for (let i = 0; i < 16; i++) {
    const a = rand(0, Math.PI * 2);
    const sp = rand(80, 240);
    game.particles.push({
      x: e.x, y: e.y - e.h * 0.3,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 0.6, maxLife: 0.6,
      color: i % 3 === 0 ? '#aa1010' : e.type.accent,
      size: 2 + Math.random() * 2,
    });
  }
}

function damagePlayer(amount) {
  const p = game.player;
  if (p.invuln > 0) return;
  p.hp -= amount;
  p.invuln = 0.7;
  p.flash = 0.25;
  game.shake = Math.max(game.shake, 10);
  hpBar.style.width = clamp((p.hp / p.maxHp) * 100, 0, 100) + '%';
  hpText.textContent = Math.max(0, Math.round(p.hp)) + '/' + p.maxHp;
  if (p.hp <= 0) gameOver();
}

// ============ Main loop ============
let lastT = 0;
function loop(t) {
  const dt = Math.min(0.033, (t - lastT) / 1000);
  lastT = t;
  game.t += dt;

  if (game.running) update(dt);
  render(dt);

  requestAnimationFrame(loop);
}

function update(dt) {
  const p = game.player;

  // Weapon switch
  if (input.switchWeapon) {
    input.switchWeapon = false;
    game.weaponIndex = (game.weaponIndex + 1) % WEAPONS.length;
    updateWeaponUI();
  }

  // Movement
  let mx = input.move.x, my = input.move.y;
  const kb = readKeyboardMove();
  if (kb) { mx = kb.x; my = kb.y; }

  p.x += mx * p.speed * dt;
  p.y += my * p.speed * dt * 0.85;
  p.y = clamp(p.y, bandTop, bandBot);
  if (mx > 0.05) p.facing = 1;
  else if (mx < -0.05) p.facing = -1;

  // Camera follows player but never goes back
  const targetCam = p.x - W * 0.35;
  game.cameraX = Math.max(game.cameraX, targetCam);
  // distance = how far cameraX has progressed from initial
  const distance = Math.floor(game.cameraX / 50);
  distEl.textContent = distance + ' m';

  // Prevent walking off-screen left
  const leftEdge = game.cameraX + 30;
  if (p.x < leftEdge) p.x = leftEdge;

  // Attack
  if (input.attack) attackPlayer();
  input.attackPressed = false;

  if (p.attackTimer > 0) p.attackTimer -= dt;
  if (p.swingTimer > 0) p.swingTimer -= dt;
  if (p.invuln > 0) p.invuln -= dt;
  if (p.flash > 0) p.flash -= dt;

  // Spawning
  game.spawnTimer -= dt;
  if (game.spawnTimer <= 0) {
    spawnWave();
    game.spawnTimer = rand(1.6, 2.8) - Math.min(1.0, distance / 600);
  }

  // Enemies
  for (const e of game.enemies) {
    if (e.dead) { e.deathTimer -= dt; continue; }
    if (e.flash > 0) e.flash -= dt;
    if (e.contactTimer > 0) e.contactTimer -= dt;
    e.bobble += dt * (e.type.flying ? 6 : 3);

    // Knockback overrides movement briefly
    if (e.knockback > 0) {
      e.x += e.knockbackDir * e.knockback * dt * 6;
      e.knockback -= e.knockback * dt * 8 + 30 * dt;
      if (e.knockback < 5) e.knockback = 0;
    } else {
      // Move toward player
      const dx = p.x - e.x, dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      const sp = e.speed;
      e.x += (dx / d) * sp * dt;
      e.y += (dy / d) * sp * dt * 0.75;
      if (!e.type.flying) e.y = clamp(e.y, bandTop, bandBot);
    }

    // Contact damage
    const ddx = p.x - e.x, ddy = p.y - e.y;
    if (ddx*ddx + ddy*ddy < (e.r + 18) * (e.r + 18) && e.contactTimer <= 0) {
      damagePlayer(e.type.damage);
      e.contactTimer = e.type.contactCooldown;
    }
  }
  // Cleanup
  game.enemies = game.enemies.filter(e =>
    !(e.dead && e.deathTimer <= 0) &&
    e.x > game.cameraX - 200
  );

  // Projectiles
  for (const pr of game.projectiles) {
    pr.x += pr.vx * dt;
    pr.y += pr.vy * dt;
    pr.life -= dt;
    if (pr.friendly) {
      for (const e of game.enemies) {
        if (e.dead) continue;
        const dx = e.x - pr.x, dy = e.y - pr.y;
        if (dx*dx + dy*dy < (e.r + 6) * (e.r + 6)) {
          damageEnemy(e, pr.damage, Math.sign(pr.vx) * pr.knockback);
          pr.life = 0;
          break;
        }
      }
    }
  }
  game.projectiles = game.projectiles.filter(pr => pr.life > 0);

  // Particles
  for (const pa of game.particles) {
    pa.x += pa.vx * dt;
    pa.y += pa.vy * dt;
    pa.vy += 600 * dt;
    pa.life -= dt;
  }
  game.particles = game.particles.filter(pa => pa.life > 0);

  // Damage numbers
  for (const dn of game.damageNums) {
    dn.y += dn.vy * dt;
    dn.vy += 80 * dt;
    dn.life -= dt;
  }
  game.damageNums = game.damageNums.filter(dn => dn.life > 0);

  // Shake decay
  if (game.shake > 0) game.shake = Math.max(0, game.shake - dt * 40);
}

// ============ Render ============
function render(dt) {
  ctx.clearRect(0, 0, W, H);

  // shake offset
  const sx = (Math.random() - 0.5) * game.shake;
  const sy = (Math.random() - 0.5) * game.shake;
  ctx.save();
  ctx.translate(sx, sy);

  drawBackground(dt);
  drawGround();

  // Sort entities by Y for pseudo-depth
  const all = [];
  for (const e of game.enemies) all.push({ y: e.y, draw: () => drawEnemy(e) });
  all.push({ y: game.player.y, draw: () => drawPlayer() });
  all.sort((a, b) => a.y - b.y);
  for (const item of all) item.draw();

  drawProjectiles();
  drawParticles();
  drawDamageNums();
  drawTorchOverlay();

  ctx.restore();
}

// World coords -> screen
const sX = wx => wx - game.cameraX;

function drawBackground(dt) {
  // Far cave wall (parallax)
  const farOff = (game.cameraX * 0.2) % 240;
  ctx.fillStyle = '#0c0c14';
  ctx.fillRect(0, 0, W, bandTop);
  // Cracks
  ctx.strokeStyle = 'rgba(60, 50, 70, 0.35)';
  ctx.lineWidth = 1;
  for (let i = -1; i < W / 240 + 1; i++) {
    const x = i * 240 - farOff;
    ctx.beginPath();
    ctx.moveTo(x + 30, bandTop * 0.2);
    ctx.lineTo(x + 60, bandTop * 0.5);
    ctx.lineTo(x + 40, bandTop * 0.7);
    ctx.stroke();
  }
  // Pillars (mid)
  const midOff = (game.cameraX * 0.5) % 360;
  for (let i = -1; i < W / 360 + 2; i++) {
    const x = i * 360 - midOff;
    drawPillar(x, bandTop - 50);
  }
}

function drawPillar(x, baseY) {
  const grad = ctx.createLinearGradient(x, 0, x + 50, 0);
  grad.addColorStop(0, '#15151f');
  grad.addColorStop(0.5, '#22222e');
  grad.addColorStop(1, '#15151f');
  ctx.fillStyle = grad;
  ctx.fillRect(x, 30, 50, baseY - 30);
  ctx.fillStyle = '#1a1a26';
  ctx.fillRect(x - 4, 30, 58, 14);
  ctx.fillRect(x - 4, baseY - 14, 58, 14);
}

function drawGround() {
  // Floor
  const grad = ctx.createLinearGradient(0, bandTop, 0, H);
  grad.addColorStop(0, '#181822');
  grad.addColorStop(1, '#0a0a10');
  ctx.fillStyle = grad;
  ctx.fillRect(0, bandTop, W, H - bandTop);

  // Cobblestone-ish lines
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.lineWidth = 1;
  const off = game.cameraX % 80;
  for (let i = -1; i < W / 80 + 1; i++) {
    const x = i * 80 - off;
    ctx.beginPath();
    ctx.moveTo(x, bandTop);
    ctx.lineTo(x - 30, H);
    ctx.stroke();
  }
  // Top edge of band
  ctx.strokeStyle = 'rgba(120, 80, 60, 0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, bandTop);
  ctx.lineTo(W, bandTop);
  ctx.stroke();
}

function drawPlayer() {
  const p = game.player;
  const x = sX(p.x), y = p.y;
  const blink = p.invuln > 0 && Math.floor(p.invuln * 20) % 2 === 0;
  if (blink) return;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.ellipse(x, y + 4, 18, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body
  const bodyTop = y - p.h;
  const bodyGrad = ctx.createLinearGradient(0, bodyTop, 0, y);
  bodyGrad.addColorStop(0, p.flash > 0 ? '#ffffff' : '#3a3a4e');
  bodyGrad.addColorStop(1, p.flash > 0 ? '#ffaaaa' : '#1a1a26');
  ctx.fillStyle = bodyGrad;
  roundRect(x - p.w / 2, bodyTop, p.w, p.h, 6);
  ctx.fill();

  // Hood / head
  ctx.fillStyle = p.flash > 0 ? '#ffaaaa' : '#22222e';
  ctx.beginPath();
  ctx.arc(x, bodyTop + 12, 14, 0, Math.PI * 2);
  ctx.fill();
  // eyes (red glow)
  ctx.fillStyle = '#ff5555';
  ctx.fillRect(x + p.facing * 2 - 5, bodyTop + 10, 3, 2);
  ctx.fillRect(x + p.facing * 2 + 2, bodyTop + 10, 3, 2);

  // Weapon (visual)
  drawPlayerWeapon(p);
}

function drawPlayerWeapon(p) {
  const w = WEAPONS[game.weaponIndex];
  const x = sX(p.x);
  const y = p.y - p.h * 0.5;
  const swingProgress = w.swingTime > 0 ? 1 - (p.swingTimer / w.swingTime) : 1;
  const swinging = p.swingTimer > 0;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(p.facing, 1);

  if (w.id === 'sword') {
    const angle = swinging ? -Math.PI * 0.6 + swingProgress * Math.PI * 0.9 : Math.PI * 0.1;
    ctx.rotate(angle);
    // blade
    ctx.fillStyle = w.color;
    ctx.fillRect(8, -3, 38, 6);
    // tip
    ctx.beginPath();
    ctx.moveTo(46, -3); ctx.lineTo(56, 0); ctx.lineTo(46, 3); ctx.closePath();
    ctx.fill();
    // hilt
    ctx.fillStyle = '#2a1a0a';
    ctx.fillRect(0, -4, 10, 8);
    ctx.fillStyle = '#5a3a1a';
    ctx.fillRect(-2, -8, 4, 16);
    if (swinging) drawSwingArc(0, 0, 50, swingProgress, '#d8d4c0');
  } else if (w.id === 'bow') {
    const pull = swinging ? Math.sin(swingProgress * Math.PI) * 6 : 0;
    ctx.strokeStyle = w.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(8, 0, 16, -Math.PI * 0.4, Math.PI * 0.4);
    ctx.stroke();
    // string
    ctx.strokeStyle = '#aaa';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(8 + 16 * Math.cos(-Math.PI * 0.4), 16 * Math.sin(-Math.PI * 0.4));
    ctx.lineTo(8 - pull, 0);
    ctx.lineTo(8 + 16 * Math.cos(Math.PI * 0.4), 16 * Math.sin(Math.PI * 0.4));
    ctx.stroke();
  } else if (w.id === 'hammer') {
    const angle = swinging
      ? -Math.PI * 0.7 + swingProgress * Math.PI * 1.3
      : Math.PI * 0.05;
    ctx.rotate(angle);
    // shaft
    ctx.fillStyle = '#3a2a1a';
    ctx.fillRect(0, -3, 40, 6);
    // head
    ctx.fillStyle = '#4a4a52';
    ctx.fillRect(34, -14, 20, 28);
    ctx.fillStyle = '#2a2a30';
    ctx.fillRect(34, -14, 6, 28);
    if (swinging) drawSwingArc(0, 0, 55, swingProgress, '#888');
  }

  ctx.restore();
}

function drawSwingArc(cx, cy, r, progress, color) {
  ctx.save();
  ctx.globalAlpha = (1 - progress) * 0.5;
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, r, -0.6 + progress * 1.0, -0.6 + progress * 1.6);
  ctx.stroke();
  ctx.restore();
}

function drawEnemy(e) {
  const x = sX(e.x), y = e.y;
  const bob = Math.sin(e.bobble) * (e.type.flying ? 6 : 2);
  const dying = e.dead;
  const alpha = dying ? Math.max(0, e.deathTimer / 0.4) : 1;

  ctx.save();
  ctx.globalAlpha = alpha;

  // Shadow
  if (!dying) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(x, y + 4, e.w * 0.45, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.translate(x, y + bob);

  if (e.typeId === 'skeleton') drawSkeleton(e);
  else if (e.typeId === 'bat') drawBat(e);
  else if (e.typeId === 'brute') drawBrute(e);

  ctx.restore();

  // HP bar
  if (!dying && e.hp < e.maxHp) {
    const bw = e.w + 8;
    const bx = x - bw / 2;
    const by = y - e.h - 14;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(bx, by, bw, 4);
    ctx.fillStyle = '#cc3030';
    ctx.fillRect(bx, by, bw * (e.hp / e.maxHp), 4);
  }
}

function drawSkeleton(e) {
  const flash = e.flash > 0;
  // body
  ctx.fillStyle = flash ? '#ffffff' : e.type.color;
  roundRect(-e.w/2, -e.h, e.w, e.h, 4);
  ctx.fill();
  // ribs
  ctx.strokeStyle = flash ? '#ffeeee' : '#7a7060';
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(-e.w/2 + 4, -e.h + 14 + i * 8);
    ctx.lineTo(e.w/2 - 4, -e.h + 14 + i * 8);
    ctx.stroke();
  }
  // skull
  ctx.fillStyle = flash ? '#ffffff' : '#e8e0d0';
  ctx.beginPath();
  ctx.arc(0, -e.h + 8, 11, 0, Math.PI * 2);
  ctx.fill();
  // eye sockets
  ctx.fillStyle = '#000';
  ctx.fillRect(-6, -e.h + 6, 4, 4);
  ctx.fillRect(2, -e.h + 6, 4, 4);
  // red glow
  ctx.fillStyle = '#ff3030';
  ctx.fillRect(-5, -e.h + 7, 2, 2);
  ctx.fillRect(3, -e.h + 7, 2, 2);
}

function drawBat(e) {
  const flash = e.flash > 0;
  const flap = Math.sin(e.bobble * 2) * 0.6;
  // body
  ctx.fillStyle = flash ? '#ffffff' : e.type.color;
  ctx.beginPath();
  ctx.ellipse(0, -e.h * 0.4, 10, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  // wings
  ctx.fillStyle = flash ? '#ffaaaa' : e.type.accent;
  ctx.beginPath();
  ctx.moveTo(0, -e.h * 0.4);
  ctx.quadraticCurveTo(-22, -e.h * 0.4 - 6 + flap * 8, -28, -e.h * 0.4 + flap * 6);
  ctx.quadraticCurveTo(-18, -e.h * 0.4, 0, -e.h * 0.3);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0, -e.h * 0.4);
  ctx.quadraticCurveTo(22, -e.h * 0.4 - 6 + flap * 8, 28, -e.h * 0.4 + flap * 6);
  ctx.quadraticCurveTo(18, -e.h * 0.4, 0, -e.h * 0.3);
  ctx.fill();
  // eyes
  ctx.fillStyle = '#ff3030';
  ctx.fillRect(-4, -e.h * 0.4 - 2, 2, 2);
  ctx.fillRect(2, -e.h * 0.4 - 2, 2, 2);
}

function drawBrute(e) {
  const flash = e.flash > 0;
  // body
  const grad = ctx.createLinearGradient(0, -e.h, 0, 0);
  grad.addColorStop(0, flash ? '#ffffff' : e.type.color);
  grad.addColorStop(1, flash ? '#ffaaaa' : e.type.accent);
  ctx.fillStyle = grad;
  roundRect(-e.w/2, -e.h, e.w, e.h, 8);
  ctx.fill();
  // shoulders
  ctx.fillStyle = flash ? '#ffaaaa' : '#3a1010';
  ctx.beginPath();
  ctx.arc(-e.w/2 + 8, -e.h + 18, 12, 0, Math.PI * 2);
  ctx.arc(e.w/2 - 8, -e.h + 18, 12, 0, Math.PI * 2);
  ctx.fill();
  // head
  ctx.fillStyle = flash ? '#ffffff' : '#2a1010';
  ctx.beginPath();
  ctx.arc(0, -e.h + 8, 14, 0, Math.PI * 2);
  ctx.fill();
  // horns
  ctx.fillStyle = '#1a0808';
  ctx.beginPath();
  ctx.moveTo(-10, -e.h + 2); ctx.lineTo(-16, -e.h - 8); ctx.lineTo(-6, -e.h);
  ctx.moveTo(10, -e.h + 2); ctx.lineTo(16, -e.h - 8); ctx.lineTo(6, -e.h);
  ctx.fill();
  // eyes
  ctx.fillStyle = '#ffaa00';
  ctx.fillRect(-7, -e.h + 6, 4, 3);
  ctx.fillRect(3, -e.h + 6, 4, 3);
}

function drawProjectiles() {
  for (const pr of game.projectiles) {
    if (pr.kind === 'arrow') {
      const x = sX(pr.x), y = pr.y;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.atan2(pr.vy, pr.vx));
      // shaft
      ctx.fillStyle = '#7a5a3a';
      ctx.fillRect(-14, -1, 24, 2);
      // tip
      ctx.fillStyle = '#c8c0a0';
      ctx.beginPath();
      ctx.moveTo(10, -3); ctx.lineTo(16, 0); ctx.lineTo(10, 3); ctx.closePath();
      ctx.fill();
      // fletching
      ctx.fillStyle = '#b04040';
      ctx.beginPath();
      ctx.moveTo(-14, 0); ctx.lineTo(-18, -3); ctx.lineTo(-14, -1);
      ctx.moveTo(-14, 0); ctx.lineTo(-18, 3); ctx.lineTo(-14, 1);
      ctx.fill();
      ctx.restore();
    }
  }
}

function drawParticles() {
  for (const p of game.particles) {
    const a = p.life / p.maxLife;
    ctx.fillStyle = p.color;
    ctx.globalAlpha = a;
    ctx.beginPath();
    ctx.arc(sX(p.x), p.y, p.size * a + 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawDamageNums() {
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  for (const dn of game.damageNums) {
    const a = dn.life / dn.maxLife;
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillText(dn.text, sX(dn.x) + 1, dn.y + 1);
    ctx.fillStyle = dn.color;
    ctx.fillText(dn.text, sX(dn.x), dn.y);
  }
  ctx.globalAlpha = 1;
}

function drawTorchOverlay() {
  if (!game.player) return;
  const p = game.player;
  const cx = sX(p.x);
  const cy = p.y - p.h * 0.5;
  const grad = ctx.createRadialGradient(cx, cy, 60, cx, cy, Math.max(W, H) * 0.7);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
  grad.addColorStop(0.4, 'rgba(0, 0, 0, 0.35)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.85)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  // warm tint near torch
  const warm = ctx.createRadialGradient(cx, cy, 20, cx, cy, 200);
  warm.addColorStop(0, 'rgba(255, 160, 80, 0.18)');
  warm.addColorStop(1, 'rgba(255, 160, 80, 0)');
  ctx.fillStyle = warm;
  ctx.fillRect(0, 0, W, H);
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ============ Game flow ============
function updateWeaponUI() {
  const w = WEAPONS[game.weaponIndex];
  weaponIcon.textContent = w.icon;
  weaponName.textContent = w.name.toUpperCase();
}

function startGame() {
  overlay.classList.remove('visible');
  game.running = true;
  game.player = makePlayer();
  game.enemies = [];
  game.projectiles = [];
  game.particles = [];
  game.damageNums = [];
  game.cameraX = 0;
  game.spawnTimer = 1.5;
  game.kills = 0;
  game.weaponIndex = 0;
  killsEl.textContent = '0 kills';
  hpBar.style.width = '100%';
  hpText.textContent = '100/100';
  updateWeaponUI();
}

function gameOver() {
  game.running = false;
  overlay.querySelector('h1').textContent = 'Tu es tombé';
  overlay.querySelector('.subtitle').textContent =
    `${game.kills} ennemis abattus · ${Math.floor(game.cameraX / 50)} m parcourus`;
  startBtn.textContent = 'Recommencer';
  overlay.classList.add('visible');
}

startBtn.addEventListener('click', startGame);
updateWeaponUI();
requestAnimationFrame(loop);
})();
