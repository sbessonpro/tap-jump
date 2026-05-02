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
const coinsEl = document.getElementById('coins');
const weaponBtn = document.getElementById('weapon-btn');
const weaponIcon = document.getElementById('weapon-icon');
const weaponName = document.getElementById('weapon-name');
const attackBtn = document.getElementById('attack-btn');
const joyZone = document.getElementById('joy-zone');
const joyBase = document.getElementById('joy-base');
const joyStick = document.getElementById('joy-stick');
const shopBtn = document.getElementById('shop-btn');
const shopModal = document.getElementById('shop-modal');
const shopClose = document.getElementById('shop-close');
const shopList = document.getElementById('shop-list');
const shopCoinsEl = document.getElementById('shop-coins');

let W = 0, H = 0;
const DPR = Math.min(window.devicePixelRatio || 1, 2);

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
const TAU = Math.PI * 2;

// ============ Input ============
const input = {
  move: { x: 0, y: 0 },
  attack: false,
  switchWeapon: false,
  keys: new Set(),
};

window.addEventListener('keydown', e => {
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','Tab'].includes(e.code)) e.preventDefault();
  if (!game.running && (e.code === 'Space' || e.code === 'Enter')) { startGame(); return; }
  input.keys.add(e.code);
  if (e.code === 'Space') input.attack = true;
  if (e.code === 'KeyQ' || e.code === 'Tab') input.switchWeapon = true;
  if (e.code === 'KeyB') toggleShop();
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

// Joystick
let joyTouchId = null;
const joyCenter = { x: 0, y: 0 };
const JOY_RADIUS = 55;

function joyStart(e) {
  const t = e.changedTouches ? e.changedTouches[0] : e;
  if (joyTouchId !== null) return;
  joyTouchId = e.changedTouches ? t.identifier : 'mouse';
  const rect = joyZone.getBoundingClientRect();
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
  } else { t = e; }
  const dx = t.clientX - joyCenter.x;
  const dy = t.clientY - joyCenter.y;
  const d = Math.hypot(dx, dy);
  const k = d > JOY_RADIUS ? JOY_RADIUS / d : 1;
  const sx = dx * k, sy = dy * k;
  joyStick.style.transform = `translate(calc(-50% + ${sx}px), calc(-50% + ${sy}px))`;
  const mag = Math.min(d / JOY_RADIUS, 1);
  if (mag < 0.15) { input.move.x = 0; input.move.y = 0; }
  else {
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

function addPress(el, onDown, onUp) {
  el.addEventListener('touchstart', e => { e.preventDefault(); onDown(); }, { passive: false });
  el.addEventListener('touchend',   e => { e.preventDefault(); if (onUp) onUp(); }, { passive: false });
  el.addEventListener('mousedown',  e => { e.preventDefault(); onDown(); });
  el.addEventListener('mouseup',    e => { e.preventDefault(); if (onUp) onUp(); });
  el.addEventListener('mouseleave', () => { if (onUp) onUp(); });
}

addPress(attackBtn,
  () => { input.attack = true; },
  () => { input.attack = false; }
);
addPress(weaponBtn, () => { input.switchWeapon = true; }, null);

// ============ Weapons ============
const WEAPONS = [
  { id: 'sword',  name: 'Épée',    icon: '⚔', cooldown: 0.32, range: 75,  arc: 0.7, damage: 25, knockback: 80,  color: '#d8d4c0', swingTime: 0.18, type: 'melee' },
  { id: 'bow',    name: 'Arc',     icon: '🏹', cooldown: 0.55,             damage: 22, knockback: 50,  color: '#a08660', swingTime: 0.12, type: 'ranged', projectileSpeed: 760 },
  { id: 'hammer', name: 'Marteau', icon: '🔨', cooldown: 0.95, range: 95, arc: 1.0, damage: 65, knockback: 220, color: '#7a5a3a', swingTime: 0.34, type: 'melee' },
];

// ============ Game state ============
const game = {
  running: false,
  paused: false,
  t: 0,
  player: null,
  enemies: [],
  projectiles: [],
  particles: [],
  embers: [],
  damageNums: [],
  pickups: [],
  cameraX: 0,
  spawnTimer: 0,
  kills: 0,
  coins: 0,
  weaponIndex: 0,
  shake: 0,
  upgrades: {
    damageMul: 1,
    speedMul: 1,
    weaponBonus: { sword: 1, bow: 1, hammer: 1 },
    purchased: new Set(),
  },
};

// ============ Player ============
function makePlayer() {
  return {
    x: 220,
    y: (bandTop + bandBot) / 2,
    w: 44, h: 70,
    speed: 230,
    facing: 1,
    hp: 100, maxHp: 100,
    attackTimer: 0,
    swingTimer: 0,
    swingDir: 1,
    invuln: 0,
    flash: 0,
    walkPhase: 0,
    moving: false,
    emberTimer: 0,
  };
}

function attackPlayer() {
  const p = game.player;
  const w = WEAPONS[game.weaponIndex];
  if (p.attackTimer > 0) return;
  p.attackTimer = w.cooldown;
  p.swingTimer = w.swingTime;
  p.swingDir = p.facing;

  const dmg = w.damage * game.upgrades.damageMul * game.upgrades.weaponBonus[w.id];

  if (w.type === 'melee') {
    for (const e of game.enemies) {
      if (e.dead) continue;
      const dx = (e.x - p.x) * p.facing;
      if (dx < -10) continue;
      const cx = p.x + p.facing * (w.range * 0.4);
      const cy = p.y - 10;
      const ddx = e.x - cx, ddy = e.y - cy;
      if (ddx*ddx + ddy*ddy < (w.range + e.r) * (w.range + e.r)) {
        damageEnemy(e, dmg, p.facing * w.knockback);
      }
    }
    spawnSwingParticles(p, w);
    game.shake = Math.max(game.shake, w.id === 'hammer' ? 16 : 5);
  } else if (w.type === 'ranged') {
    game.projectiles.push({
      x: p.x + p.facing * 28,
      y: p.y - p.h * 0.45,
      vx: p.facing * w.projectileSpeed,
      vy: 0,
      damage: dmg,
      knockback: w.knockback,
      life: 1.4,
      friendly: true,
      kind: 'arrow',
    });
    game.shake = Math.max(game.shake, 3);
  }
}

function spawnSwingParticles(p, w) {
  const n = w.id === 'hammer' ? 18 : 10;
  for (let i = 0; i < n; i++) {
    const a = rand(-0.7, 0.7);
    const sp = rand(140, 320);
    game.particles.push({
      x: p.x + p.facing * w.range * 0.5,
      y: p.y - p.h * 0.5 + rand(-14, 14),
      vx: p.facing * Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 80,
      life: 0.4, maxLife: 0.4,
      color: w.color,
      size: 2 + Math.random() * 2,
    });
  }
}

// ============ Enemies ============
const ENEMY_TYPES = {
  skeleton: {
    w: 36, h: 58, r: 24,
    hp: 50, speed: 95, damage: 10,
    color: '#d8d0bc', accent: '#5a3a3a',
    coinDrop: [3, 6],
    contactCooldown: 0.8,
  },
  bat: {
    w: 32, h: 26, r: 20,
    hp: 22, speed: 170, damage: 6,
    color: '#3a2a4a', accent: '#7a3a8a',
    coinDrop: [1, 3],
    contactCooldown: 0.6,
    flying: true,
  },
  brute: {
    w: 56, h: 78, r: 34,
    hp: 140, speed: 70, damage: 22,
    color: '#5a2a2a', accent: '#3a1010',
    coinDrop: [10, 18],
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
    knockback: 0,
    knockbackDir: 0,
    flash: 0,
    contactTimer: 0,
    bobble: Math.random() * TAU,
    walkPhase: Math.random() * TAU,
    dead: false,
    deathTimer: 0,
  };
}

function spawnWave() {
  const camRight = game.cameraX + W + 80;
  const dist = game.cameraX / 50;
  const r = Math.random();
  // Difficulty scaling
  const bruteChance = clamp(0.10 + dist / 1500, 0.10, 0.40);

  if (r < 0.50) {
    spawnAt('skeleton', camRight + rand(20, 200));
    if (Math.random() < 0.3 + dist / 2000) spawnAt('skeleton', camRight + rand(220, 380));
  } else if (r < 0.50 + (1 - bruteChance) * 0.4) {
    const n = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) spawnAt('bat', camRight + rand(20, 280));
  } else {
    spawnAt('brute', camRight + rand(40, 200));
    if (Math.random() < 0.5) spawnAt('skeleton', camRight + rand(60, 220));
  }
}

function spawnAt(id, x) {
  const t = ENEMY_TYPES[id];
  const y = t.flying
    ? rand(bandTop - 50, bandBot - 70)
    : rand(bandTop + 10, bandBot - 10);
  game.enemies.push(spawnEnemy(id, x, y));
}

function damageEnemy(e, dmg, knockback) {
  e.hp -= dmg;
  e.flash = 0.15;
  e.knockback = Math.abs(knockback);
  e.knockbackDir = Math.sign(knockback) || 1;
  game.damageNums.push({
    x: e.x, y: e.y - e.h * 0.65,
    vy: -70,
    text: '' + Math.round(dmg),
    life: 0.7, maxLife: 0.7,
    color: dmg >= 50 ? '#ffcc40' : '#ff7070',
  });
  if (e.hp <= 0 && !e.dead) {
    e.dead = true;
    e.deathTimer = 0.4;
    game.kills += 1;
    killsEl.textContent = '☠ ' + game.kills;
    spawnDeathParticles(e);
    // Drop coins
    const [lo, hi] = e.type.coinDrop;
    const n = Math.floor(rand(lo, hi + 1));
    for (let i = 0; i < n; i++) spawnCoin(e);
  }
}

function spawnDeathParticles(e) {
  for (let i = 0; i < 18; i++) {
    const a = rand(0, TAU);
    const sp = rand(100, 280);
    game.particles.push({
      x: e.x, y: e.y - e.h * 0.4,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 0.6, maxLife: 0.6,
      color: i % 3 === 0 ? '#aa1010' : e.type.accent,
      size: 2 + Math.random() * 2,
    });
  }
}

function spawnCoin(e) {
  game.pickups.push({
    kind: 'coin',
    x: e.x + rand(-12, 12),
    y: e.y - e.h * 0.4,
    vx: rand(-180, 180),
    vy: rand(-280, -160),
    onGround: false,
    groundY: e.y,
    life: 14,
    spin: rand(0, TAU),
    spinVel: rand(4, 9),
    magnet: false,
  });
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

// ============ Pickups ============
const COIN_MAGNET = 100;
const COIN_PICK = 18;

function updatePickups(dt) {
  const p = game.player;
  for (const c of game.pickups) {
    c.life -= dt;
    c.spin += c.spinVel * dt;

    if (!c.onGround) {
      c.vy += 900 * dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      if (c.y >= c.groundY) {
        c.y = c.groundY;
        c.vy = -c.vy * 0.35;
        c.vx *= 0.6;
        if (Math.abs(c.vy) < 50) { c.vy = 0; c.onGround = true; }
      }
    } else {
      // gentle attraction in idle when close
      const dx = p.x - c.x, dy = p.y - p.h * 0.5 - c.y;
      const d = Math.hypot(dx, dy);
      if (d < COIN_MAGNET || c.magnet) {
        c.magnet = true;
        const sp = 480;
        c.x += (dx / d) * sp * dt;
        c.y += (dy / d) * sp * dt;
        if (d < COIN_PICK) {
          c.life = 0;
          game.coins += 1;
          coinsEl.textContent = '⛁ ' + game.coins;
          for (let i = 0; i < 6; i++) {
            game.particles.push({
              x: c.x, y: c.y,
              vx: rand(-80, 80), vy: rand(-160, -40),
              life: 0.4, maxLife: 0.4,
              color: '#ffe080', size: 2,
            });
          }
        }
      }
    }
  }
  game.pickups = game.pickups.filter(c => c.life > 0);
}

// ============ Embers (ambient atmosphere) ============
function updateEmbers(dt) {
  // spawn embers around the screen
  if (Math.random() < dt * 8) {
    game.embers.push({
      x: game.cameraX + rand(-50, W + 50),
      y: rand(bandTop, H),
      vx: rand(-12, 12),
      vy: rand(-50, -20),
      life: rand(1.5, 3),
      maxLife: 3,
      size: rand(1, 2.2),
    });
  }
  for (const em of game.embers) {
    em.x += em.vx * dt;
    em.y += em.vy * dt;
    em.life -= dt;
  }
  game.embers = game.embers.filter(em => em.life > 0);
}

// ============ Shop ============
const SHOP_ITEMS = [
  { id: 'heal_small',  name: 'Potion mineure',  desc: '+50 PV',                price: 20,  icon: '❤️',
    apply: () => { game.player.hp = Math.min(game.player.maxHp, game.player.hp + 50); refreshHpUI(); }
  },
  { id: 'heal_full',   name: 'Potion majeure',  desc: 'Soin total',            price: 50,  icon: '🧪',
    apply: () => { game.player.hp = game.player.maxHp; refreshHpUI(); }
  },
  { id: 'maxhp',       name: 'Vitalité',        desc: '+25 PV max',            price: 80,  icon: '💪',
    apply: () => { game.player.maxHp += 25; game.player.hp += 25; refreshHpUI(); }
  },
  { id: 'damage',      name: 'Force',           desc: '+20% dégâts',           price: 100, icon: '⚡',
    apply: () => { game.upgrades.damageMul *= 1.2; }
  },
  { id: 'speed',       name: 'Agilité',         desc: '+15% vitesse',          price: 60,  icon: '👟',
    apply: () => { game.upgrades.speedMul *= 1.15; }
  },
  { id: 'sword_up',    name: 'Épée affûtée',    desc: 'Épée +60% dégâts',      price: 130, icon: '⚔️',  once: true,
    apply: () => { game.upgrades.weaponBonus.sword = 1.6; }
  },
  { id: 'bow_up',      name: 'Arc enchanté',    desc: 'Arc +60% dégâts',       price: 130, icon: '🏹',  once: true,
    apply: () => { game.upgrades.weaponBonus.bow = 1.6; }
  },
  { id: 'hammer_up',   name: 'Marteau de guerre', desc: 'Marteau +60% dégâts', price: 160, icon: '🔨',  once: true,
    apply: () => { game.upgrades.weaponBonus.hammer = 1.6; }
  },
];

function toggleShop() {
  if (!game.running) return;
  if (game.paused) closeShop(); else openShop();
}

function openShop() {
  if (!game.running) return;
  game.paused = true;
  // reset input to prevent stuck movement/attack while paused
  input.move.x = 0; input.move.y = 0;
  input.attack = false;
  joyTouchId = null;
  joyStick.style.transform = 'translate(-50%, -50%)';
  renderShop();
  shopModal.classList.add('visible');
}

function closeShop() {
  game.paused = false;
  shopModal.classList.remove('visible');
}

function renderShop() {
  shopList.innerHTML = '';
  for (const item of SHOP_ITEMS) {
    if (item.once && game.upgrades.purchased.has(item.id)) continue;
    const card = document.createElement('div');
    card.className = 'shop-item';
    if (game.coins < item.price) card.classList.add('disabled');
    card.innerHTML = `
      <div class="shop-icon">${item.icon}</div>
      <div class="shop-info">
        <div class="shop-name">${item.name}</div>
        <div class="shop-desc">${item.desc}</div>
      </div>
      <div class="shop-price">⛁ ${item.price}</div>
    `;
    card.addEventListener('click', () => buyItem(item));
    shopList.appendChild(card);
  }
  shopCoinsEl.textContent = '⛁ ' + game.coins;
}

function buyItem(item) {
  if (game.coins < item.price) return;
  game.coins -= item.price;
  if (item.once) game.upgrades.purchased.add(item.id);
  item.apply();
  coinsEl.textContent = '⛁ ' + game.coins;
  renderShop();
}

function refreshHpUI() {
  const p = game.player;
  hpBar.style.width = clamp((p.hp / p.maxHp) * 100, 0, 100) + '%';
  hpText.textContent = Math.round(p.hp) + '/' + p.maxHp;
}

shopBtn.addEventListener('click', toggleShop);
shopClose.addEventListener('click', closeShop);

// ============ Main loop ============
let lastT = 0;
function loop(t) {
  const dt = Math.min(0.033, (t - lastT) / 1000);
  lastT = t;
  game.t += dt;

  if (game.running && !game.paused) update(dt);
  render(dt);

  requestAnimationFrame(loop);
}

function update(dt) {
  const p = game.player;

  if (input.switchWeapon) {
    input.switchWeapon = false;
    game.weaponIndex = (game.weaponIndex + 1) % WEAPONS.length;
    updateWeaponUI();
  }

  // Movement
  let mx = input.move.x, my = input.move.y;
  const kb = readKeyboardMove();
  if (kb) { mx = kb.x; my = kb.y; }

  const sp = p.speed * game.upgrades.speedMul;
  p.x += mx * sp * dt;
  p.y += my * sp * dt * 0.85;
  p.y = clamp(p.y, bandTop, bandBot);
  if (mx > 0.05) p.facing = 1;
  else if (mx < -0.05) p.facing = -1;

  p.moving = Math.abs(mx) > 0.05 || Math.abs(my) > 0.05;
  if (p.moving) p.walkPhase += dt * 13;

  // Camera
  const targetCam = p.x - W * 0.35;
  game.cameraX = Math.max(game.cameraX, targetCam);
  const distance = Math.floor(game.cameraX / 50);
  distEl.textContent = distance + ' m';

  const leftEdge = game.cameraX + 30;
  if (p.x < leftEdge) p.x = leftEdge;

  if (input.attack) attackPlayer();

  if (p.attackTimer > 0) p.attackTimer -= dt;
  if (p.swingTimer > 0) p.swingTimer -= dt;
  if (p.invuln > 0) p.invuln -= dt;
  if (p.flash > 0) p.flash -= dt;

  // Player aura embers
  p.emberTimer -= dt;
  if (p.emberTimer <= 0) {
    p.emberTimer = 0.06;
    game.particles.push({
      x: p.x + rand(-10, 10),
      y: p.y - rand(0, p.h),
      vx: rand(-10, 10),
      vy: rand(-50, -20),
      life: 0.7, maxLife: 0.7,
      color: '#ff6030',
      size: 1.5,
    });
  }

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
    e.walkPhase += dt * 10;

    if (e.knockback > 0) {
      e.x += e.knockbackDir * e.knockback * dt * 6;
      e.knockback -= e.knockback * dt * 8 + 30 * dt;
      if (e.knockback < 5) e.knockback = 0;
    } else {
      const dx = p.x - e.x, dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      e.x += (dx / d) * e.speed * dt;
      e.y += (dy / d) * e.speed * dt * 0.75;
      if (!e.type.flying) e.y = clamp(e.y, bandTop, bandBot);
    }

    const ddx = p.x - e.x, ddy = p.y - e.y;
    if (ddx*ddx + ddy*ddy < (e.r + 18) * (e.r + 18) && e.contactTimer <= 0) {
      damagePlayer(e.type.damage);
      e.contactTimer = e.type.contactCooldown;
    }
  }
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

  for (const pa of game.particles) {
    pa.x += pa.vx * dt;
    pa.y += pa.vy * dt;
    pa.vy += 600 * dt;
    pa.life -= dt;
  }
  game.particles = game.particles.filter(pa => pa.life > 0);

  for (const dn of game.damageNums) {
    dn.y += dn.vy * dt;
    dn.vy += 80 * dt;
    dn.life -= dt;
  }
  game.damageNums = game.damageNums.filter(dn => dn.life > 0);

  updatePickups(dt);
  updateEmbers(dt);

  if (game.shake > 0) game.shake = Math.max(0, game.shake - dt * 40);
}

// ============ Render ============
const sX = wx => wx - game.cameraX;

function render(dt) {
  ctx.clearRect(0, 0, W, H);
  const sx = (Math.random() - 0.5) * game.shake;
  const sy = (Math.random() - 0.5) * game.shake;
  ctx.save();
  ctx.translate(sx, sy);

  drawBackground(dt);
  drawEmbers();
  drawGround();

  if (game.player) {
    // Sort entities by Y
    const all = [];
    for (const e of game.enemies) all.push({ y: e.y, draw: () => drawEnemy(e) });
    for (const c of game.pickups) all.push({ y: c.y, draw: () => drawCoin(c) });
    all.push({ y: game.player.y, draw: () => drawPlayer() });
    all.sort((a, b) => a.y - b.y);
    for (const item of all) item.draw();

    drawProjectiles();
    drawParticles();
    drawDamageNums();
    drawTorchOverlay();
  }

  ctx.restore();
}

// ============ Background ============
function drawBackground(dt) {
  ctx.fillStyle = '#0a0a14';
  ctx.fillRect(0, 0, W, bandTop);

  // Cracks
  ctx.strokeStyle = 'rgba(60, 50, 70, 0.35)';
  ctx.lineWidth = 1;
  const farOff = (game.cameraX * 0.2) % 240;
  for (let i = -1; i < W / 240 + 1; i++) {
    const x = i * 240 - farOff;
    ctx.beginPath();
    ctx.moveTo(x + 30, bandTop * 0.2);
    ctx.lineTo(x + 60, bandTop * 0.5);
    ctx.lineTo(x + 40, bandTop * 0.7);
    ctx.stroke();
  }

  // Pillars
  const midOff = (game.cameraX * 0.5) % 360;
  for (let i = -1; i < W / 360 + 2; i++) {
    const x = i * 360 - midOff;
    drawPillar(x, bandTop - 50);
  }

  // Wall torches
  const torchOff = (game.cameraX * 0.6) % 480;
  for (let i = -1; i < W / 480 + 2; i++) {
    const x = i * 480 + 240 - torchOff;
    drawWallTorch(x, bandTop * 0.45);
  }
}

function drawPillar(x, baseY) {
  const grad = ctx.createLinearGradient(x, 0, x + 50, 0);
  grad.addColorStop(0, '#15151f');
  grad.addColorStop(0.5, '#26262e');
  grad.addColorStop(1, '#15151f');
  ctx.fillStyle = grad;
  ctx.fillRect(x, 30, 50, baseY - 30);
  ctx.fillStyle = '#1c1c26';
  ctx.fillRect(x - 4, 30, 58, 14);
  ctx.fillRect(x - 4, baseY - 14, 58, 14);
  // Crack
  ctx.strokeStyle = 'rgba(80, 60, 80, 0.4)';
  ctx.beginPath();
  ctx.moveTo(x + 25, 50);
  ctx.lineTo(x + 22, baseY - 30);
  ctx.stroke();
}

function drawWallTorch(x, y) {
  const flicker = Math.sin(game.t * 12 + x) * 0.2 + 0.8;
  // bracket
  ctx.fillStyle = '#3a2a1a';
  ctx.fillRect(x - 3, y, 6, 14);
  // flame
  const grad = ctx.createRadialGradient(x, y - 6, 1, x, y - 6, 22);
  grad.addColorStop(0, `rgba(255, 230, 120, ${flicker})`);
  grad.addColorStop(0.4, `rgba(255, 140, 40, ${flicker * 0.8})`);
  grad.addColorStop(1, 'rgba(180, 40, 0, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y - 6, 22, 0, TAU);
  ctx.fill();
  // core
  ctx.fillStyle = `rgba(255, 240, 180, ${flicker})`;
  ctx.beginPath();
  ctx.ellipse(x, y - 6, 3, 6, 0, 0, TAU);
  ctx.fill();
}

function drawGround() {
  const grad = ctx.createLinearGradient(0, bandTop, 0, H);
  grad.addColorStop(0, '#1a1a24');
  grad.addColorStop(1, '#0a0a10');
  ctx.fillStyle = grad;
  ctx.fillRect(0, bandTop, W, H - bandTop);

  // Diagonal stones
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

  // Top edge
  ctx.strokeStyle = 'rgba(120, 80, 60, 0.4)';
  ctx.beginPath();
  ctx.moveTo(0, bandTop);
  ctx.lineTo(W, bandTop);
  ctx.stroke();
}

function drawEmbers() {
  for (const em of game.embers) {
    const a = clamp(em.life / em.maxLife, 0, 1);
    ctx.fillStyle = `rgba(255, 130, 50, ${a * 0.7})`;
    ctx.beginPath();
    ctx.arc(sX(em.x), em.y, em.size, 0, TAU);
    ctx.fill();
  }
}

// ============ Hero (dark knight) ============
function drawPlayer() {
  const p = game.player;
  const x = sX(p.x);
  const y = p.y;
  const blink = p.invuln > 0 && Math.floor(p.invuln * 20) % 2 === 0;
  if (blink) return;

  // Big shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.beginPath();
  ctx.ellipse(x, y + 4, 22, 6, 0, 0, TAU);
  ctx.fill();

  const walk = p.moving ? Math.sin(p.walkPhase) : 0;
  const bob = p.moving ? Math.abs(walk) * 2 : 0;

  ctx.save();
  ctx.translate(x, y - bob);

  // Cape (behind, drawn first)
  drawCape(p, walk);

  // Legs (animated)
  drawLegs(p, walk);

  // Body armor
  drawArmor(p);

  // Pauldrons
  drawPauldrons(p);

  // Helm
  drawHelm(p, walk);

  // Weapon
  drawPlayerWeapon(p);

  ctx.restore();
}

function drawCape(p, walk) {
  const sway = walk * 4;
  ctx.fillStyle = p.flash > 0 ? '#ffaaaa' : '#7a1a1a';
  ctx.beginPath();
  ctx.moveTo(-p.facing * 8, -p.h * 0.85);
  ctx.quadraticCurveTo(-p.facing * 26 + sway, -p.h * 0.4, -p.facing * 22 + sway, -p.h * 0.05);
  ctx.lineTo(-p.facing * 14 + sway, -p.h * 0.05);
  ctx.quadraticCurveTo(-p.facing * 16, -p.h * 0.4, -p.facing * 4, -p.h * 0.85);
  ctx.closePath();
  ctx.fill();
  // Highlight
  ctx.fillStyle = p.flash > 0 ? '#ffd0d0' : '#a02020';
  ctx.beginPath();
  ctx.moveTo(-p.facing * 6, -p.h * 0.82);
  ctx.quadraticCurveTo(-p.facing * 14 + sway, -p.h * 0.4, -p.facing * 12 + sway, -p.h * 0.1);
  ctx.lineTo(-p.facing * 8 + sway, -p.h * 0.1);
  ctx.quadraticCurveTo(-p.facing * 10, -p.h * 0.4, -p.facing * 2, -p.h * 0.82);
  ctx.closePath();
  ctx.fill();
}

function drawLegs(p, walk) {
  const legW = 9, legH = 22;
  const offset = walk * 5;
  ctx.fillStyle = p.flash > 0 ? '#ffaaaa' : '#15151c';
  // back leg
  ctx.fillRect(-legW - 4, -legH - 4 + offset, legW, legH);
  // front leg
  ctx.fillRect(4, -legH - 4 - offset, legW, legH);
  // boots (darker)
  ctx.fillStyle = p.flash > 0 ? '#ffaaaa' : '#0a0a10';
  ctx.fillRect(-legW - 5, -6 + Math.max(0, offset), legW + 2, 6);
  ctx.fillRect(3, -6 + Math.max(0, -offset), legW + 2, 6);
}

function drawArmor(p) {
  const top = -p.h + 18;
  const bottom = -22;
  // Main torso
  const grad = ctx.createLinearGradient(0, top, 0, bottom);
  grad.addColorStop(0, p.flash > 0 ? '#ffffff' : '#2a2236');
  grad.addColorStop(0.5, p.flash > 0 ? '#ffaaaa' : '#1a1422');
  grad.addColorStop(1, p.flash > 0 ? '#ffaaaa' : '#0e0a14');
  ctx.fillStyle = grad;
  roundRect(-16, top, 32, bottom - top, 4);
  ctx.fill();
  // Chest plate detail (V shape, center crest)
  ctx.fillStyle = p.flash > 0 ? '#ffd0d0' : '#3a2240';
  ctx.beginPath();
  ctx.moveTo(0, top + 6);
  ctx.lineTo(-10, top + 22);
  ctx.lineTo(-6, top + 26);
  ctx.lineTo(0, top + 18);
  ctx.lineTo(6, top + 26);
  ctx.lineTo(10, top + 22);
  ctx.closePath();
  ctx.fill();
  // Crimson rune in center
  ctx.fillStyle = '#cc1818';
  ctx.fillRect(-1.5, top + 10, 3, 8);
  // belt
  ctx.fillStyle = '#1a0810';
  ctx.fillRect(-16, bottom - 4, 32, 4);
  ctx.fillStyle = '#aa6020';
  ctx.fillRect(-3, bottom - 4, 6, 4);
}

function drawPauldrons(p) {
  const top = -p.h + 18;
  ctx.fillStyle = p.flash > 0 ? '#ffaaaa' : '#1a1422';
  // back pauldron
  ctx.beginPath();
  ctx.ellipse(-18, top + 4, 10, 8, 0, 0, TAU);
  ctx.fill();
  // front pauldron
  ctx.beginPath();
  ctx.ellipse(18, top + 4, 10, 8, 0, 0, TAU);
  ctx.fill();
  // spike on front pauldron
  ctx.fillStyle = p.flash > 0 ? '#ffd0d0' : '#3a2a3a';
  ctx.beginPath();
  ctx.moveTo(20, top - 2);
  ctx.lineTo(28, top - 8);
  ctx.lineTo(22, top + 2);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-20, top - 2);
  ctx.lineTo(-28, top - 8);
  ctx.lineTo(-22, top + 2);
  ctx.closePath();
  ctx.fill();
}

function drawHelm(p, walk) {
  const top = -p.h + 2;
  // base helm
  ctx.fillStyle = p.flash > 0 ? '#ffffff' : '#1c1820';
  ctx.beginPath();
  ctx.moveTo(-13, top + 24);
  ctx.lineTo(-13, top + 8);
  ctx.quadraticCurveTo(0, top - 4, 13, top + 8);
  ctx.lineTo(13, top + 24);
  ctx.lineTo(p.facing * 9, top + 28);
  ctx.lineTo(-p.facing * 9, top + 28);
  ctx.closePath();
  ctx.fill();

  // Horns
  ctx.fillStyle = p.flash > 0 ? '#ffaaaa' : '#0a0810';
  ctx.beginPath();
  ctx.moveTo(-12, top + 8);
  ctx.quadraticCurveTo(-22, top - 2, -18, top - 14);
  ctx.quadraticCurveTo(-12, top - 4, -10, top + 6);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(12, top + 8);
  ctx.quadraticCurveTo(22, top - 2, 18, top - 14);
  ctx.quadraticCurveTo(12, top - 4, 10, top + 6);
  ctx.closePath();
  ctx.fill();

  // Visor slit (red glow)
  const glowAlpha = 0.7 + Math.sin(game.t * 6) * 0.2;
  // outer glow
  const glow = ctx.createRadialGradient(p.facing * 1, top + 16, 1, p.facing * 1, top + 16, 14);
  glow.addColorStop(0, `rgba(255, 60, 50, ${glowAlpha * 0.7})`);
  glow.addColorStop(1, 'rgba(255, 60, 50, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(-16, top + 6, 32, 22);
  // slit
  ctx.fillStyle = '#ff3030';
  ctx.fillRect(p.facing * 1 - 8, top + 14, 16, 2);
  ctx.fillStyle = '#ffaaaa';
  ctx.fillRect(p.facing * 1 - 6, top + 14, 12, 1);
}

function drawPlayerWeapon(p) {
  const w = WEAPONS[game.weaponIndex];
  const y = -p.h * 0.45;
  const swingProgress = w.swingTime > 0 ? 1 - (p.swingTimer / w.swingTime) : 1;
  const swinging = p.swingTimer > 0;

  ctx.save();
  ctx.translate(0, y);
  ctx.scale(p.facing, 1);

  if (w.id === 'sword') {
    const angle = swinging ? -Math.PI * 0.65 + swingProgress * Math.PI * 0.95 : Math.PI * 0.05;
    ctx.rotate(angle);
    // Sword guard
    ctx.fillStyle = '#5a3a18';
    ctx.fillRect(8, -8, 6, 16);
    // Blade
    const bgrad = ctx.createLinearGradient(14, -4, 14, 4);
    bgrad.addColorStop(0, '#f0ecd8');
    bgrad.addColorStop(0.5, w.color);
    bgrad.addColorStop(1, '#888070');
    ctx.fillStyle = bgrad;
    ctx.beginPath();
    ctx.moveTo(14, -4); ctx.lineTo(58, -2);
    ctx.lineTo(66, 0);  ctx.lineTo(58, 2);
    ctx.lineTo(14, 4);  ctx.closePath();
    ctx.fill();
    // Blade fuller (dark line)
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(16, -1, 40, 1);
    // Hilt
    ctx.fillStyle = '#2a1a0a';
    ctx.fillRect(0, -3, 10, 6);
    ctx.fillStyle = '#aa6020';
    ctx.beginPath();
    ctx.arc(-2, 0, 4, 0, TAU);
    ctx.fill();
    if (swinging) drawSwingArc(0, 0, 56, swingProgress, '#fff5d8');
  } else if (w.id === 'bow') {
    const pull = swinging ? Math.sin(swingProgress * Math.PI) * 8 : 0;
    // Bow body
    ctx.strokeStyle = w.color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(8, 0, 18, -Math.PI * 0.45, Math.PI * 0.45);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#6a4a2a';
    ctx.beginPath();
    ctx.arc(8, 0, 18, -Math.PI * 0.45, Math.PI * 0.45);
    ctx.stroke();
    // Grip
    ctx.fillStyle = '#3a2010';
    ctx.fillRect(6, -5, 4, 10);
    // String
    ctx.strokeStyle = '#dadada';
    ctx.lineWidth = 1;
    const tx = 8 + 18 * Math.cos(-Math.PI * 0.45);
    const ty1 = 18 * Math.sin(-Math.PI * 0.45);
    const ty2 = 18 * Math.sin(Math.PI * 0.45);
    ctx.beginPath();
    ctx.moveTo(tx, ty1);
    ctx.lineTo(8 - pull, 0);
    ctx.lineTo(tx, ty2);
    ctx.stroke();
  } else if (w.id === 'hammer') {
    const angle = swinging
      ? -Math.PI * 0.75 + swingProgress * Math.PI * 1.4
      : Math.PI * 0.0;
    ctx.rotate(angle);
    // Shaft
    const sgrad = ctx.createLinearGradient(0, -4, 0, 4);
    sgrad.addColorStop(0, '#5a3a1a');
    sgrad.addColorStop(1, '#2a1a08');
    ctx.fillStyle = sgrad;
    ctx.fillRect(0, -4, 44, 8);
    // Wraps
    ctx.fillStyle = '#1a0a04';
    ctx.fillRect(8, -4, 2, 8);
    ctx.fillRect(20, -4, 2, 8);
    // Head
    const hgrad = ctx.createLinearGradient(0, -16, 0, 16);
    hgrad.addColorStop(0, '#6a6a72');
    hgrad.addColorStop(0.5, '#4a4a52');
    hgrad.addColorStop(1, '#2a2a30');
    ctx.fillStyle = hgrad;
    roundRect(38, -18, 26, 36, 4);
    ctx.fill();
    // Highlight edge
    ctx.fillStyle = '#9a9aa2';
    ctx.fillRect(38, -18, 4, 36);
    // Spikes
    ctx.fillStyle = '#3a3a40';
    ctx.beginPath();
    ctx.moveTo(64, -10); ctx.lineTo(72, 0); ctx.lineTo(64, 10); ctx.closePath();
    ctx.fill();
    // Pommel
    ctx.fillStyle = '#8a6020';
    ctx.beginPath();
    ctx.arc(-4, 0, 5, 0, TAU);
    ctx.fill();
    if (swinging) drawSwingArc(0, 0, 60, swingProgress, '#cccccc');
  }

  ctx.restore();
}

function drawSwingArc(cx, cy, r, progress, color) {
  ctx.save();
  ctx.globalAlpha = (1 - progress) * 0.6;
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(cx, cy, r, -0.7 + progress * 1.0, -0.7 + progress * 1.7);
  ctx.stroke();
  ctx.restore();
}

// ============ Enemies ============
function drawEnemy(e) {
  const x = sX(e.x), y = e.y;
  const bob = Math.sin(e.bobble) * (e.type.flying ? 7 : 2);
  const dying = e.dead;
  const alpha = dying ? Math.max(0, e.deathTimer / 0.4) : 1;

  ctx.save();
  ctx.globalAlpha = alpha;

  if (!dying) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.ellipse(x, y + 4, e.w * 0.5, 5, 0, 0, TAU);
    ctx.fill();
  }

  ctx.translate(x, y + bob);

  if (e.typeId === 'skeleton') drawSkeleton(e);
  else if (e.typeId === 'bat') drawBat(e);
  else if (e.typeId === 'brute') drawBrute(e);

  ctx.restore();

  if (!dying && e.hp < e.maxHp) {
    const bw = e.w + 8;
    const bx = x - bw / 2;
    const by = y - e.h - 14;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(bx, by, bw, 4);
    ctx.fillStyle = '#cc3030';
    ctx.fillRect(bx, by, bw * (e.hp / e.maxHp), 4);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.strokeRect(bx, by, bw, 4);
  }
}

function drawSkeleton(e) {
  const flash = e.flash > 0;
  const walk = Math.sin(e.walkPhase) * 3;
  // Legs
  ctx.fillStyle = flash ? '#ffffff' : '#b8b0a0';
  ctx.fillRect(-7, -28, 5, 28);
  ctx.fillRect(2, -28, 5, 28 - Math.abs(walk));
  // Pelvis
  ctx.fillStyle = flash ? '#ffffff' : '#c8c0ac';
  ctx.fillRect(-9, -34, 18, 8);
  // Ribcage
  ctx.fillStyle = flash ? '#ffffff' : e.type.color;
  roundRect(-10, -e.h + 12, 20, e.h - 46, 3);
  ctx.fill();
  // Ribs (curves)
  ctx.strokeStyle = flash ? '#ffeeee' : '#7a7060';
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 4; i++) {
    const ry = -e.h + 16 + i * 7;
    ctx.beginPath();
    ctx.moveTo(-9, ry);
    ctx.quadraticCurveTo(0, ry + 3, 9, ry);
    ctx.stroke();
  }
  // Spine
  ctx.fillStyle = flash ? '#ffffff' : '#a89878';
  ctx.fillRect(-1, -e.h + 14, 2, e.h - 48);
  // Arms holding rusted sword
  ctx.fillStyle = flash ? '#ffffff' : '#c8c0ac';
  ctx.fillRect(-14, -e.h + 18, 4, 22);
  ctx.fillRect(10, -e.h + 18, 4, 22);
  // Sword (rusted)
  ctx.save();
  ctx.translate(12, -e.h + 26);
  ctx.rotate(0.3);
  ctx.fillStyle = '#3a2a18';
  ctx.fillRect(0, -2, 6, 4);
  ctx.fillStyle = flash ? '#ffeeaa' : '#8a7e60';
  ctx.fillRect(6, -1, 18, 3);
  ctx.fillStyle = '#5a4830';
  ctx.fillRect(8, -1, 14, 1);
  ctx.restore();
  // Skull
  ctx.fillStyle = flash ? '#ffffff' : '#ece4d0';
  ctx.beginPath();
  ctx.arc(0, -e.h + 8, 12, 0, TAU);
  ctx.fill();
  // Jaw
  ctx.fillStyle = flash ? '#ffffff' : '#dcd4c0';
  ctx.fillRect(-6, -e.h + 14, 12, 4);
  // Teeth
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 1;
  for (let i = -5; i < 6; i += 2) {
    ctx.beginPath();
    ctx.moveTo(i, -e.h + 14);
    ctx.lineTo(i, -e.h + 18);
    ctx.stroke();
  }
  // Eye sockets (glowing red)
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.arc(-5, -e.h + 6, 3, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(5, -e.h + 6, 3, 0, TAU); ctx.fill();
  // Glow
  const glowGrad = ctx.createRadialGradient(0, -e.h + 6, 1, 0, -e.h + 6, 16);
  glowGrad.addColorStop(0, 'rgba(255, 50, 50, 0.4)');
  glowGrad.addColorStop(1, 'rgba(255, 50, 50, 0)');
  ctx.fillStyle = glowGrad;
  ctx.fillRect(-16, -e.h - 4, 32, 16);
  ctx.fillStyle = '#ff5050';
  ctx.beginPath(); ctx.arc(-5, -e.h + 6, 1.5, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(5, -e.h + 6, 1.5, 0, TAU); ctx.fill();
  // Crack on skull
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-3, -e.h + 1);
  ctx.lineTo(2, -e.h + 5);
  ctx.lineTo(0, -e.h + 9);
  ctx.stroke();
}

function drawBat(e) {
  const flash = e.flash > 0;
  const flap = Math.sin(e.bobble * 3) * 0.8;
  // Wings
  ctx.fillStyle = flash ? '#ffaaaa' : '#1a1020';
  // Left wing
  ctx.beginPath();
  ctx.moveTo(0, -e.h * 0.45);
  ctx.quadraticCurveTo(-30, -e.h * 0.45 - 8 + flap * 12, -36, -e.h * 0.4 + flap * 8);
  ctx.quadraticCurveTo(-26, -e.h * 0.3 - flap * 4, -16, -e.h * 0.35);
  ctx.quadraticCurveTo(-22, -e.h * 0.25, 0, -e.h * 0.3);
  ctx.fill();
  // Right wing
  ctx.beginPath();
  ctx.moveTo(0, -e.h * 0.45);
  ctx.quadraticCurveTo(30, -e.h * 0.45 - 8 + flap * 12, 36, -e.h * 0.4 + flap * 8);
  ctx.quadraticCurveTo(26, -e.h * 0.3 - flap * 4, 16, -e.h * 0.35);
  ctx.quadraticCurveTo(22, -e.h * 0.25, 0, -e.h * 0.3);
  ctx.fill();
  // Wing membranes (lines)
  ctx.strokeStyle = 'rgba(80, 30, 100, 0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, -e.h * 0.4);
  ctx.lineTo(-30, -e.h * 0.4 + flap * 6);
  ctx.moveTo(0, -e.h * 0.4);
  ctx.lineTo(30, -e.h * 0.4 + flap * 6);
  ctx.stroke();
  // Body
  const bgrad = ctx.createRadialGradient(0, -e.h * 0.45, 2, 0, -e.h * 0.45, 12);
  bgrad.addColorStop(0, flash ? '#ffaaaa' : '#5a3a6a');
  bgrad.addColorStop(1, flash ? '#ffffff' : '#2a1a3a');
  ctx.fillStyle = bgrad;
  ctx.beginPath();
  ctx.ellipse(0, -e.h * 0.45, 11, 13, 0, 0, TAU);
  ctx.fill();
  // Ears
  ctx.fillStyle = flash ? '#ffaaaa' : '#1a0a20';
  ctx.beginPath();
  ctx.moveTo(-7, -e.h * 0.6); ctx.lineTo(-9, -e.h * 0.75); ctx.lineTo(-3, -e.h * 0.6); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(7, -e.h * 0.6);  ctx.lineTo(9, -e.h * 0.75);  ctx.lineTo(3, -e.h * 0.6);  ctx.fill();
  // Eyes (red glow)
  ctx.fillStyle = '#ff3030';
  ctx.fillRect(-5, -e.h * 0.5, 3, 3);
  ctx.fillRect(2, -e.h * 0.5, 3, 3);
  ctx.fillStyle = '#ffaaaa';
  ctx.fillRect(-4, -e.h * 0.5, 1, 1);
  ctx.fillRect(3, -e.h * 0.5, 1, 1);
  // Fangs
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(-3, -e.h * 0.38); ctx.lineTo(-2, -e.h * 0.32); ctx.lineTo(-1, -e.h * 0.38); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(1, -e.h * 0.38);  ctx.lineTo(2, -e.h * 0.32);  ctx.lineTo(3, -e.h * 0.38);  ctx.fill();
}

function drawBrute(e) {
  const flash = e.flash > 0;
  const walk = Math.sin(e.walkPhase) * 4;
  // Legs (thick)
  ctx.fillStyle = flash ? '#ffaaaa' : '#2a0a0a';
  ctx.fillRect(-12, -28, 10, 28);
  ctx.fillRect(2, -28, 10, 28 - Math.abs(walk));
  // Body
  const bgrad = ctx.createLinearGradient(0, -e.h, 0, -28);
  bgrad.addColorStop(0, flash ? '#ffffff' : e.type.color);
  bgrad.addColorStop(1, flash ? '#ffaaaa' : e.type.accent);
  ctx.fillStyle = bgrad;
  roundRect(-e.w/2 + 4, -e.h + 14, e.w - 8, e.h - 42, 8);
  ctx.fill();
  // Belly highlight
  ctx.fillStyle = flash ? '#ffd0d0' : '#7a3030';
  ctx.beginPath();
  ctx.ellipse(0, -36, 12, 16, 0, 0, TAU);
  ctx.fill();
  // Pauldrons (spiked)
  ctx.fillStyle = flash ? '#ffaaaa' : '#1a0808';
  ctx.beginPath();
  ctx.arc(-e.w/2 + 6, -e.h + 22, 14, 0, TAU);
  ctx.arc(e.w/2 - 6, -e.h + 22, 14, 0, TAU);
  ctx.fill();
  // Spikes on pauldrons
  ctx.fillStyle = '#3a1010';
  for (const side of [-1, 1]) {
    for (let i = -1; i <= 1; i++) {
      const sx = side * (e.w/2 - 6) + i * 6;
      ctx.beginPath();
      ctx.moveTo(sx - 2, -e.h + 14);
      ctx.lineTo(sx, -e.h + 4);
      ctx.lineTo(sx + 2, -e.h + 14);
      ctx.closePath();
      ctx.fill();
    }
  }
  // Arms
  ctx.fillStyle = flash ? '#ffaaaa' : '#3a1818';
  ctx.fillRect(-e.w/2 - 2, -e.h + 28, 8, 26);
  ctx.fillRect(e.w/2 - 6, -e.h + 28, 8, 26);
  // Fists
  ctx.fillStyle = flash ? '#ffaaaa' : '#5a2828';
  ctx.beginPath();
  ctx.arc(-e.w/2 + 2, -e.h + 56, 7, 0, TAU);
  ctx.arc(e.w/2 - 2, -e.h + 56, 7, 0, TAU);
  ctx.fill();
  // Chains on wrists
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-e.w/2 + 2, -e.h + 50);
  ctx.lineTo(-e.w/2 + 2, -e.h + 60);
  ctx.moveTo(e.w/2 - 2, -e.h + 50);
  ctx.lineTo(e.w/2 - 2, -e.h + 60);
  ctx.stroke();
  // Head
  ctx.fillStyle = flash ? '#ffffff' : '#2a0a0a';
  ctx.beginPath();
  ctx.arc(0, -e.h + 6, 16, 0, TAU);
  ctx.fill();
  // Snout
  ctx.fillStyle = flash ? '#ffaaaa' : '#1a0606';
  ctx.beginPath();
  ctx.ellipse(0, -e.h + 14, 9, 6, 0, 0, TAU);
  ctx.fill();
  // Horns (massive curved)
  ctx.fillStyle = '#0a0404';
  ctx.beginPath();
  ctx.moveTo(-12, -e.h + 4);
  ctx.quadraticCurveTo(-26, -e.h - 4, -22, -e.h - 18);
  ctx.quadraticCurveTo(-14, -e.h - 6, -8, -e.h);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(12, -e.h + 4);
  ctx.quadraticCurveTo(26, -e.h - 4, 22, -e.h - 18);
  ctx.quadraticCurveTo(14, -e.h - 6, 8, -e.h);
  ctx.closePath();
  ctx.fill();
  // Horn highlights
  ctx.fillStyle = '#3a1a1a';
  ctx.fillRect(-22, -e.h - 14, 2, 8);
  ctx.fillRect(20, -e.h - 14, 2, 8);
  // Eyes (yellow glow)
  const glow = ctx.createRadialGradient(0, -e.h + 6, 1, 0, -e.h + 6, 18);
  glow.addColorStop(0, 'rgba(255, 180, 40, 0.5)');
  glow.addColorStop(1, 'rgba(255, 180, 40, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(-18, -e.h - 4, 36, 18);
  ctx.fillStyle = '#ffaa00';
  ctx.fillRect(-7, -e.h + 4, 4, 3);
  ctx.fillRect(3, -e.h + 4, 4, 3);
  ctx.fillStyle = '#fff';
  ctx.fillRect(-6, -e.h + 4, 1, 1);
  ctx.fillRect(4, -e.h + 4, 1, 1);
  // Tusks
  ctx.fillStyle = '#e8e0c0';
  ctx.beginPath();
  ctx.moveTo(-5, -e.h + 16); ctx.lineTo(-4, -e.h + 22); ctx.lineTo(-3, -e.h + 16); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(5, -e.h + 16);  ctx.lineTo(4, -e.h + 22);  ctx.lineTo(3, -e.h + 16);  ctx.fill();
}

// ============ Coin ============
function drawCoin(c) {
  const x = sX(c.x), y = c.y;
  const bob = Math.sin(game.t * 6 + c.x) * 1.5;
  const wobble = Math.cos(c.spin) * 0.7 + 0.3; // 0.3 - 1.0 (perceived width)

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.ellipse(x, c.groundY + 4, 5, 1.5, 0, 0, TAU);
  ctx.fill();

  ctx.save();
  ctx.translate(x, y - 4 + bob);
  ctx.scale(wobble, 1);

  // Outer rim
  ctx.fillStyle = '#aa6010';
  ctx.beginPath();
  ctx.arc(0, 0, 7, 0, TAU);
  ctx.fill();

  // Body
  const grad = ctx.createRadialGradient(-1.5, -1.5, 1, 0, 0, 6);
  grad.addColorStop(0, '#fff5b0');
  grad.addColorStop(0.5, '#ffd040');
  grad.addColorStop(1, '#a87010');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, 5.5, 0, TAU);
  ctx.fill();

  // Star marking
  ctx.fillStyle = '#a85020';
  ctx.fillRect(-2, -0.8, 4, 1.6);
  ctx.fillRect(-0.8, -2, 1.6, 4);

  ctx.restore();

  // Glow
  const glow = ctx.createRadialGradient(x, y - 4 + bob, 1, x, y - 4 + bob, 14);
  glow.addColorStop(0, 'rgba(255, 220, 100, 0.25)');
  glow.addColorStop(1, 'rgba(255, 220, 100, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - 14, y - 18 + bob, 28, 28);
}

// ============ Projectiles ============
function drawProjectiles() {
  for (const pr of game.projectiles) {
    if (pr.kind === 'arrow') {
      const x = sX(pr.x), y = pr.y;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.atan2(pr.vy, pr.vx));
      // Trail
      ctx.fillStyle = 'rgba(255, 200, 120, 0.35)';
      ctx.beginPath();
      ctx.ellipse(-12, 0, 16, 1.5, 0, 0, TAU);
      ctx.fill();
      // Shaft
      ctx.fillStyle = '#7a5a3a';
      ctx.fillRect(-14, -1, 24, 2);
      // Tip
      ctx.fillStyle = '#e8dcb0';
      ctx.beginPath();
      ctx.moveTo(10, -3); ctx.lineTo(18, 0); ctx.lineTo(10, 3); ctx.closePath();
      ctx.fill();
      // Fletching
      ctx.fillStyle = '#b04040';
      ctx.beginPath();
      ctx.moveTo(-14, 0); ctx.lineTo(-20, -3); ctx.lineTo(-14, -1); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-14, 0); ctx.lineTo(-20, 3); ctx.lineTo(-14, 1); ctx.fill();
      ctx.restore();
    }
  }
}

// ============ Particles, dmg nums, torch overlay ============
function drawParticles() {
  for (const p of game.particles) {
    const a = p.life / p.maxLife;
    ctx.fillStyle = p.color;
    ctx.globalAlpha = a;
    ctx.beginPath();
    ctx.arc(sX(p.x), p.y, p.size * a + 0.5, 0, TAU);
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
  const grad = ctx.createRadialGradient(cx, cy, 80, cx, cy, Math.max(W, H) * 0.7);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
  grad.addColorStop(0.4, 'rgba(0, 0, 0, 0.35)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.85)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
  const warm = ctx.createRadialGradient(cx, cy, 20, cx, cy, 220);
  warm.addColorStop(0, 'rgba(255, 100, 50, 0.18)');
  warm.addColorStop(1, 'rgba(255, 100, 50, 0)');
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
  shopModal.classList.remove('visible');
  game.running = true;
  game.paused = false;
  game.player = makePlayer();
  game.enemies = [];
  game.projectiles = [];
  game.particles = [];
  game.embers = [];
  game.damageNums = [];
  game.pickups = [];
  game.cameraX = 0;
  game.spawnTimer = 1.5;
  game.kills = 0;
  game.coins = 0;
  game.weaponIndex = 0;
  game.upgrades = {
    damageMul: 1,
    speedMul: 1,
    weaponBonus: { sword: 1, bow: 1, hammer: 1 },
    purchased: new Set(),
  };
  killsEl.textContent = '☠ 0';
  coinsEl.textContent = '⛁ 0';
  hpBar.style.width = '100%';
  hpText.textContent = '100/100';
  updateWeaponUI();
}

function gameOver() {
  game.running = false;
  game.paused = false;
  shopModal.classList.remove('visible');
  overlay.querySelector('h1').textContent = 'Tu es tombé';
  overlay.querySelector('.subtitle').textContent =
    `${game.kills} ennemis · ${Math.floor(game.cameraX / 50)} m · ${game.coins} pièces`;
  startBtn.textContent = 'Recommencer';
  overlay.classList.add('visible');
}

startBtn.addEventListener('click', startGame);
updateWeaponUI();
requestAnimationFrame(loop);
})();
