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
const stageEl = document.getElementById('stage-indicator');
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
const bossBar = document.getElementById('boss-bar');
const bossNameEl = document.getElementById('boss-name');
const bossHpEl = document.getElementById('boss-hp');
const bossIntro = document.getElementById('boss-intro');
const bossIntroName = bossIntro.querySelector('.boss-intro-name');
const bossIntroSub = bossIntro.querySelector('.boss-intro-sub');
const stageToast = document.getElementById('stage-toast');
const stageToastTitle = stageToast.querySelector('.stage-toast-title');
const stageToastSub = stageToast.querySelector('.stage-toast-sub');
const pauseBtn = document.getElementById('pause-btn');
const muteBtn = document.getElementById('mute-btn');
const pauseModal = document.getElementById('pause-modal');
const pauseResume = document.getElementById('pause-resume');
const pauseQuit = document.getElementById('pause-quit');
const challengeInput = document.getElementById('challenge-input');
const forgeBtn = document.getElementById('forge-btn');
const forgeModal = document.getElementById('forge-modal');
const forgeClose = document.getElementById('forge-close');
const forgeList = document.getElementById('forge-list');
const forgeEssenceEl = document.getElementById('forge-essence');
const essenceCountEl = document.getElementById('essence-count');

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

// ============ Audio (procedural Web Audio) ============
const audio = (() => {
  let ctx = null, masterGain = null, muted = false;

  function ensureCtx() {
    if (!ctx) {
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = ctx.createGain();
        masterGain.gain.value = 0.35;
        masterGain.connect(ctx.destination);
      } catch (e) { return false; }
    }
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }

  function noiseBuffer(duration) {
    const sr = ctx.sampleRate;
    const buf = ctx.createBuffer(1, Math.max(1, Math.floor(sr * duration)), sr);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    return buf;
  }

  function tone({ freq = 440, duration = 0.1, volume = 0.3, type = 'square', sweepTo = null, filter = null, delay = 0 }) {
    if (muted || !ensureCtx()) return;
    const t = ctx.currentTime + delay;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(volume, t + 0.005);
    env.gain.exponentialRampToValueAtTime(0.001, t + duration);
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (sweepTo !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, sweepTo), t + duration);
    let outNode = env;
    osc.connect(env);
    if (filter) {
      const f = ctx.createBiquadFilter();
      f.type = filter.type || 'lowpass';
      f.frequency.value = filter.freq || 1000;
      f.Q.value = filter.q || 1;
      env.connect(f);
      outNode = f;
    }
    outNode.connect(masterGain);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  function noise({ duration = 0.1, volume = 0.3, filter = null, delay = 0 }) {
    if (muted || !ensureCtx()) return;
    const t = ctx.currentTime + delay;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(volume, t + 0.005);
    env.gain.exponentialRampToValueAtTime(0.001, t + duration);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(duration);
    src.connect(env);
    let outNode = env;
    if (filter) {
      const f = ctx.createBiquadFilter();
      f.type = filter.type || 'bandpass';
      f.frequency.value = filter.freq || 1000;
      f.Q.value = filter.q || 1;
      env.connect(f);
      outNode = f;
    }
    outNode.connect(masterGain);
    src.start(t);
    src.stop(t + duration + 0.05);
  }

  // Pre-defined SFX
  return {
    ensure: ensureCtx,
    setMuted(m) { muted = m; },
    isMuted() { return muted; },

    swing()    { noise({ duration: 0.12, volume: 0.18, filter: { type: 'bandpass', freq: 2000, q: 0.8 } }); },
    swingHeavy(){ noise({ duration: 0.22, volume: 0.30, filter: { type: 'bandpass', freq: 700, q: 0.6 } }); },
    swingFast(){ noise({ duration: 0.06, volume: 0.14, filter: { type: 'highpass', freq: 3000 } }); },
    arrowShoot(){ tone({ freq: 1400, sweepTo: 600, duration: 0.10, volume: 0.18, type: 'triangle' }); noise({ duration: 0.08, volume: 0.08, filter: { type: 'highpass', freq: 4000 } }); },
    hit()      { tone({ freq: 240, sweepTo: 90, duration: 0.10, volume: 0.30, type: 'square' }); noise({ duration: 0.06, volume: 0.18, filter: { type: 'lowpass', freq: 800 } }); },
    hitBig()   { tone({ freq: 90, sweepTo: 40, duration: 0.30, volume: 0.45, type: 'sawtooth' }); noise({ duration: 0.18, volume: 0.25, filter: { type: 'lowpass', freq: 300 } }); },
    enemyDie() { tone({ freq: 200, sweepTo: 80, duration: 0.25, volume: 0.30, type: 'sawtooth' }); },
    bossDie()  { tone({ freq: 200, sweepTo: 50, duration: 1.4, volume: 0.5, type: 'sawtooth' }); tone({ freq: 80, sweepTo: 30, duration: 1.4, volume: 0.4, type: 'square', delay: 0.05 }); },
    coin()     { tone({ freq: 1500, duration: 0.06, volume: 0.18, type: 'sine' }); tone({ freq: 2200, duration: 0.08, volume: 0.14, type: 'sine', delay: 0.04 }); },
    hurt()     { tone({ freq: 320, sweepTo: 120, duration: 0.22, volume: 0.40, type: 'sawtooth' }); noise({ duration: 0.12, volume: 0.20, filter: { type: 'lowpass', freq: 600 } }); },
    death()    { tone({ freq: 240, sweepTo: 50, duration: 1.0, volume: 0.5, type: 'sawtooth' }); },
    bossSpawn(){ tone({ freq: 60, duration: 1.2, volume: 0.5, type: 'sawtooth' }); tone({ freq: 120, duration: 1.2, volume: 0.3, type: 'square', delay: 0.1 }); },
    click()    { tone({ freq: 700, duration: 0.04, volume: 0.18, type: 'square' }); },
    purchase() { tone({ freq: 800, duration: 0.07, volume: 0.20, type: 'sine' }); tone({ freq: 1200, duration: 0.10, volume: 0.16, type: 'sine', delay: 0.06 }); },
    levelUp()  { tone({ freq: 600, duration: 0.10, volume: 0.30, type: 'triangle' }); tone({ freq: 900, duration: 0.10, volume: 0.30, type: 'triangle', delay: 0.08 }); tone({ freq: 1300, duration: 0.18, volume: 0.30, type: 'triangle', delay: 0.18 }); },
  };
})();

// ============ Persistent best run ============
const SAVE_KEY = 'shadowcrawl-best';
function loadBestRun() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return { stage: 0, distance: 0, kills: 0, coins: 0, bossesDefeated: 0 };
    const parsed = JSON.parse(raw);
    return {
      stage: parsed.stage || 0,
      distance: parsed.distance || 0,
      kills: parsed.kills || 0,
      coins: parsed.coins || 0,
      bossesDefeated: parsed.bossesDefeated || 0,
    };
  } catch { return { stage: 0, distance: 0, kills: 0, coins: 0, bossesDefeated: 0 }; }
}
function saveBestRun(stats) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(stats)); } catch {}
}
function updateBestRun(current) {
  const best = loadBestRun();
  const newBest = {
    stage:           Math.max(best.stage, current.stage),
    distance:        Math.max(best.distance, current.distance),
    kills:           Math.max(best.kills, current.kills),
    coins:           Math.max(best.coins, current.coins),
    bossesDefeated:  Math.max(best.bossesDefeated, current.bossesDefeated),
  };
  saveBestRun(newBest);
  return newBest;
}

// ============ Forge (persistent equipment) ============
const FORGE_KEY = 'shadowcrawl-forge';
const HELM_HP    = [0, 25, 60, 120];     // tier 0..3
const ARMOR_DR   = [0, 0.08, 0.16, 0.25];
const RING_DMG   = [1, 1.10, 1.20, 1.35];

const FORGE_TIERS = [
  // helmet
  { slot: 'helmet', tier: 1, name: 'Casque de bronze',  desc: '+25 PV max',  cost: 15,  icon: '🪖' },
  { slot: 'helmet', tier: 2, name: 'Heaume d\'argent',  desc: '+60 PV max',  cost: 45,  icon: '🪖' },
  { slot: 'helmet', tier: 3, name: 'Couronne d\'or',    desc: '+120 PV max', cost: 110, icon: '👑' },
  // armor
  { slot: 'armor',  tier: 1, name: 'Cotte de bronze',   desc: '-8% dégâts subis',   cost: 18,  icon: '🥉' },
  { slot: 'armor',  tier: 2, name: 'Plates d\'argent',  desc: '-16% dégâts subis',  cost: 50,  icon: '🥈' },
  { slot: 'armor',  tier: 3, name: 'Armure d\'or',      desc: '-25% dégâts subis',  cost: 130, icon: '🥇' },
  // ring
  { slot: 'ring',   tier: 1, name: 'Anneau de bronze',  desc: '+10% dégâts',  cost: 22,  icon: '💍' },
  { slot: 'ring',   tier: 2, name: 'Anneau d\'argent',  desc: '+20% dégâts',  cost: 60,  icon: '💍' },
  { slot: 'ring',   tier: 3, name: 'Anneau d\'or',      desc: '+35% dégâts',  cost: 150, icon: '💎' },
];

const SLOT_LABELS = { helmet: 'Casque', armor: 'Armure', ring: 'Anneau' };

function loadForge() {
  try {
    const raw = localStorage.getItem(FORGE_KEY);
    if (!raw) return { essences: 0, helmet: 0, armor: 0, ring: 0 };
    const parsed = JSON.parse(raw);
    return {
      essences: parsed.essences || 0,
      helmet: parsed.helmet || 0,
      armor: parsed.armor || 0,
      ring: parsed.ring || 0,
    };
  } catch { return { essences: 0, helmet: 0, armor: 0, ring: 0 }; }
}

function saveForge(state) {
  try { localStorage.setItem(FORGE_KEY, JSON.stringify(state)); } catch {}
}

function gainEssences(coins) {
  const gained = Math.floor(coins / 30);
  if (gained <= 0) return 0;
  const f = loadForge();
  f.essences += gained;
  saveForge(f);
  return gained;
}

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

addPress(attackBtn, () => { input.attack = true; }, () => { input.attack = false; });
addPress(weaponBtn, () => { input.switchWeapon = true; }, null);

// ============ Weapons ============
const WEAPONS = [
  { id: 'sword',      name: 'Épée',          icon: '⚔', cooldown: 0.32, range: 75,  arc: 0.7, damage: 25, knockback: 80,  color: '#d8d4c0', swingTime: 0.18, type: 'melee' },
  { id: 'bow',        name: 'Arc',           icon: '🏹', cooldown: 0.55, damage: 22, knockback: 50, color: '#a08660', swingTime: 0.12, type: 'ranged', projectileSpeed: 760 },
  { id: 'hammer',     name: 'Marteau',       icon: '🔨', cooldown: 0.95, range: 95,  arc: 1.0, damage: 65, knockback: 220, color: '#7a5a3a', swingTime: 0.34, type: 'melee' },
  { id: 'dagger',     name: 'Dague',         icon: '🗡', cooldown: 0.18, range: 55,  arc: 0.6, damage: 14, knockback: 30,  color: '#c8c0d8', swingTime: 0.08, type: 'melee' },
  { id: 'spear',      name: 'Lance',         icon: '🔱', cooldown: 0.42, range: 115, arc: 0.35, damage: 38, knockback: 110, color: '#a8a0b0', swingTime: 0.16, type: 'melee' },
  { id: 'magicSword', name: 'Épée mystique', icon: '✨', cooldown: 0.45, range: 75,  arc: 0.7, damage: 30, knockback: 90,  color: '#80c0ff', swingTime: 0.20, type: 'melee', slashWave: true },
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
  stage: 1,
  bossActive: false,
  boss: null,
  bossNextAt: 250,           // distance in meters for next boss spawn
  challengeMode: false,      // disables auto-scroll, ×1.5 coins
  pauseFromMenu: false,      // pause triggered by pause button (vs shop)
  bossesDefeated: 0,
  unlockedWeapons: null,     // Set, set in startGame
  upgrades: {
    damageMul: 1,
    speedMul: 1,
    weaponBonus: { sword: 1, bow: 1, hammer: 1, dagger: 1, spear: 1, magicSword: 1 },
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
    // Apply hit using arc width (narrow arc = line-like, wide arc = wide swing)
    const cx = p.x + p.facing * (w.range * 0.45);
    const cy = p.y - 10;
    const arcRadius = w.range;
    const widthScale = w.arc < 0.5 ? 0.55 : 1.0; // narrow weapons hit narrower vertical band
    for (const e of game.enemies) {
      if (e.dead) continue;
      const dx = (e.x - p.x) * p.facing;
      if (dx < -10) continue;
      const ddx = e.x - cx;
      const ddy = (e.y - cy) / widthScale;
      if (ddx*ddx + ddy*ddy < (arcRadius + e.r) * (arcRadius + e.r)) {
        damageEnemy(e, dmg, p.facing * w.knockback);
      }
    }
    spawnSwingParticles(p, w);
    if (w.id === 'hammer') audio.swingHeavy();
    else if (w.id === 'dagger') audio.swingFast();
    else audio.swing();
    if (w.slashWave) {
      // Spawn forward slash wave projectile
      game.projectiles.push({
        kind: 'slashWave',
        x: p.x + p.facing * 36,
        y: p.y - p.h * 0.5,
        vx: p.facing * 540,
        vy: 0,
        damage: dmg * 0.7,
        knockback: w.knockback * 0.6,
        life: 0.7,
        friendly: true,
        facing: p.facing,
        wobble: Math.random() * TAU,
      });
    }
    game.shake = Math.max(game.shake, w.id === 'hammer' ? 16 : (w.id === 'dagger' ? 2 : 5));
  } else if (w.type === 'ranged') {
    game.projectiles.push({
      kind: 'arrow',
      x: p.x + p.facing * 28,
      y: p.y - p.h * 0.45,
      vx: p.facing * w.projectileSpeed,
      vy: 0,
      damage: dmg,
      knockback: w.knockback,
      life: 1.4,
      friendly: true,
    });
    audio.arrowShoot();
    game.shake = Math.max(game.shake, 3);
  }
}

function spawnSwingParticles(p, w) {
  const n = w.id === 'hammer' ? 18 : (w.id === 'dagger' ? 4 : 10);
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
    hp: 65, speed: 105, damage: 14,
    color: '#d8d0bc', accent: '#5a3a3a',
    coinDrop: [4, 7],
    contactCooldown: 0.8,
    skill: { name: 'lunge', cooldown: [3.5, 5.5], range: 110, windup: 0.35, dashSpeed: 360, dashTime: 0.25 },
  },
  bat: {
    w: 32, h: 26, r: 20,
    hp: 30, speed: 195, damage: 10,
    color: '#3a2a4a', accent: '#7a3a8a',
    coinDrop: [2, 4],
    contactCooldown: 0.55,
    flying: true,
    skill: { name: 'dive', cooldown: [3.5, 5.5], range: 280, diveSpeed: 380, diveTime: 0.55 },
  },
  brute: {
    w: 56, h: 78, r: 34,
    hp: 220, speed: 80, damage: 36,
    color: '#5a2a2a', accent: '#3a1010',
    coinDrop: [14, 22],
    contactCooldown: 1.0,
    skill: { name: 'slam', cooldown: [4.5, 6.5], range: 130, windup: 0.7, aoeRadius: 140, slamDamage: 42 },
  },
  goblin: {
    w: 30, h: 46, r: 19,
    hp: 50, speed: 150, damage: 12,
    color: '#3a6a3a', accent: '#1a3a1a',
    coinDrop: [5, 10],
    contactCooldown: 0.65,
    throwCooldown: [1.8, 3.4],
    preferredDist: 150,
    skill: { name: 'roll', cooldown: [2.5, 4.5], rollTime: 0.4, rollSpeed: 280, iframes: 0.4 },
  },
  wraith: {
    w: 38, h: 60, r: 24,
    hp: 70, speed: 140, damage: 22,
    color: '#403060', accent: '#a060c0',
    coinDrop: [8, 14],
    contactCooldown: 0.85,
    flying: true,
    ghostly: true,
    skill: { name: 'blink', cooldown: [4, 6] },
  },
  armored: {
    w: 46, h: 68, r: 28,
    hp: 340, speed: 70, damage: 30,
    color: '#5a5a6a', accent: '#2a2a3a',
    coinDrop: [18, 30],
    contactCooldown: 1.1,
    armor: 0.5,
    skill: { name: 'shieldBash', cooldown: [4.5, 6.5], range: 150, windup: 0.45, dashSpeed: 400, dashTime: 0.3, bashDamage: 38 },
  },
};

const BOSSES = {
  liche: {
    bossId: 'liche',
    name: 'La Liche',
    w: 50, h: 86, r: 32,
    hp: 600, speed: 70, damage: 18,
    coinDrop: [80, 130],
    contactCooldown: 1.0,
    color: '#2a1a3a', accent: '#80c0f0',
    isBoss: true,
  },
  champion: {
    bossId: 'champion',
    name: 'Le Champion d\'Acier',
    w: 64, h: 92, r: 38,
    hp: 1100, speed: 90, damage: 28,
    coinDrop: [140, 200],
    contactCooldown: 1.0,
    color: '#5a5a62', accent: '#aa7030',
    isBoss: true,
  },
  dragon: {
    bossId: 'dragon',
    name: 'Le Dragon des Ombres',
    w: 90, h: 70, r: 44,
    hp: 1800, speed: 140, damage: 32,
    coinDrop: [220, 320],
    contactCooldown: 1.2,
    color: '#3a1010', accent: '#ff6020',
    isBoss: true,
    flying: true,
  },
  necromancer: {
    bossId: 'necromancer',
    name: 'Le Nécromancien',
    w: 50, h: 86, r: 32,
    hp: 1400, speed: 65, damage: 22,
    coinDrop: [200, 280],
    contactCooldown: 1.0,
    color: '#1a3a2a', accent: '#80ffaa',
    isBoss: true,
  },
  golem: {
    bossId: 'golem',
    name: 'Le Golem de Pierre',
    w: 84, h: 102, r: 44,
    hp: 2400, speed: 55, damage: 38,
    coinDrop: [280, 380],
    contactCooldown: 1.2,
    color: '#5a4a3a', accent: '#d8b870',
    isBoss: true,
  },
};

const BOSS_ORDER = ['liche', 'champion', 'dragon', 'necromancer', 'golem'];

function spawnEnemy(typeId, x, y) {
  const t = ENEMY_TYPES[typeId];
  const stage = game.stage;
  // Per-stage scaling — harder enemies as you progress (with caps)
  const stageHpMul    = 1 + Math.min(1.8, (stage - 1) * 0.20);
  const stageSpeedMul = 1 + Math.min(0.5, (stage - 1) * 0.10);
  const stageDmgMul   = 1 + Math.min(1.0, (stage - 1) * 0.15);

  // Elite chance: 0% at stage 1, +12% at stage 2, +5% per stage after, capped
  const eliteChance = stage >= 2 ? Math.min(0.35, 0.12 + (stage - 2) * 0.05) : 0;
  const isElite = Math.random() < eliteChance;

  const eliteHpMul    = isElite ? 2.0  : 1;
  const eliteSpeedMul = isElite ? 1.25 : 1;
  const eliteDmgMul   = isElite ? 1.5  : 1;
  const eliteScale    = isElite ? 1.18 : 1;

  const baseHp = Math.round(t.hp * stageHpMul * eliteHpMul);

  const e = {
    typeId, type: t,
    x, y,
    w: t.w * eliteScale,
    h: t.h * eliteScale,
    r: t.r * eliteScale,
    hp: baseHp, maxHp: baseHp,
    speed: t.speed * stageSpeedMul * eliteSpeedMul,
    damageMul: stageDmgMul * eliteDmgMul,
    elite: isElite,
    scale: eliteScale,
    knockback: 0,
    knockbackDir: 0,
    flash: 0,
    contactTimer: 0,
    bobble: Math.random() * TAU,
    walkPhase: Math.random() * TAU,
    dead: false,
    deathTimer: 0,
  };
  if (t.throwCooldown) {
    e.throwTimer = rand(t.throwCooldown[0], t.throwCooldown[1]);
  }
  if (t.skill) {
    e.skillState = 'idle';
    e.skillStateLeft = 0;
    e.skillNextAt = rand(t.skill.cooldown[0], t.skill.cooldown[1]) * 0.6;
    e.invuln = 0;
  }
  return e;
}

function spawnBossEnemy(bossId, x, y) {
  const t = BOSSES[bossId];
  // HP scaling for repeat bosses
  const cycle = Math.floor(game.bossesDefeated / BOSS_ORDER.length);
  const hpMul = 1 + cycle * 0.6;
  const baseHp = Math.round(t.hp * hpMul);
  const e = {
    typeId: bossId, type: t,
    x, y,
    w: t.w, h: t.h, r: t.r,
    hp: baseHp, maxHp: baseHp,
    speed: t.speed,
    knockback: 0,
    knockbackDir: 0,
    flash: 0,
    contactTimer: 0,
    bobble: 0,
    walkPhase: 0,
    dead: false,
    deathTimer: 0,
    isBoss: true,
    bossId,
    ai: { state: 'spawn', timer: 0, attackTimer: rand(2, 3.5) },
  };
  return e;
}

function getSpawnPool() {
  // Stage 1: skeleton, bat, brute
  // Stage 2 (after liche): + goblin
  // Stage 3 (after champion): + wraith, armored
  // Stage 4+ (after dragon): everything
  const pool = ['skeleton', 'bat', 'brute'];
  if (game.stage >= 2) pool.push('goblin', 'goblin'); // weight
  if (game.stage >= 3) pool.push('wraith', 'armored');
  if (game.stage >= 4) pool.push('armored', 'wraith');
  return pool;
}

const MAX_ENEMIES_ON_SCREEN = 5;

function spawnWave() {
  if (game.bossActive) return;
  const aliveCount = game.enemies.filter(e => !e.dead && !e.isBoss).length;
  if (aliveCount >= MAX_ENEMIES_ON_SCREEN) return;
  const camRight = game.cameraX + W + 80;
  const dist = game.cameraX / 50;
  const pool = getSpawnPool();
  const want = 1 + Math.floor(Math.random() * 2) + Math.min(2, Math.floor(dist / 800));
  const count = Math.min(MAX_ENEMIES_ON_SCREEN - aliveCount, want);
  for (let i = 0; i < count; i++) {
    const id = pool[Math.floor(Math.random() * pool.length)];
    spawnAt(id, camRight + rand(20 + i * 60, 260 + i * 80));
  }
}

function spawnAt(id, x) {
  const t = ENEMY_TYPES[id];
  const y = t.flying
    ? rand(bandTop - 50, bandBot - 70)
    : rand(bandTop + 10, bandBot - 10);
  game.enemies.push(spawnEnemy(id, x, y));
}

function damageEnemy(e, dmg, knockback, source) {
  // i-frames (rolls, blinks) — full miss
  if (e.invuln && e.invuln > 0) {
    game.damageNums.push({
      x: e.x, y: e.y - e.h * 0.65,
      vy: -70,
      text: 'esquive',
      life: 0.7, maxLife: 0.7,
      color: '#aaffaa',
    });
    return;
  }
  // Armor reduces ranged damage
  if (e.type.armor && source === 'ranged') {
    dmg = dmg * e.type.armor;
  }
  // Wraith ghostly: small chance to phase
  if (e.type.ghostly && Math.random() < 0.20) {
    game.damageNums.push({
      x: e.x, y: e.y - e.h * 0.65,
      vy: -70,
      text: 'phasé',
      life: 0.7, maxLife: 0.7,
      color: '#aa80ff',
    });
    return;
  }
  e.hp -= dmg;
  e.flash = 0.15;
  e.knockback = Math.abs(knockback) * (e.isBoss ? 0.25 : 1);
  e.knockbackDir = Math.sign(knockback) || 1;
  game.damageNums.push({
    x: e.x, y: e.y - e.h * 0.65,
    vy: -70,
    text: '' + Math.round(dmg),
    life: 0.7, maxLife: 0.7,
    color: dmg >= 50 ? '#ffcc40' : '#ff7070',
  });
  if (dmg >= 50 || e.isBoss) audio.hitBig(); else audio.hit();
  if (e.hp <= 0 && !e.dead) {
    e.dead = true;
    e.deathTimer = e.isBoss ? 1.2 : 0.4;
    game.kills += 1;
    killsEl.textContent = '☠ ' + game.kills;
    spawnDeathParticles(e);
    if (e.isBoss) audio.bossDie(); else audio.enemyDie();
    let [lo, hi] = e.type.coinDrop;
    if (e.elite) { lo = Math.round(lo * 1.8); hi = Math.round(hi * 1.8); }
    const n = Math.floor(rand(lo, hi + 1));
    for (let i = 0; i < n; i++) spawnCoin(e);
    if (e.isBoss) onBossDefeated(e);
  }
}

function spawnDeathParticles(e) {
  const n = e.isBoss ? 60 : 18;
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU);
    const sp = rand(100, e.isBoss ? 460 : 280);
    game.particles.push({
      x: e.x, y: e.y - e.h * 0.4,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: e.isBoss ? 1.0 : 0.6, maxLife: e.isBoss ? 1.0 : 0.6,
      color: i % 3 === 0 ? '#aa1010' : (e.type.accent || '#aa1010'),
      size: 2 + Math.random() * 3,
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
    life: 16,
    spin: rand(0, TAU),
    spinVel: rand(4, 9),
    magnet: false,
  });
}

function damagePlayer(amount) {
  const p = game.player;
  if (p.invuln > 0) return;
  // Persistent armor damage reduction
  amount = amount * (1 - (game.equipDR || 0));
  p.hp -= amount;
  p.invuln = 0.7;
  p.flash = 0.25;
  game.shake = Math.max(game.shake, 10);
  audio.hurt();
  refreshHpUI();
  if (p.hp <= 0) { audio.death(); gameOver(); }
}

// ============ Pickups ============
const COIN_MAGNET = 110;
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
      const dx = p.x - c.x, dy = p.y - p.h * 0.5 - c.y;
      const d = Math.hypot(dx, dy);
      if (d < COIN_MAGNET || c.magnet) {
        c.magnet = true;
        const sp = 480;
        c.x += (dx / d) * sp * dt;
        c.y += (dy / d) * sp * dt;
        if (d < COIN_PICK) {
          c.life = 0;
          let gain = 1;
          if (game.challengeMode && Math.random() < 0.5) gain = 2; // averages ×1.5
          game.coins += gain;
          audio.coin();
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

function updateEmbers(dt) {
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

// ============ Boss system ============
function checkBossSpawn() {
  if (game.bossActive) return;
  const meters = game.cameraX / 50;
  if (meters >= game.bossNextAt) {
    triggerBossSpawn();
  }
}

function triggerBossSpawn() {
  // Pick boss based on bossesDefeated cycling through BOSS_ORDER
  const idx = game.bossesDefeated % BOSS_ORDER.length;
  const bossId = BOSS_ORDER[idx];
  const t = BOSSES[bossId];
  const x = game.cameraX + W + 100;
  const y = t.flying ? bandTop - 20 : (bandTop + bandBot) / 2;
  const boss = spawnBossEnemy(bossId, x, y);
  game.boss = boss;
  game.enemies.push(boss);
  game.bossActive = true;

  // Show intro
  bossIntroName.textContent = t.name;
  bossIntroSub.textContent = `Étage ${game.stage}`;
  bossIntro.classList.remove('visible');
  void bossIntro.offsetWidth; // restart anim
  bossIntro.classList.add('visible');
  setTimeout(() => bossIntro.classList.remove('visible'), 2700);

  // Show HP bar
  bossNameEl.textContent = t.name;
  bossHpEl.style.width = '100%';
  bossBar.classList.add('visible');
  audio.bossSpawn();
}

function onBossDefeated(boss) {
  game.bossActive = false;
  game.boss = null;
  game.bossesDefeated += 1;
  game.stage += 1;
  // Next boss further away
  game.bossNextAt = Math.floor(game.cameraX / 50) + 250;
  bossBar.classList.remove('visible');
  stageEl.textContent = 'Étage ' + game.stage;

  // Stage toast
  stageToastTitle.textContent = 'Étage ' + game.stage;
  const subs = [
    'Le donjon s\'enfonce...',
    'Les ténèbres s\'épaississent...',
    'L\'écho des morts résonne...',
    'Quelque chose pire approche...',
  ];
  stageToastSub.textContent = subs[(game.stage - 2) % subs.length] || subs[0];
  stageToast.classList.remove('visible');
  void stageToast.offsetWidth;
  stageToast.classList.add('visible');
  setTimeout(() => stageToast.classList.remove('visible'), 3100);
  audio.levelUp();
}

function updateBoss(dt) {
  const b = game.boss;
  if (!b || b.dead) return;
  const p = game.player;
  const ai = b.ai;
  // ai.timer is a countdown owned by each boss state — don't auto-increment here
  ai.attackTimer -= dt;

  if (b.bossId === 'liche') updateLiche(b, p, dt);
  else if (b.bossId === 'champion') updateChampion(b, p, dt);
  else if (b.bossId === 'dragon') updateDragon(b, p, dt);
  else if (b.bossId === 'necromancer') updateNecromancer(b, p, dt);
  else if (b.bossId === 'golem') updateGolem(b, p, dt);

  // Keep boss inside the arena (prevents charge from carrying him offscreen left)
  if (b.x < game.cameraX - 40) b.x = game.cameraX - 40;

  // Update boss HP bar
  bossHpEl.style.width = clamp((b.hp / b.maxHp) * 100, 0, 100) + '%';
}

function updateLiche(b, p, dt) {
  const ai = b.ai;
  const dx = p.x - b.x, dy = p.y - b.y;
  const d = Math.hypot(dx, dy);
  // Maintain mid distance ~250
  const target = 250;
  const moveSign = d > target + 30 ? 1 : (d < target - 30 ? -1 : 0);
  if (b.knockback <= 0) {
    b.x += moveSign * (dx / (d || 1)) * b.speed * dt;
    b.y += moveSign * (dy / (d || 1)) * b.speed * dt * 0.7;
    b.y = clamp(b.y, bandTop, bandBot);
  }
  b.bobble += dt * 4;
  // Attack
  if (ai.attackTimer <= 0) {
    const phase2 = b.hp < b.maxHp * 0.5;
    if (phase2 && Math.random() < 0.4) {
      // Summon skeletons
      for (let i = 0; i < 2; i++) {
        spawnAt('skeleton', b.x + rand(-30, 30));
      }
      ai.attackTimer = rand(3.5, 5);
    } else {
      // Shadow bolts (1 in phase 1, 3 in phase 2)
      const n = phase2 ? 3 : 1;
      for (let i = 0; i < n; i++) {
        setTimeout(() => {
          if (!game.running || b.dead) return;
          const ang = Math.atan2(p.y - b.y, p.x - b.x) + (i - 1) * 0.25;
          const sp = 280;
          game.projectiles.push({
            kind: 'shadowBolt',
            x: b.x, y: b.y - b.h * 0.5,
            vx: Math.cos(ang) * sp,
            vy: Math.sin(ang) * sp,
            damage: 12,
            life: 3.5,
            friendly: false,
            homing: 0.6,
            wobble: Math.random() * TAU,
          });
        }, i * 200);
      }
      ai.attackTimer = rand(2.0, 3.0) - (phase2 ? 0.5 : 0);
    }
  }
  // Contact damage
  basicContact(b, p);
  // Knockback decay
  if (b.knockback > 0) {
    b.x += b.knockbackDir * b.knockback * dt * 6;
    b.knockback -= b.knockback * dt * 8 + 30 * dt;
    if (b.knockback < 5) b.knockback = 0;
  }
}

function updateChampion(b, p, dt) {
  const ai = b.ai;
  const dx = p.x - b.x, dy = p.y - b.y;
  const d = Math.hypot(dx, dy) || 1;
  // Charging state
  if (ai.state === 'charge') {
    ai.timer -= dt;
    b.x += ai.chargeDir * 380 * dt;
    if (ai.timer <= 0) {
      ai.state = 'idle';
      ai.attackTimer = rand(3.5, 4.5);
    }
  } else {
    if (b.knockback <= 0) {
      b.x += (dx / d) * b.speed * dt;
      b.y += (dy / d) * b.speed * dt * 0.7;
      b.y = clamp(b.y, bandTop, bandBot);
    }
    if (ai.attackTimer <= 0 && Math.abs(p.x - b.x) > 80) {
      // Charge!
      ai.state = 'charge';
      ai.timer = 0.8;
      ai.chargeDir = Math.sign(p.x - b.x) || 1;
      // visual telegraph: short flash
      b.flash = 0.1;
    }
    if (ai.attackTimer <= 0 && Math.abs(p.x - b.x) <= 80) {
      // Slam
      const phase2 = b.hp < b.maxHp * 0.4;
      const slamRange = phase2 ? 140 : 100;
      // AOE around boss
      const inRange = Math.abs(p.x - b.x) < slamRange && Math.abs(p.y - b.y) < 80;
      if (inRange) damagePlayer(b.type.damage);
      // Particles
      for (let i = 0; i < 18; i++) {
        const a = rand(0, TAU);
        game.particles.push({
          x: b.x, y: b.y, vx: Math.cos(a) * 220, vy: Math.sin(a) * 220 - 80,
          life: 0.5, maxLife: 0.5, color: '#aa7030', size: 3,
        });
      }
      game.shake = Math.max(game.shake, 20);
      ai.attackTimer = rand(2.5, 3.5);
    }
  }
  b.walkPhase += dt * 8;
  basicContact(b, p);
  if (b.knockback > 0) {
    b.x += b.knockbackDir * b.knockback * dt * 6;
    b.knockback -= b.knockback * dt * 8 + 30 * dt;
    if (b.knockback < 5) b.knockback = 0;
  }
}

function updateDragon(b, p, dt) {
  const ai = b.ai;
  // Dragon hovers above, dives occasionally
  if (ai.state === 'dive') {
    ai.timer -= dt;
    const target = { x: p.x, y: p.y - 10 };
    const dx = target.x - b.x, dy = target.y - b.y;
    const d = Math.hypot(dx, dy) || 1;
    b.x += (dx / d) * 360 * dt;
    b.y += (dy / d) * 360 * dt;
    if (ai.timer <= 0 || Math.hypot(b.x - p.x, b.y - p.y) < 50) {
      ai.state = 'retreat';
      ai.timer = 1.0;
      ai.attackTimer = rand(2.5, 3.5);
    }
  } else if (ai.state === 'retreat') {
    ai.timer -= dt;
    b.y -= 220 * dt;
    if (ai.timer <= 0 || b.y < bandTop - 40) {
      b.y = bandTop - 40;
      ai.state = 'idle';
    }
  } else {
    // Hover, follow horizontally
    const tx = p.x + 280;
    const dx = tx - b.x;
    b.x += dx * 0.8 * dt;
    b.y = bandTop - 40 + Math.sin(game.t * 2) * 12;
    if (ai.attackTimer <= 0) {
      const phase2 = b.hp < b.maxHp * 0.5;
      if (Math.random() < (phase2 ? 0.55 : 0.35)) {
        ai.state = 'dive';
        ai.timer = 1.4;
        ai.attackTimer = 99;
      } else {
        // Fire breath cone
        const dir = Math.sign(p.x - b.x) || -1;
        const baseAng = dir > 0 ? 0 : Math.PI;
        const n = phase2 ? 5 : 3;
        for (let i = 0; i < n; i++) {
          const a = baseAng + (i - (n - 1) / 2) * 0.18;
          const sp = 360;
          game.projectiles.push({
            kind: 'fireball',
            x: b.x + dir * 30, y: b.y + 4,
            vx: Math.cos(a) * sp,
            vy: Math.sin(a) * sp,
            damage: 14,
            life: 1.6,
            friendly: false,
            wobble: Math.random() * TAU,
          });
        }
        ai.attackTimer = rand(1.8, 2.6);
      }
    }
  }
  b.bobble += dt * 6;
  basicContact(b, p);
  if (b.knockback > 0) {
    b.x += b.knockbackDir * b.knockback * dt * 4;
    b.knockback -= b.knockback * dt * 8 + 30 * dt;
    if (b.knockback < 5) b.knockback = 0;
  }
}

function updateNecromancer(b, p, dt) {
  const ai = b.ai;
  const dx = p.x - b.x, dy = p.y - b.y;
  const d = Math.hypot(dx, dy) || 1;
  const target = 280;
  const moveSign = d > target + 30 ? 1 : (d < target - 30 ? -1 : 0);
  if (b.knockback <= 0) {
    b.x += moveSign * (dx / d) * b.speed * dt;
    b.y += moveSign * (dy / d) * b.speed * dt * 0.7;
    b.y = clamp(b.y, bandTop, bandBot);
  }
  b.bobble += dt * 4;
  if (ai.attackTimer <= 0) {
    const phase2 = b.hp < b.maxHp * 0.5;
    const r = Math.random();
    if (r < 0.45) {
      const n = phase2 ? 3 : 2;
      for (let i = 0; i < n; i++) spawnAt('skeleton', b.x + rand(-50, 50));
      for (let i = 0; i < 16; i++) {
        const a = rand(0, TAU);
        game.particles.push({
          x: b.x, y: b.y - b.h * 0.5,
          vx: Math.cos(a) * rand(80, 220),
          vy: Math.sin(a) * rand(80, 220),
          life: 0.6, maxLife: 0.6,
          color: '#80ffaa', size: 3,
        });
      }
      ai.attackTimer = phase2 ? rand(2.5, 3.5) : rand(3.5, 5.0);
    } else {
      const n = phase2 ? 3 : 2;
      for (let i = 0; i < n; i++) {
        setTimeout(() => {
          if (!game.running || b.dead) return;
          const ang = Math.atan2(p.y - b.y, p.x - b.x) + (i - (n - 1) / 2) * 0.18;
          const sp = 320;
          game.projectiles.push({
            kind: 'shadowBolt',
            x: b.x, y: b.y - b.h * 0.5,
            vx: Math.cos(ang) * sp,
            vy: Math.sin(ang) * sp,
            damage: 14,
            life: 3.0,
            friendly: false,
            wobble: Math.random() * TAU,
          });
        }, i * 150);
      }
      ai.attackTimer = phase2 ? rand(1.8, 2.5) : rand(2.5, 3.5);
    }
  }
  basicContact(b, p);
  if (b.knockback > 0) {
    b.x += b.knockbackDir * b.knockback * dt * 6;
    b.knockback -= b.knockback * dt * 8 + 30 * dt;
    if (b.knockback < 5) b.knockback = 0;
  }
}

function updateGolem(b, p, dt) {
  const ai = b.ai;
  const dx = p.x - b.x, dy = p.y - b.y;
  const d = Math.hypot(dx, dy) || 1;
  if (ai.state === 'windup') {
    ai.windupLeft -= dt;
    // particles cracking the floor while charging
    if (Math.random() < 0.5) {
      game.particles.push({
        x: b.x + rand(-25, 25), y: b.y,
        vx: rand(-30, 30), vy: rand(-160, -60),
        life: 0.5, maxLife: 0.5,
        color: '#a89478', size: 2,
      });
    }
    if (ai.windupLeft <= 0) {
      const phase2 = b.hp < b.maxHp * 0.4;
      const slamRadius = phase2 ? 240 : 200;
      const dist = Math.hypot(p.x - b.x, p.y - b.y);
      if (dist < slamRadius) damagePlayer(40);
      for (let i = 0; i < 40; i++) {
        const a = rand(0, TAU);
        const sp2 = rand(160, 360);
        game.particles.push({
          x: b.x, y: b.y,
          vx: Math.cos(a) * sp2, vy: Math.sin(a) * sp2 - 80,
          life: 0.7, maxLife: 0.7,
          color: i % 2 ? '#a89478' : '#5a4a3a',
          size: 4,
        });
      }
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * TAU;
        game.particles.push({
          x: b.x + Math.cos(a) * 30, y: b.y,
          vx: Math.cos(a) * 220, vy: Math.sin(a) * 60,
          life: 0.6, maxLife: 0.6,
          color: '#7a6a4a', size: 3,
        });
      }
      game.shake = Math.max(game.shake, 30);
      audio.hitBig();
      ai.state = 'idle';
      ai.attackTimer = rand(4.5, 6.5);
    }
    return;
  }
  if (b.knockback <= 0) {
    b.x += (dx / d) * b.speed * dt;
    b.y += (dy / d) * b.speed * dt * 0.5;
    b.y = clamp(b.y, bandTop, bandBot);
  }
  b.walkPhase += dt * 5;
  if (ai.attackTimer <= 0) {
    const phase2 = b.hp < b.maxHp * 0.4;
    if (Math.abs(p.x - b.x) < 200 && Math.random() < 0.5) {
      ai.state = 'windup';
      ai.windupLeft = 0.9;
      b.flash = 0.1;
    } else {
      const n = phase2 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const ang = Math.atan2(p.y - b.y, p.x - b.x) + (i - (n - 1) / 2) * 0.18;
        const sp = 280;
        game.projectiles.push({
          kind: 'rock',
          x: b.x, y: b.y - b.h * 0.5,
          vx: Math.cos(ang) * sp,
          vy: Math.sin(ang) * sp,
          damage: 22,
          life: 2.0,
          friendly: false,
          spin: 0,
          wobble: 0,
        });
      }
      ai.attackTimer = rand(3.0, 4.5);
    }
  }
  basicContact(b, p);
  if (b.knockback > 0) {
    b.x += b.knockbackDir * b.knockback * dt * 4;
    b.knockback -= b.knockback * dt * 8 + 30 * dt;
    if (b.knockback < 5) b.knockback = 0;
  }
}

function basicContact(e, p) {
  const ddx = p.x - e.x, ddy = p.y - e.y;
  if (e.contactTimer > 0) e.contactTimer -= 1/60;
  if (ddx*ddx + ddy*ddy < (e.r + 18) * (e.r + 18) && e.contactTimer <= 0) {
    damagePlayer(e.type.damage * (e.damageMul || 1));
    e.contactTimer = e.type.contactCooldown;
  }
}

// ============ Enemy skills ============
// Each handler returns true if the skill is currently overriding default movement.
function updateEnemySkill(e, p, dt) {
  if (!e.type.skill) return false;
  if (e.invuln > 0) e.invuln -= dt;
  switch (e.type.skill.name) {
    case 'lunge':      return skillLunge(e, p, dt);
    case 'dive':       return skillDive(e, p, dt);
    case 'slam':       return skillSlam(e, p, dt);
    case 'roll':       return skillRoll(e, p, dt);
    case 'blink':      return skillBlink(e, p, dt);
    case 'shieldBash': return skillShieldBash(e, p, dt);
  }
  return false;
}

function rollCooldown(e) {
  return rand(e.type.skill.cooldown[0], e.type.skill.cooldown[1]);
}

function skillLunge(e, p, dt) {
  const s = e.type.skill;
  if (e.skillState === 'idle') {
    e.skillNextAt -= dt;
    if (e.skillNextAt <= 0) {
      const d = Math.hypot(p.x - e.x, p.y - e.y);
      if (d < s.range && d > 25) {
        e.skillState = 'windup';
        e.skillStateLeft = s.windup;
      } else {
        e.skillNextAt = 0.35;
      }
    }
    return false;
  }
  if (e.skillState === 'windup') {
    e.skillStateLeft -= dt;
    if (e.skillStateLeft <= 0) {
      e.skillState = 'active';
      e.skillStateLeft = s.dashTime;
      const dx = p.x - e.x, dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      e.lungeVx = (dx / d) * s.dashSpeed;
      e.lungeVy = (dy / d) * s.dashSpeed * 0.5;
    }
    return true;
  }
  if (e.skillState === 'active') {
    e.skillStateLeft -= dt;
    e.x += e.lungeVx * dt;
    e.y += e.lungeVy * dt;
    e.y = clamp(e.y, bandTop, bandBot);
    if (Math.random() < 0.6) {
      game.particles.push({
        x: e.x, y: e.y - e.h * 0.5,
        vx: rand(-30, 30), vy: rand(-30, 30),
        life: 0.3, maxLife: 0.3,
        color: '#ff5050', size: 2,
      });
    }
    if (e.skillStateLeft <= 0) {
      e.skillState = 'idle';
      e.skillNextAt = rollCooldown(e);
    }
    return true;
  }
  return false;
}

function skillDive(e, p, dt) {
  const s = e.type.skill;
  if (e.skillState === 'idle') {
    e.skillNextAt -= dt;
    if (e.skillNextAt <= 0) {
      const d = Math.hypot(p.x - e.x, p.y - e.y);
      if (d < s.range) {
        e.skillState = 'active';
        e.skillStateLeft = s.diveTime;
        e.diveTarget = { x: p.x, y: p.y - 5 };
      } else {
        e.skillNextAt = 0.4;
      }
    }
    return false;
  }
  if (e.skillState === 'active') {
    e.skillStateLeft -= dt;
    const dx = e.diveTarget.x - e.x, dy = e.diveTarget.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    e.x += (dx / d) * s.diveSpeed * dt;
    e.y += (dy / d) * s.diveSpeed * dt;
    if (Math.random() < 0.6) {
      game.particles.push({
        x: e.x, y: e.y,
        vx: rand(-30, 30), vy: rand(-20, 20),
        life: 0.3, maxLife: 0.3,
        color: '#7a3a8a', size: 2,
      });
    }
    if (e.skillStateLeft <= 0 || (Math.abs(dx) < 18 && Math.abs(dy) < 18)) {
      e.skillState = 'idle';
      e.skillNextAt = rollCooldown(e);
    }
    return true;
  }
  return false;
}

function skillSlam(e, p, dt) {
  const s = e.type.skill;
  if (e.skillState === 'idle') {
    e.skillNextAt -= dt;
    if (e.skillNextAt <= 0) {
      const d = Math.hypot(p.x - e.x, p.y - e.y);
      if (d < s.range) {
        e.skillState = 'windup';
        e.skillStateLeft = s.windup;
      } else {
        e.skillNextAt = 0.35;
      }
    }
    return false;
  }
  if (e.skillState === 'windup') {
    e.skillStateLeft -= dt;
    if (Math.random() < 0.5) {
      game.particles.push({
        x: e.x + rand(-15, 15), y: e.y - 5,
        vx: rand(-30, 30), vy: rand(-120, -50),
        life: 0.4, maxLife: 0.4,
        color: '#aa3030', size: 2,
      });
    }
    if (e.skillStateLeft <= 0) {
      const d = Math.hypot(p.x - e.x, p.y - e.y);
      if (d < s.aoeRadius) {
        damagePlayer(s.slamDamage * (e.damageMul || 1));
      }
      for (let i = 0; i < 26; i++) {
        const a = rand(0, TAU);
        game.particles.push({
          x: e.x, y: e.y,
          vx: Math.cos(a) * rand(180, 320),
          vy: Math.sin(a) * rand(180, 320) - 60,
          life: 0.6, maxLife: 0.6,
          color: i % 2 ? '#aa3030' : '#5a2a2a',
          size: 3,
        });
      }
      // ground crack visual particles
      for (let i = 0; i < 8; i++) {
        game.particles.push({
          x: e.x + rand(-s.aoeRadius * 0.7, s.aoeRadius * 0.7),
          y: e.y, vx: 0, vy: -rand(80, 160),
          life: 0.5, maxLife: 0.5,
          color: '#7a4030', size: 2,
        });
      }
      game.shake = Math.max(game.shake, 18);
      e.skillState = 'idle';
      e.skillNextAt = rollCooldown(e);
    }
    return true;
  }
  return false;
}

function skillRoll(e, p, dt) {
  const s = e.type.skill;
  if (e.skillState === 'idle') {
    e.skillNextAt -= dt;
    if (e.skillNextAt <= 0) {
      // 50% chance to actually roll on cooldown trigger
      if (Math.random() < 0.55) {
        e.skillState = 'active';
        e.skillStateLeft = s.rollTime;
        e.rollDir = Math.random() < 0.5 ? -1 : 1;
        e.invuln = s.iframes;
      }
      e.skillNextAt = rollCooldown(e);
    }
    return false;
  }
  if (e.skillState === 'active') {
    e.skillStateLeft -= dt;
    e.y += e.rollDir * s.rollSpeed * dt;
    e.y = clamp(e.y, bandTop, bandBot);
    if (Math.random() < 0.5) {
      game.particles.push({
        x: e.x + rand(-8, 8), y: e.y - 5,
        vx: rand(-20, 20), vy: rand(-30, 0),
        life: 0.3, maxLife: 0.3,
        color: '#5a8a5a', size: 1.5,
      });
    }
    if (e.skillStateLeft <= 0) e.skillState = 'idle';
    return true;
  }
  return false;
}

function skillBlink(e, p, dt) {
  if (e.skillState === 'idle') {
    e.skillNextAt -= dt;
    if (e.skillNextAt <= 0) {
      // burst at old position
      for (let i = 0; i < 14; i++) {
        const a = rand(0, TAU);
        game.particles.push({
          x: e.x, y: e.y - e.h * 0.4,
          vx: Math.cos(a) * 110, vy: Math.sin(a) * 110,
          life: 0.45, maxLife: 0.45,
          color: '#a060c0', size: 2,
        });
      }
      // teleport near player
      const side = Math.random() < 0.5 ? -1 : 1;
      e.x = p.x + side * rand(70, 130);
      e.y = clamp(p.y + rand(-30, 30), bandTop - 30, bandBot - 50);
      // burst at new position
      for (let i = 0; i < 14; i++) {
        const a = rand(0, TAU);
        game.particles.push({
          x: e.x, y: e.y - e.h * 0.4,
          vx: Math.cos(a) * 110, vy: Math.sin(a) * 110,
          life: 0.45, maxLife: 0.45,
          color: '#d8a0ff', size: 2,
        });
      }
      e.invuln = 0.2;
      e.skillNextAt = rollCooldown(e);
    }
  }
  return false;
}

function skillShieldBash(e, p, dt) {
  const s = e.type.skill;
  if (e.skillState === 'idle') {
    e.skillNextAt -= dt;
    if (e.skillNextAt <= 0) {
      const d = Math.hypot(p.x - e.x, p.y - e.y);
      if (d < s.range) {
        e.skillState = 'windup';
        e.skillStateLeft = s.windup;
      } else {
        e.skillNextAt = 0.35;
      }
    }
    return false;
  }
  if (e.skillState === 'windup') {
    e.skillStateLeft -= dt;
    if (e.skillStateLeft <= 0) {
      e.skillState = 'active';
      e.skillStateLeft = s.dashTime;
      const dx = p.x - e.x, dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      e.bashVx = (dx / d) * s.dashSpeed;
      e.bashVy = (dy / d) * s.dashSpeed * 0.5;
    }
    return true;
  }
  if (e.skillState === 'active') {
    e.skillStateLeft -= dt;
    e.x += e.bashVx * dt;
    e.y += e.bashVy * dt;
    e.y = clamp(e.y, bandTop, bandBot);
    const dx = p.x - e.x, dy = p.y - e.y;
    if (dx*dx + dy*dy < (e.r + 18) * (e.r + 18) && e.contactTimer <= 0) {
      damagePlayer(s.bashDamage * (e.damageMul || 1));
      e.contactTimer = 1.0;
    }
    if (Math.random() < 0.5) {
      game.particles.push({
        x: e.x, y: e.y,
        vx: rand(-40, 40), vy: rand(-40, 0),
        life: 0.3, maxLife: 0.3,
        color: '#888', size: 2,
      });
    }
    if (e.skillStateLeft <= 0) {
      e.skillState = 'idle';
      e.skillNextAt = rollCooldown(e);
    }
    return true;
  }
  return false;
}

// ============ Shop ============
// basePrice : initial cost; priceMul : multiplier applied per existing stack;
// maxStacks : cap on how many times a stackable upgrade can be bought.
const SHOP_ITEMS = [
  { id: 'heal_small',  name: 'Potion mineure',   desc: '+50 PV',                  basePrice: 25,  priceMul: 1.0, icon: '❤️', apply: () => { game.player.hp = Math.min(game.player.maxHp, game.player.hp + 50); refreshHpUI(); } },
  { id: 'heal_full',   name: 'Potion majeure',   desc: 'Soin total',              basePrice: 60,  priceMul: 1.0, icon: '🧪', apply: () => { game.player.hp = game.player.maxHp; refreshHpUI(); } },
  { id: 'maxhp',       name: 'Vitalité',         desc: '+25 PV max',              basePrice: 90,  priceMul: 1.6, maxStacks: 5, icon: '💪', apply: () => { game.player.maxHp += 25; game.player.hp += 25; refreshHpUI(); } },
  { id: 'damage',      name: 'Force',            desc: '+20% dégâts',             basePrice: 110, priceMul: 1.7, maxStacks: 5, icon: '⚡', apply: () => { game.upgrades.damageMul = Math.min(3.0, game.upgrades.damageMul * 1.2); } },
  { id: 'speed',       name: 'Agilité',          desc: '+12% vitesse',            basePrice: 80,  priceMul: 2.0, maxStacks: 3, icon: '👟', apply: () => { game.upgrades.speedMul = Math.min(1.5, game.upgrades.speedMul * 1.12); } },
  { id: 'unlock_dagger',  name: 'Dague',            desc: 'Mêlée très rapide',                basePrice: 90,  priceMul: 1, icon: '🗡', once: true, apply: () => { game.unlockedWeapons.add('dagger'); } },
  { id: 'unlock_spear',   name: 'Lance',            desc: 'Mêlée longue portée',              basePrice: 140, priceMul: 1, icon: '🔱', once: true, apply: () => { game.unlockedWeapons.add('spear'); } },
  { id: 'unlock_magic',   name: 'Épée mystique',    desc: 'Lance une onde de slash',          basePrice: 240, priceMul: 1, icon: '✨', once: true, apply: () => { game.unlockedWeapons.add('magicSword'); } },
  { id: 'sword_up',    name: 'Épée affûtée',     desc: 'Épée +60% dégâts',        basePrice: 140, priceMul: 1, icon: '⚔️',  once: true, apply: () => { game.upgrades.weaponBonus.sword = 1.6; } },
  { id: 'bow_up',      name: 'Arc enchanté',     desc: 'Arc +60% dégâts',         basePrice: 140, priceMul: 1, icon: '🏹',  once: true, apply: () => { game.upgrades.weaponBonus.bow = 1.6; } },
  { id: 'hammer_up',   name: 'Marteau de guerre', desc: 'Marteau +60% dégâts',    basePrice: 180, priceMul: 1, icon: '🔨',  once: true, apply: () => { game.upgrades.weaponBonus.hammer = 1.6; } },
  { id: 'dagger_up',   name: 'Dague maudite',     desc: 'Dague +60% dégâts',      basePrice: 120, priceMul: 1, icon: '🗡',  once: true, requires: 'dagger',     apply: () => { game.upgrades.weaponBonus.dagger = 1.6; } },
  { id: 'spear_up',    name: 'Lance runique',     desc: 'Lance +60% dégâts',      basePrice: 160, priceMul: 1, icon: '🔱',  once: true, requires: 'spear',      apply: () => { game.upgrades.weaponBonus.spear = 1.6; } },
  { id: 'magic_up',    name: 'Lame des arcanes',  desc: 'Épée mystique +60%',     basePrice: 280, priceMul: 1, icon: '✨',  once: true, requires: 'magicSword', apply: () => { game.upgrades.weaponBonus.magicSword = 1.6; } },
];

function getStacks(id)     { return game.upgrades.stacks[id] || 0; }
function getCurrentPrice(item) {
  if (item.once) return item.basePrice;
  const stacks = getStacks(item.id);
  return Math.floor(item.basePrice * Math.pow(item.priceMul || 1, stacks));
}
function isItemAvailable(item) {
  if (item.once && game.upgrades.purchased.has(item.id)) return false;
  if (item.requires && !game.unlockedWeapons.has(item.requires)) return false;
  if (item.maxStacks && getStacks(item.id) >= item.maxStacks) return false;
  return true;
}

function toggleShop() {
  if (!game.running) return;
  if (game.paused) closeShop(); else openShop();
}

function openShop() {
  if (!game.running) return;
  game.paused = true;
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
    if (!isItemAvailable(item)) continue;
    const price = getCurrentPrice(item);
    const card = document.createElement('div');
    card.className = 'shop-item';
    if (game.coins < price) card.classList.add('disabled');
    const stacks = getStacks(item.id);
    const stackBadge = item.maxStacks
      ? `<span class="shop-stacks">${stacks}/${item.maxStacks}</span>`
      : '';
    card.innerHTML = `
      <div class="shop-icon">${item.icon}</div>
      <div class="shop-info">
        <div class="shop-name">${item.name} ${stackBadge}</div>
        <div class="shop-desc">${item.desc}</div>
      </div>
      <div class="shop-price">⛁ ${price}</div>
    `;
    card.addEventListener('click', () => buyItem(item));
    shopList.appendChild(card);
  }
  shopCoinsEl.textContent = '⛁ ' + game.coins;
}

function buyItem(item) {
  if (!isItemAvailable(item)) return;
  const price = getCurrentPrice(item);
  if (game.coins < price) return;
  game.coins -= price;
  if (item.once) {
    game.upgrades.purchased.add(item.id);
  } else {
    game.upgrades.stacks[item.id] = getStacks(item.id) + 1;
  }
  item.apply();
  audio.purchase();
  coinsEl.textContent = '⛁ ' + game.coins;
  renderShop();
}

function refreshHpUI() {
  const p = game.player;
  hpBar.style.width = clamp((p.hp / p.maxHp) * 100, 0, 100) + '%';
  hpText.textContent = Math.max(0, Math.round(p.hp)) + '/' + p.maxHp;
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
    cycleWeapon();
  }

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

  // Auto-scroll: world advances even when player stops, except during boss fights or Challenge mode
  if (!game.bossActive) {
    if (!game.challengeMode) {
      const baseScroll = 40 + Math.min(40, (game.stage - 1) * 6);
      game.cameraX += baseScroll * dt;
    }
    const targetCam = p.x - W * 0.35;
    game.cameraX = Math.max(game.cameraX, targetCam);
  }
  // During boss fight, camera is locked at game.bossArenaX (set on spawn)

  const distance = Math.floor(game.cameraX / 50);
  distEl.textContent = distance + ' m';

  // Player can't fall behind the camera (gets pushed forward)
  const leftEdge = game.cameraX + 30;
  if (p.x < leftEdge) p.x = leftEdge;
  // During boss fight, also constrain right edge (camera is locked)
  if (game.bossActive) {
    const rightEdge = game.cameraX + W - 30;
    if (p.x > rightEdge) p.x = rightEdge;
  }

  if (input.attack) attackPlayer();

  if (p.attackTimer > 0) p.attackTimer -= dt;
  if (p.swingTimer > 0) p.swingTimer -= dt;
  if (p.invuln > 0) p.invuln -= dt;
  if (p.flash > 0) p.flash -= dt;

  // Player ember aura
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

  // Boss spawn check
  checkBossSpawn();

  // Regular spawning (paused during boss fights)
  if (!game.bossActive) {
    game.spawnTimer -= dt;
    if (game.spawnTimer <= 0) {
      spawnWave();
      game.spawnTimer = rand(1.6, 2.6) - Math.min(0.7, distance / 700);
    }
  }

  // Boss AI
  if (game.bossActive && game.boss && !game.boss.dead) {
    updateBoss(dt);
  }

  // Enemies
  for (const e of game.enemies) {
    if (e.dead) { e.deathTimer -= dt; continue; }
    if (e.isBoss) continue; // handled by updateBoss
    if (e.flash > 0) e.flash -= dt;
    if (e.contactTimer > 0) e.contactTimer -= dt;
    e.bobble += dt * (e.type.flying ? 6 : 3);
    e.walkPhase += dt * 10;

    // Skill state machine — may override default movement
    const skillOverrides = updateEnemySkill(e, p, dt);

    if (e.knockback > 0) {
      e.x += e.knockbackDir * e.knockback * dt * 6;
      e.knockback -= e.knockback * dt * 8 + 30 * dt;
      if (e.knockback < 5) e.knockback = 0;
    } else if (skillOverrides) {
      // skill is driving the enemy this frame, no default movement
    } else {
      // Goblin tries to keep distance
      if (e.typeId === 'goblin') {
        const dx = p.x - e.x, dy = p.y - e.y;
        const d = Math.hypot(dx, dy) || 1;
        const targetDist = e.type.preferredDist;
        const move = d > targetDist + 20 ? 1 : (d < targetDist - 30 ? -0.6 : 0);
        e.x += (dx / d) * e.speed * move * dt;
        e.y += (dy / d) * e.speed * 0.5 * dt;
        e.y = clamp(e.y, bandTop, bandBot);
        // Throw daggers
        e.throwTimer -= dt;
        if (e.throwTimer <= 0) {
          const ang = Math.atan2(p.y - e.y, p.x - e.x);
          const sp2 = 380;
          game.projectiles.push({
            kind: 'goblinDagger',
            x: e.x, y: e.y - e.h * 0.5,
            vx: Math.cos(ang) * sp2,
            vy: Math.sin(ang) * sp2,
            damage: 8 * (e.damageMul || 1),
            life: 1.4,
            friendly: false,
            spin: rand(0, TAU),
          });
          e.throwTimer = rand(e.type.throwCooldown[0], e.type.throwCooldown[1]);
        }
      } else {
        const dx = p.x - e.x, dy = p.y - e.y;
        const d = Math.hypot(dx, dy) || 1;
        e.x += (dx / d) * e.speed * dt;
        e.y += (dy / d) * e.speed * dt * 0.75;
        if (!e.type.flying) e.y = clamp(e.y, bandTop, bandBot);
      }
    }

    const ddx = p.x - e.x, ddy = p.y - e.y;
    if (ddx*ddx + ddy*ddy < (e.r + 18) * (e.r + 18) && e.contactTimer <= 0) {
      damagePlayer(e.type.damage * (e.damageMul || 1));
      e.contactTimer = e.type.contactCooldown;
    }
  }
  game.enemies = game.enemies.filter(e =>
    !(e.dead && e.deathTimer <= 0) &&
    (e.isBoss || e.x > game.cameraX - 200)
  );

  // Projectiles
  for (const pr of game.projectiles) {
    // Homing
    if (pr.homing && game.player) {
      const dx = game.player.x - pr.x, dy = game.player.y - game.player.h * 0.5 - pr.y;
      const d = Math.hypot(dx, dy) || 1;
      const homeStrength = pr.homing;
      const cur = Math.hypot(pr.vx, pr.vy) || 1;
      pr.vx += ((dx / d) * cur - pr.vx) * homeStrength * dt;
      pr.vy += ((dy / d) * cur - pr.vy) * homeStrength * dt;
    }
    if (pr.kind === 'fireball' || pr.kind === 'shadowBolt') {
      pr.wobble = (pr.wobble || 0) + dt * 12;
    }
    pr.x += pr.vx * dt;
    pr.y += pr.vy * dt;
    pr.life -= dt;

    if (pr.friendly) {
      // Slash wave: pierces multiple enemies, doesn't despawn on hit
      const isSlash = pr.kind === 'slashWave';
      for (const e of game.enemies) {
        if (e.dead) continue;
        const dx = e.x - pr.x, dy = e.y - pr.y;
        const hitR = isSlash ? 50 : 6;
        if (dx*dx + dy*dy < (e.r + hitR) * (e.r + hitR)) {
          if (!pr.hits) pr.hits = new Set();
          if (pr.hits.has(e)) continue;
          pr.hits.add(e);
          const src = pr.kind === 'arrow' ? 'ranged' : 'melee';
          damageEnemy(e, pr.damage, Math.sign(pr.vx) * pr.knockback, src);
          if (!isSlash) { pr.life = 0; break; }
        }
      }
    } else {
      // Hostile projectile: hit player
      if (game.player) {
        const dx = game.player.x - pr.x, dy = (game.player.y - game.player.h * 0.5) - pr.y;
        if (dx*dx + dy*dy < 18 * 18) {
          damagePlayer(pr.damage);
          pr.life = 0;
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

  updatePickups(dt);
  updateEmbers(dt);

  if (game.shake > 0) game.shake = Math.max(0, game.shake - dt * 40);
}

function cycleWeapon() {
  const order = WEAPONS.map((w, i) => ({ w, i })).filter(x => game.unlockedWeapons.has(x.w.id));
  if (order.length <= 1) return;
  const curId = WEAPONS[game.weaponIndex].id;
  let pos = order.findIndex(x => x.w.id === curId);
  pos = (pos + 1) % order.length;
  game.weaponIndex = order[pos].i;
  updateWeaponUI();
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

  const midOff = (game.cameraX * 0.5) % 360;
  for (let i = -1; i < W / 360 + 2; i++) {
    const x = i * 360 - midOff;
    drawPillar(x, bandTop - 50);
  }

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
  ctx.strokeStyle = 'rgba(80, 60, 80, 0.4)';
  ctx.beginPath();
  ctx.moveTo(x + 25, 50);
  ctx.lineTo(x + 22, baseY - 30);
  ctx.stroke();
}

function drawWallTorch(x, y) {
  const flicker = Math.sin(game.t * 12 + x) * 0.2 + 0.8;
  ctx.fillStyle = '#3a2a1a';
  ctx.fillRect(x - 3, y, 6, 14);
  const grad = ctx.createRadialGradient(x, y - 6, 1, x, y - 6, 22);
  grad.addColorStop(0, `rgba(255, 230, 120, ${flicker})`);
  grad.addColorStop(0.4, `rgba(255, 140, 40, ${flicker * 0.8})`);
  grad.addColorStop(1, 'rgba(180, 40, 0, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y - 6, 22, 0, TAU);
  ctx.fill();
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

// ============ Hero ============
function drawPlayer() {
  const p = game.player;
  const x = sX(p.x);
  const y = p.y;
  const blink = p.invuln > 0 && Math.floor(p.invuln * 20) % 2 === 0;
  if (blink) return;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.beginPath();
  ctx.ellipse(x, y + 4, 22, 6, 0, 0, TAU);
  ctx.fill();

  const walk = p.moving ? Math.sin(p.walkPhase) : 0;
  const bob = p.moving ? Math.abs(walk) * 2 : 0;

  ctx.save();
  ctx.translate(x, y - bob);
  drawCape(p, walk);
  drawLegs(p, walk);
  drawArmor(p);
  drawPauldrons(p);
  drawHelm(p, walk);
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
  ctx.fillRect(-legW - 4, -legH - 4 + offset, legW, legH);
  ctx.fillRect(4, -legH - 4 - offset, legW, legH);
  ctx.fillStyle = p.flash > 0 ? '#ffaaaa' : '#0a0a10';
  ctx.fillRect(-legW - 5, -6 + Math.max(0, offset), legW + 2, 6);
  ctx.fillRect(3, -6 + Math.max(0, -offset), legW + 2, 6);
}

function drawArmor(p) {
  const top = -p.h + 18;
  const bottom = -22;
  const grad = ctx.createLinearGradient(0, top, 0, bottom);
  grad.addColorStop(0, p.flash > 0 ? '#ffffff' : '#2a2236');
  grad.addColorStop(0.5, p.flash > 0 ? '#ffaaaa' : '#1a1422');
  grad.addColorStop(1, p.flash > 0 ? '#ffaaaa' : '#0e0a14');
  ctx.fillStyle = grad;
  roundRect(-16, top, 32, bottom - top, 4);
  ctx.fill();
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
  ctx.fillStyle = '#cc1818';
  ctx.fillRect(-1.5, top + 10, 3, 8);
  ctx.fillStyle = '#1a0810';
  ctx.fillRect(-16, bottom - 4, 32, 4);
  ctx.fillStyle = '#aa6020';
  ctx.fillRect(-3, bottom - 4, 6, 4);
}

function drawPauldrons(p) {
  const top = -p.h + 18;
  ctx.fillStyle = p.flash > 0 ? '#ffaaaa' : '#1a1422';
  ctx.beginPath();
  ctx.ellipse(-18, top + 4, 10, 8, 0, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(18, top + 4, 10, 8, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = p.flash > 0 ? '#ffd0d0' : '#3a2a3a';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * 20, top - 2);
    ctx.lineTo(side * 28, top - 8);
    ctx.lineTo(side * 22, top + 2);
    ctx.closePath();
    ctx.fill();
  }
}

function drawHelm(p, walk) {
  const top = -p.h + 2;
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
  const glowAlpha = 0.7 + Math.sin(game.t * 6) * 0.2;
  const glow = ctx.createRadialGradient(p.facing * 1, top + 16, 1, p.facing * 1, top + 16, 14);
  glow.addColorStop(0, `rgba(255, 60, 50, ${glowAlpha * 0.7})`);
  glow.addColorStop(1, 'rgba(255, 60, 50, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(-16, top + 6, 32, 22);
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
    ctx.fillStyle = '#5a3a18';
    ctx.fillRect(8, -8, 6, 16);
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
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(16, -1, 40, 1);
    ctx.fillStyle = '#2a1a0a';
    ctx.fillRect(0, -3, 10, 6);
    ctx.fillStyle = '#aa6020';
    ctx.beginPath(); ctx.arc(-2, 0, 4, 0, TAU); ctx.fill();
    if (swinging) drawSwingArc(0, 0, 56, swingProgress, '#fff5d8');
  } else if (w.id === 'bow') {
    const pull = swinging ? Math.sin(swingProgress * Math.PI) * 8 : 0;
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
    ctx.fillStyle = '#3a2010';
    ctx.fillRect(6, -5, 4, 10);
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
    const angle = swinging ? -Math.PI * 0.75 + swingProgress * Math.PI * 1.4 : 0;
    ctx.rotate(angle);
    const sgrad = ctx.createLinearGradient(0, -4, 0, 4);
    sgrad.addColorStop(0, '#5a3a1a');
    sgrad.addColorStop(1, '#2a1a08');
    ctx.fillStyle = sgrad;
    ctx.fillRect(0, -4, 44, 8);
    ctx.fillStyle = '#1a0a04';
    ctx.fillRect(8, -4, 2, 8);
    ctx.fillRect(20, -4, 2, 8);
    const hgrad = ctx.createLinearGradient(0, -16, 0, 16);
    hgrad.addColorStop(0, '#6a6a72');
    hgrad.addColorStop(0.5, '#4a4a52');
    hgrad.addColorStop(1, '#2a2a30');
    ctx.fillStyle = hgrad;
    roundRect(38, -18, 26, 36, 4);
    ctx.fill();
    ctx.fillStyle = '#9a9aa2';
    ctx.fillRect(38, -18, 4, 36);
    ctx.fillStyle = '#3a3a40';
    ctx.beginPath();
    ctx.moveTo(64, -10); ctx.lineTo(72, 0); ctx.lineTo(64, 10); ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#8a6020';
    ctx.beginPath(); ctx.arc(-4, 0, 5, 0, TAU); ctx.fill();
    if (swinging) drawSwingArc(0, 0, 60, swingProgress, '#cccccc');
  } else if (w.id === 'dagger') {
    const angle = swinging ? -Math.PI * 0.5 + swingProgress * Math.PI * 0.7 : Math.PI * 0.1;
    ctx.rotate(angle);
    // Quick stab dagger
    ctx.fillStyle = '#2a1a0a';
    ctx.fillRect(0, -2, 8, 4);
    ctx.fillStyle = '#aa3030';
    ctx.fillRect(8, -3, 4, 6);
    const bgrad = ctx.createLinearGradient(12, -2, 12, 2);
    bgrad.addColorStop(0, '#e0e0f0');
    bgrad.addColorStop(0.5, w.color);
    bgrad.addColorStop(1, '#7a7a8a');
    ctx.fillStyle = bgrad;
    ctx.beginPath();
    ctx.moveTo(12, -2); ctx.lineTo(34, -1);
    ctx.lineTo(38, 0);  ctx.lineTo(34, 1);
    ctx.lineTo(12, 2);  ctx.closePath();
    ctx.fill();
    if (swinging) drawSwingArc(0, 0, 32, swingProgress, '#e0e0f0');
  } else if (w.id === 'spear') {
    const angle = swinging ? -Math.PI * 0.2 + swingProgress * Math.PI * 0.4 : 0;
    ctx.rotate(angle);
    // Long shaft
    ctx.fillStyle = '#3a2a1a';
    ctx.fillRect(-6, -2, 70, 4);
    // grip wraps
    ctx.fillStyle = '#1a0a04';
    ctx.fillRect(0, -2, 2, 4);
    ctx.fillRect(10, -2, 2, 4);
    // Spear tip
    ctx.fillStyle = '#a8a0b0';
    ctx.beginPath();
    ctx.moveTo(64, -6);
    ctx.lineTo(86, 0);
    ctx.lineTo(64, 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#e0d8e0';
    ctx.beginPath();
    ctx.moveTo(64, -3);
    ctx.lineTo(82, 0);
    ctx.lineTo(64, 3);
    ctx.closePath();
    ctx.fill();
    // Crossguard at base of tip
    ctx.fillStyle = '#5a4a3a';
    ctx.fillRect(60, -8, 4, 16);
    if (swinging) {
      ctx.save();
      ctx.globalAlpha = (1 - swingProgress) * 0.5;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, -1, 86, 2);
      ctx.restore();
    }
  } else if (w.id === 'magicSword') {
    const angle = swinging ? -Math.PI * 0.65 + swingProgress * Math.PI * 0.95 : Math.PI * 0.05;
    ctx.rotate(angle);
    // Glowing aura around blade
    const aura = ctx.createRadialGradient(36, 0, 1, 36, 0, 30);
    aura.addColorStop(0, 'rgba(120, 200, 255, 0.5)');
    aura.addColorStop(1, 'rgba(120, 200, 255, 0)');
    ctx.fillStyle = aura;
    ctx.fillRect(0, -28, 70, 56);
    // Hilt
    ctx.fillStyle = '#3a3a5a';
    ctx.fillRect(0, -3, 10, 6);
    // Crossguard with gold
    ctx.fillStyle = '#aa8030';
    ctx.fillRect(8, -10, 6, 20);
    // Blade
    const bgrad = ctx.createLinearGradient(14, -4, 14, 4);
    bgrad.addColorStop(0, '#d8efff');
    bgrad.addColorStop(0.5, w.color);
    bgrad.addColorStop(1, '#3060a0');
    ctx.fillStyle = bgrad;
    ctx.beginPath();
    ctx.moveTo(14, -4); ctx.lineTo(58, -2);
    ctx.lineTo(66, 0);  ctx.lineTo(58, 2);
    ctx.lineTo(14, 4);  ctx.closePath();
    ctx.fill();
    // Runes (small marks)
    ctx.fillStyle = '#eaffff';
    for (let r = 0; r < 3; r++) {
      ctx.fillRect(20 + r * 12, -1, 2, 2);
    }
    // Pommel gem
    ctx.fillStyle = '#80c0ff';
    ctx.beginPath(); ctx.arc(-3, 0, 4, 0, TAU); ctx.fill();
    if (swinging) drawSwingArc(0, 0, 56, swingProgress, '#80c0ff');
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
  const alpha = dying ? Math.max(0, e.deathTimer / (e.isBoss ? 1.2 : 0.4)) : (e.type.ghostly ? 0.75 : 1);

  // Menace aura on dangerous mob types (drawn first, behind everything)
  const menaceAuras = {
    brute:   { r: 140, g: 20, b: 20, a: 0.30 },
    armored: { r: 30,  g: 30, b: 90, a: 0.30 },
    wraith:  { r: 130, g: 60, b: 200, a: 0.40 },
  };
  if (!dying && menaceAuras[e.typeId]) {
    const c = menaceAuras[e.typeId];
    const pulse = 0.7 + Math.sin(game.t * 2 + e.x * 0.01) * 0.3;
    const grad = ctx.createRadialGradient(x, y - e.h * 0.4, 4, x, y - e.h * 0.4, e.w * 1.6);
    grad.addColorStop(0, `rgba(${c.r}, ${c.g}, ${c.b}, ${c.a * pulse})`);
    grad.addColorStop(1, `rgba(${c.r}, ${c.g}, ${c.b}, 0)`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(x, y - e.h * 0.4, e.w * 1.5, e.h * 0.7, 0, 0, TAU);
    ctx.fill();
  }

  // Elite aura under feet (drawn before everything else)
  if (e.elite && !dying) {
    const pulse = 0.6 + Math.sin(game.t * 4 + e.x) * 0.25;
    const auraGrad = ctx.createRadialGradient(x, y, 4, x, y, e.w * 1.5);
    auraGrad.addColorStop(0, `rgba(255, 60, 60, ${0.5 * pulse})`);
    auraGrad.addColorStop(0.6, `rgba(255, 40, 40, ${0.2 * pulse})`);
    auraGrad.addColorStop(1, 'rgba(255, 40, 40, 0)');
    ctx.fillStyle = auraGrad;
    ctx.beginPath();
    ctx.ellipse(x, y, e.w * 1.5, 16, 0, 0, TAU);
    ctx.fill();
  }

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
  else if (e.typeId === 'goblin') drawGoblin(e);
  else if (e.typeId === 'wraith') drawWraith(e);
  else if (e.typeId === 'armored') drawArmored(e);
  else if (e.bossId === 'liche') drawLiche(e);
  else if (e.bossId === 'champion') drawChampion(e);
  else if (e.bossId === 'dragon') drawDragon(e);
  else if (e.bossId === 'necromancer') drawNecromancer(e);
  else if (e.bossId === 'golem') drawGolem(e);

  ctx.restore();

  if (!dying && e.hp < e.maxHp && !e.isBoss) {
    const bw = e.w + 8;
    const bx = x - bw / 2;
    const by = y - e.h - 14;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(bx, by, bw, 4);
    ctx.fillStyle = e.elite ? '#ff4040' : '#cc3030';
    ctx.fillRect(bx, by, bw * (e.hp / e.maxHp), 4);
    ctx.strokeStyle = e.elite ? 'rgba(255, 200, 100, 0.5)' : 'rgba(255, 255, 255, 0.15)';
    ctx.strokeRect(bx, by, bw, 4);
  }

  // Windup telegraph "!" above enemies about to use a skill
  const inWindup = e.skillState === 'windup' || (e.isBoss && e.ai && e.ai.state === 'windup');
  if (!dying && inWindup) {
    const cy = y - e.h - 30;
    const scale = 1 + Math.sin(game.t * 14) * 0.18;
    ctx.save();
    ctx.translate(x, cy);
    ctx.scale(scale, scale);
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillText('!', 1, 1);
    ctx.fillStyle = '#ff3030';
    ctx.fillText('!', 0, 0);
    ctx.restore();
  }

  // Elite crown indicator
  if (!dying && e.elite && !e.isBoss) {
    const cy = y - e.h - 22;
    ctx.fillStyle = '#ff4040';
    for (let i = -1; i <= 1; i++) {
      const cx = x + i * 7;
      ctx.beginPath();
      ctx.moveTo(cx - 3, cy);
      ctx.lineTo(cx, cy - 7);
      ctx.lineTo(cx + 3, cy);
      ctx.closePath();
      ctx.fill();
    }
    // base bar
    ctx.fillStyle = '#aa2020';
    ctx.fillRect(x - 12, cy, 24, 2);
  }
}

function drawSkeleton(e) {
  const flash = e.flash > 0;
  const walk = Math.sin(e.walkPhase) * 3;
  ctx.fillStyle = flash ? '#ffffff' : '#b8b0a0';
  ctx.fillRect(-7, -28, 5, 28);
  ctx.fillRect(2, -28, 5, 28 - Math.abs(walk));
  ctx.fillStyle = flash ? '#ffffff' : '#c8c0ac';
  ctx.fillRect(-9, -34, 18, 8);
  ctx.fillStyle = flash ? '#ffffff' : e.type.color;
  roundRect(-10, -e.h + 12, 20, e.h - 46, 3);
  ctx.fill();
  ctx.strokeStyle = flash ? '#ffeeee' : '#7a7060';
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 4; i++) {
    const ry = -e.h + 16 + i * 7;
    ctx.beginPath();
    ctx.moveTo(-9, ry);
    ctx.quadraticCurveTo(0, ry + 3, 9, ry);
    ctx.stroke();
  }
  ctx.fillStyle = flash ? '#ffffff' : '#a89878';
  ctx.fillRect(-1, -e.h + 14, 2, e.h - 48);
  ctx.fillStyle = flash ? '#ffffff' : '#c8c0ac';
  ctx.fillRect(-14, -e.h + 18, 4, 22);
  ctx.fillRect(10, -e.h + 18, 4, 22);
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
  ctx.fillStyle = flash ? '#ffffff' : '#ece4d0';
  ctx.beginPath();
  ctx.arc(0, -e.h + 8, 12, 0, TAU);
  ctx.fill();
  ctx.fillStyle = flash ? '#ffffff' : '#dcd4c0';
  ctx.fillRect(-6, -e.h + 14, 12, 4);
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 1;
  for (let i = -5; i < 6; i += 2) {
    ctx.beginPath();
    ctx.moveTo(i, -e.h + 14);
    ctx.lineTo(i, -e.h + 18);
    ctx.stroke();
  }
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.arc(-5, -e.h + 6, 3, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(5, -e.h + 6, 3, 0, TAU); ctx.fill();
  const glowGrad = ctx.createRadialGradient(0, -e.h + 6, 1, 0, -e.h + 6, 16);
  glowGrad.addColorStop(0, 'rgba(255, 50, 50, 0.4)');
  glowGrad.addColorStop(1, 'rgba(255, 50, 50, 0)');
  ctx.fillStyle = glowGrad;
  ctx.fillRect(-16, -e.h - 4, 32, 16);
  ctx.fillStyle = '#ff5050';
  ctx.beginPath(); ctx.arc(-5, -e.h + 6, 1.5, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(5, -e.h + 6, 1.5, 0, TAU); ctx.fill();
}

function drawBat(e) {
  const flash = e.flash > 0;
  const flap = Math.sin(e.bobble * 3) * 0.8;
  ctx.fillStyle = flash ? '#ffaaaa' : '#1a1020';
  ctx.beginPath();
  ctx.moveTo(0, -e.h * 0.45);
  ctx.quadraticCurveTo(-30, -e.h * 0.45 - 8 + flap * 12, -36, -e.h * 0.4 + flap * 8);
  ctx.quadraticCurveTo(-26, -e.h * 0.3 - flap * 4, -16, -e.h * 0.35);
  ctx.quadraticCurveTo(-22, -e.h * 0.25, 0, -e.h * 0.3);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0, -e.h * 0.45);
  ctx.quadraticCurveTo(30, -e.h * 0.45 - 8 + flap * 12, 36, -e.h * 0.4 + flap * 8);
  ctx.quadraticCurveTo(26, -e.h * 0.3 - flap * 4, 16, -e.h * 0.35);
  ctx.quadraticCurveTo(22, -e.h * 0.25, 0, -e.h * 0.3);
  ctx.fill();
  const bgrad = ctx.createRadialGradient(0, -e.h * 0.45, 2, 0, -e.h * 0.45, 12);
  bgrad.addColorStop(0, flash ? '#ffaaaa' : '#5a3a6a');
  bgrad.addColorStop(1, flash ? '#ffffff' : '#2a1a3a');
  ctx.fillStyle = bgrad;
  ctx.beginPath();
  ctx.ellipse(0, -e.h * 0.45, 11, 13, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = flash ? '#ffaaaa' : '#1a0a20';
  ctx.beginPath();
  ctx.moveTo(-7, -e.h * 0.6); ctx.lineTo(-9, -e.h * 0.75); ctx.lineTo(-3, -e.h * 0.6); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(7, -e.h * 0.6);  ctx.lineTo(9, -e.h * 0.75);  ctx.lineTo(3, -e.h * 0.6);  ctx.fill();
  ctx.fillStyle = '#ff3030';
  ctx.fillRect(-5, -e.h * 0.5, 3, 3);
  ctx.fillRect(2, -e.h * 0.5, 3, 3);
  ctx.fillStyle = '#ffaaaa';
  ctx.fillRect(-4, -e.h * 0.5, 1, 1);
  ctx.fillRect(3, -e.h * 0.5, 1, 1);
}

function drawBrute(e) {
  const flash = e.flash > 0;
  const walk = Math.sin(e.walkPhase) * 4;
  ctx.fillStyle = flash ? '#ffaaaa' : '#2a0a0a';
  ctx.fillRect(-12, -28, 10, 28);
  ctx.fillRect(2, -28, 10, 28 - Math.abs(walk));
  const bgrad = ctx.createLinearGradient(0, -e.h, 0, -28);
  bgrad.addColorStop(0, flash ? '#ffffff' : e.type.color);
  bgrad.addColorStop(1, flash ? '#ffaaaa' : e.type.accent);
  ctx.fillStyle = bgrad;
  roundRect(-e.w/2 + 4, -e.h + 14, e.w - 8, e.h - 42, 8);
  ctx.fill();
  ctx.fillStyle = flash ? '#ffd0d0' : '#7a3030';
  ctx.beginPath();
  ctx.ellipse(0, -36, 12, 16, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = flash ? '#ffaaaa' : '#1a0808';
  ctx.beginPath();
  ctx.arc(-e.w/2 + 6, -e.h + 22, 14, 0, TAU);
  ctx.arc(e.w/2 - 6, -e.h + 22, 14, 0, TAU);
  ctx.fill();
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
  ctx.fillStyle = flash ? '#ffaaaa' : '#3a1818';
  ctx.fillRect(-e.w/2 - 2, -e.h + 28, 8, 26);
  ctx.fillRect(e.w/2 - 6, -e.h + 28, 8, 26);
  ctx.fillStyle = flash ? '#ffaaaa' : '#5a2828';
  ctx.beginPath();
  ctx.arc(-e.w/2 + 2, -e.h + 56, 7, 0, TAU);
  ctx.arc(e.w/2 - 2, -e.h + 56, 7, 0, TAU);
  ctx.fill();
  ctx.fillStyle = flash ? '#ffffff' : '#2a0a0a';
  ctx.beginPath();
  ctx.arc(0, -e.h + 6, 16, 0, TAU);
  ctx.fill();
  ctx.fillStyle = flash ? '#ffaaaa' : '#1a0606';
  ctx.beginPath();
  ctx.ellipse(0, -e.h + 14, 9, 6, 0, 0, TAU);
  ctx.fill();
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
  ctx.fillStyle = '#e8e0c0';
  ctx.beginPath();
  ctx.moveTo(-5, -e.h + 16); ctx.lineTo(-4, -e.h + 22); ctx.lineTo(-3, -e.h + 16); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(5, -e.h + 16);  ctx.lineTo(4, -e.h + 22);  ctx.lineTo(3, -e.h + 16);  ctx.fill();
}

function drawGoblin(e) {
  const flash = e.flash > 0;
  const walk = Math.sin(e.walkPhase) * 3;
  // Legs
  ctx.fillStyle = flash ? '#ffaaaa' : '#2a4a2a';
  ctx.fillRect(-7, -22, 5, 22);
  ctx.fillRect(2, -22, 5, 22 - Math.abs(walk));
  // Body
  ctx.fillStyle = flash ? '#ffffff' : e.type.color;
  roundRect(-10, -e.h + 12, 20, e.h - 36, 4);
  ctx.fill();
  // Belly
  ctx.fillStyle = flash ? '#ffd0d0' : '#5a8a5a';
  ctx.beginPath();
  ctx.ellipse(0, -22, 7, 10, 0, 0, TAU);
  ctx.fill();
  // Loincloth
  ctx.fillStyle = '#3a2a1a';
  ctx.fillRect(-8, -16, 16, 6);
  // Arms
  ctx.fillStyle = flash ? '#ffaaaa' : e.type.color;
  ctx.fillRect(-13, -e.h + 16, 4, 18);
  ctx.fillRect(9, -e.h + 16, 4, 18);
  // Throwing dagger in right hand
  ctx.save();
  ctx.translate(11, -e.h + 32);
  ctx.rotate(-0.4);
  ctx.fillStyle = '#3a2a18';
  ctx.fillRect(0, -1, 4, 2);
  ctx.fillStyle = flash ? '#ffeeaa' : '#c8c0c8';
  ctx.beginPath();
  ctx.moveTo(4, -2); ctx.lineTo(12, 0); ctx.lineTo(4, 2); ctx.closePath();
  ctx.fill();
  ctx.restore();
  // Head
  ctx.fillStyle = flash ? '#ffffff' : e.type.color;
  ctx.beginPath();
  ctx.arc(0, -e.h + 8, 11, 0, TAU);
  ctx.fill();
  // Pointed ears
  ctx.fillStyle = flash ? '#ffaaaa' : e.type.accent;
  ctx.beginPath();
  ctx.moveTo(-9, -e.h + 4); ctx.lineTo(-15, -e.h - 2); ctx.lineTo(-7, -e.h + 8); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(9, -e.h + 4);  ctx.lineTo(15, -e.h - 2);  ctx.lineTo(7, -e.h + 8);  ctx.fill();
  // Eyes (yellow slits)
  ctx.fillStyle = '#ffd040';
  ctx.fillRect(-5, -e.h + 6, 3, 2);
  ctx.fillRect(2, -e.h + 6, 3, 2);
  ctx.fillStyle = '#000';
  ctx.fillRect(-4, -e.h + 6, 1, 2);
  ctx.fillRect(3, -e.h + 6, 1, 2);
  // Mouth with fangs
  ctx.fillStyle = '#1a0a04';
  ctx.fillRect(-4, -e.h + 12, 8, 2);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-3, -e.h + 13, 1, 2);
  ctx.fillRect(2, -e.h + 13, 1, 2);
  // Nose
  ctx.fillStyle = e.type.accent;
  ctx.fillRect(-1, -e.h + 9, 2, 3);
}

function drawWraith(e) {
  const flash = e.flash > 0;
  const sway = Math.sin(e.bobble * 1.5) * 4;
  const t = game.t;
  // Tail / robe (wispy below body)
  ctx.fillStyle = flash ? '#ffaaaa' : '#1a0a30';
  ctx.beginPath();
  ctx.moveTo(-14 + sway, -e.h + 30);
  ctx.quadraticCurveTo(-8 + sway, -8, -2 + sway, 0);
  ctx.quadraticCurveTo(2 + sway, -4, 6 + sway, 0);
  ctx.quadraticCurveTo(12 + sway, -8, 16 + sway, -e.h + 30);
  ctx.closePath();
  ctx.fill();
  // Body
  const bgrad = ctx.createRadialGradient(0, -e.h * 0.5, 4, 0, -e.h * 0.5, 24);
  bgrad.addColorStop(0, flash ? '#ffaaaa' : '#604080');
  bgrad.addColorStop(1, flash ? '#ffaaaa' : '#1a0a30');
  ctx.fillStyle = bgrad;
  ctx.beginPath();
  ctx.ellipse(0, -e.h * 0.5, 14, 22, 0, 0, TAU);
  ctx.fill();
  // Hood
  ctx.fillStyle = flash ? '#ffffff' : '#0a0420';
  ctx.beginPath();
  ctx.moveTo(-14, -e.h + 24);
  ctx.quadraticCurveTo(0, -e.h - 4, 14, -e.h + 24);
  ctx.lineTo(8, -e.h + 28);
  ctx.lineTo(-8, -e.h + 28);
  ctx.closePath();
  ctx.fill();
  // Glowing eyes inside hood
  const glow = ctx.createRadialGradient(0, -e.h + 18, 1, 0, -e.h + 18, 14);
  glow.addColorStop(0, `rgba(180, 100, 220, ${0.5 + Math.sin(t * 5) * 0.2})`);
  glow.addColorStop(1, 'rgba(180, 100, 220, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(-16, -e.h + 8, 32, 16);
  ctx.fillStyle = '#d8a0ff';
  ctx.fillRect(-5, -e.h + 18, 3, 2);
  ctx.fillRect(2, -e.h + 18, 3, 2);
  // Wispy arms
  ctx.fillStyle = flash ? '#ffaaaa' : '#3a2050';
  ctx.beginPath();
  ctx.moveTo(-12, -e.h * 0.5);
  ctx.quadraticCurveTo(-22 + sway, -e.h * 0.4, -20 + sway, -e.h * 0.2);
  ctx.quadraticCurveTo(-14, -e.h * 0.35, -10, -e.h * 0.5);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(12, -e.h * 0.5);
  ctx.quadraticCurveTo(22 + sway, -e.h * 0.4, 20 + sway, -e.h * 0.2);
  ctx.quadraticCurveTo(14, -e.h * 0.35, 10, -e.h * 0.5);
  ctx.fill();
}

function drawArmored(e) {
  const flash = e.flash > 0;
  const walk = Math.sin(e.walkPhase) * 3;
  // Heavy boots/legs
  ctx.fillStyle = flash ? '#ffaaaa' : '#1a1a22';
  ctx.fillRect(-10, -28, 8, 28);
  ctx.fillRect(2, -28, 8, 28 - Math.abs(walk));
  // Body armor (plate)
  const bgrad = ctx.createLinearGradient(0, -e.h, 0, -28);
  bgrad.addColorStop(0, flash ? '#ffffff' : e.type.color);
  bgrad.addColorStop(1, flash ? '#ffaaaa' : e.type.accent);
  ctx.fillStyle = bgrad;
  roundRect(-e.w/2 + 4, -e.h + 14, e.w - 8, e.h - 42, 4);
  ctx.fill();
  // Plate ridges
  ctx.strokeStyle = flash ? '#ffd0d0' : '#1a1a22';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 3; i++) {
    const ry = -e.h + 22 + i * 8;
    ctx.beginPath();
    ctx.moveTo(-e.w/2 + 6, ry);
    ctx.lineTo(e.w/2 - 6, ry);
    ctx.stroke();
  }
  // Pauldrons
  ctx.fillStyle = flash ? '#ffaaaa' : '#3a3a4a';
  ctx.beginPath();
  ctx.arc(-e.w/2 + 4, -e.h + 22, 11, 0, TAU);
  ctx.arc(e.w/2 - 4, -e.h + 22, 11, 0, TAU);
  ctx.fill();
  // Shield (front)
  ctx.fillStyle = flash ? '#ffaaaa' : '#3a1818';
  roundRect(e.w/2 - 6, -e.h + 30, 14, 30, 4);
  ctx.fill();
  ctx.fillStyle = flash ? '#ffffff' : '#a08040';
  ctx.fillRect(e.w/2 - 1, -e.h + 38, 4, 14);
  // Helm (closed)
  ctx.fillStyle = flash ? '#ffffff' : '#3a3a44';
  ctx.beginPath();
  ctx.moveTo(-12, -e.h + 4);
  ctx.lineTo(-12, -e.h + 22);
  ctx.lineTo(-8, -e.h + 28);
  ctx.lineTo(8, -e.h + 28);
  ctx.lineTo(12, -e.h + 22);
  ctx.lineTo(12, -e.h + 4);
  ctx.quadraticCurveTo(0, -e.h - 4, -12, -e.h + 4);
  ctx.closePath();
  ctx.fill();
  // Visor cross
  ctx.fillStyle = '#0a0a10';
  ctx.fillRect(-9, -e.h + 12, 18, 2);
  ctx.fillRect(-1, -e.h + 8, 2, 14);
  // Crest
  ctx.fillStyle = flash ? '#ffd0d0' : '#7a1a1a';
  ctx.fillRect(-2, -e.h - 6, 4, 8);
  ctx.fillRect(-4, -e.h - 6, 8, 2);
}

// ============ Bosses ============
function drawLiche(b) {
  const flash = b.flash > 0;
  const t = game.t;
  // Robe (long flowing)
  ctx.fillStyle = flash ? '#ffaaaa' : '#15082a';
  ctx.beginPath();
  ctx.moveTo(-26, 0);
  ctx.lineTo(-22, -b.h + 30);
  ctx.lineTo(-18, -b.h + 18);
  ctx.lineTo(18, -b.h + 18);
  ctx.lineTo(22, -b.h + 30);
  ctx.lineTo(26, 0);
  ctx.closePath();
  ctx.fill();
  // Robe accent
  ctx.fillStyle = flash ? '#ffaaaa' : '#2a1a4a';
  ctx.beginPath();
  ctx.moveTo(-2, -b.h + 18);
  ctx.lineTo(-6, 0);
  ctx.lineTo(6, 0);
  ctx.lineTo(2, -b.h + 18);
  ctx.closePath();
  ctx.fill();
  // Skeletal arms
  ctx.fillStyle = flash ? '#ffffff' : '#d8d0bc';
  ctx.fillRect(-22, -b.h + 24, 4, 26);
  ctx.fillRect(18, -b.h + 24, 4, 26);
  // Staff
  ctx.fillStyle = '#3a2a18';
  ctx.fillRect(20, -b.h + 14, 3, 70);
  ctx.fillStyle = b.type.accent;
  ctx.beginPath();
  const orbGlow = ctx.createRadialGradient(22, -b.h + 8, 1, 22, -b.h + 8, 14);
  orbGlow.addColorStop(0, 'rgba(160, 220, 255, 0.9)');
  orbGlow.addColorStop(1, 'rgba(160, 220, 255, 0)');
  ctx.fillStyle = orbGlow;
  ctx.fillRect(8, -b.h - 6, 28, 28);
  ctx.fillStyle = '#a0d8ff';
  ctx.beginPath();
  ctx.arc(22, -b.h + 8, 6, 0, TAU);
  ctx.fill();
  // Hood
  ctx.fillStyle = flash ? '#ffffff' : '#0a0420';
  ctx.beginPath();
  ctx.moveTo(-16, -b.h + 24);
  ctx.quadraticCurveTo(0, -b.h - 6, 16, -b.h + 24);
  ctx.lineTo(10, -b.h + 32);
  ctx.lineTo(-10, -b.h + 32);
  ctx.closePath();
  ctx.fill();
  // Glowing eyes inside
  const glow = ctx.createRadialGradient(0, -b.h + 22, 1, 0, -b.h + 22, 18);
  glow.addColorStop(0, `rgba(160, 220, 255, ${0.6 + Math.sin(t * 4) * 0.2})`);
  glow.addColorStop(1, 'rgba(160, 220, 255, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(-18, -b.h + 12, 36, 18);
  ctx.fillStyle = '#a0d8ff';
  ctx.fillRect(-6, -b.h + 22, 4, 3);
  ctx.fillRect(2, -b.h + 22, 4, 3);
  // Necklace skull
  ctx.fillStyle = flash ? '#ffffff' : '#d8d0bc';
  ctx.beginPath();
  ctx.arc(0, -b.h + 36, 5, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#0a0410';
  ctx.fillRect(-2, -b.h + 35, 1, 1);
  ctx.fillRect(1, -b.h + 35, 1, 1);
}

function drawChampion(b) {
  const flash = b.flash > 0;
  const walk = Math.sin(b.walkPhase) * 3;
  // Big legs
  ctx.fillStyle = flash ? '#ffaaaa' : '#1a1a22';
  ctx.fillRect(-14, -32, 12, 32);
  ctx.fillRect(2, -32, 12, 32 - Math.abs(walk));
  // Belt
  ctx.fillStyle = '#3a1a08';
  ctx.fillRect(-22, -34, 44, 6);
  // Body armor
  const bgrad = ctx.createLinearGradient(0, -b.h, 0, -34);
  bgrad.addColorStop(0, flash ? '#ffffff' : '#7a7a82');
  bgrad.addColorStop(1, flash ? '#ffaaaa' : '#3a3a44');
  ctx.fillStyle = bgrad;
  roundRect(-b.w/2 + 6, -b.h + 18, b.w - 12, b.h - 52, 6);
  ctx.fill();
  // Chest crest
  ctx.fillStyle = flash ? '#ffd0d0' : '#aa7030';
  ctx.beginPath();
  ctx.moveTo(0, -b.h + 24);
  ctx.lineTo(-12, -b.h + 50);
  ctx.lineTo(0, -b.h + 44);
  ctx.lineTo(12, -b.h + 50);
  ctx.closePath();
  ctx.fill();
  // Spike pauldrons
  ctx.fillStyle = flash ? '#ffaaaa' : '#2a2a30';
  ctx.beginPath();
  ctx.arc(-b.w/2 + 4, -b.h + 26, 16, 0, TAU);
  ctx.arc(b.w/2 - 4, -b.h + 26, 16, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#1a1a20';
  for (const side of [-1, 1]) {
    for (let i = -1; i <= 1; i++) {
      const sx = side * (b.w/2 - 4) + i * 7;
      ctx.beginPath();
      ctx.moveTo(sx - 3, -b.h + 14);
      ctx.lineTo(sx, -b.h);
      ctx.lineTo(sx + 3, -b.h + 14);
      ctx.fill();
    }
  }
  // Arms
  ctx.fillStyle = flash ? '#ffaaaa' : '#3a3a44';
  ctx.fillRect(-b.w/2 - 2, -b.h + 36, 10, 30);
  ctx.fillRect(b.w/2 - 8, -b.h + 36, 10, 30);
  // Massive hammer in right hand
  ctx.save();
  ctx.translate(b.w/2 - 4, -b.h + 56);
  ctx.rotate(0.2);
  ctx.fillStyle = '#3a1a08';
  ctx.fillRect(0, -3, 36, 6);
  ctx.fillStyle = '#5a5a62';
  roundRect(28, -16, 22, 32, 3);
  ctx.fill();
  ctx.fillStyle = '#9a9aa2';
  ctx.fillRect(28, -16, 4, 32);
  ctx.fillStyle = '#aa7030';
  ctx.fillRect(46, -8, 6, 16);
  ctx.restore();
  // Helm — full helm with crown
  ctx.fillStyle = flash ? '#ffffff' : '#5a5a62';
  ctx.beginPath();
  ctx.moveTo(-14, -b.h + 6);
  ctx.lineTo(-14, -b.h + 24);
  ctx.lineTo(-10, -b.h + 30);
  ctx.lineTo(10, -b.h + 30);
  ctx.lineTo(14, -b.h + 24);
  ctx.lineTo(14, -b.h + 6);
  ctx.quadraticCurveTo(0, -b.h - 6, -14, -b.h + 6);
  ctx.closePath();
  ctx.fill();
  // Crown spikes
  ctx.fillStyle = flash ? '#ffd0d0' : '#aa7030';
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 5 - 1, -b.h - 2);
    ctx.lineTo(i * 5, -b.h - 12);
    ctx.lineTo(i * 5 + 1, -b.h - 2);
    ctx.fill();
  }
  // Visor
  ctx.fillStyle = '#0a0a10';
  ctx.fillRect(-10, -b.h + 14, 20, 4);
  // Glowing eyes
  ctx.fillStyle = '#ffaa00';
  ctx.fillRect(-7, -b.h + 14, 4, 3);
  ctx.fillRect(3, -b.h + 14, 4, 3);
}

function drawDragon(b) {
  const flash = b.flash > 0;
  const flap = Math.sin(b.bobble * 2) * 0.6;
  const facing = -1; // dragon usually faces left toward player who is to the left
  // Wings
  ctx.fillStyle = flash ? '#ffaaaa' : '#2a0808';
  ctx.beginPath();
  ctx.moveTo(0, -b.h * 0.4);
  ctx.quadraticCurveTo(-50, -b.h * 0.4 - 20 + flap * 18, -64, -b.h * 0.3 + flap * 12);
  ctx.quadraticCurveTo(-44, -b.h * 0.2 - flap * 6, -20, -b.h * 0.3);
  ctx.quadraticCurveTo(-30, -b.h * 0.2, 0, -b.h * 0.25);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0, -b.h * 0.4);
  ctx.quadraticCurveTo(50, -b.h * 0.4 - 20 + flap * 18, 64, -b.h * 0.3 + flap * 12);
  ctx.quadraticCurveTo(44, -b.h * 0.2 - flap * 6, 20, -b.h * 0.3);
  ctx.quadraticCurveTo(30, -b.h * 0.2, 0, -b.h * 0.25);
  ctx.fill();
  // Wing spines
  ctx.strokeStyle = 'rgba(80, 20, 20, 0.6)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, -b.h * 0.4);
  ctx.lineTo(-50, -b.h * 0.35 + flap * 12);
  ctx.moveTo(0, -b.h * 0.4);
  ctx.lineTo(50, -b.h * 0.35 + flap * 12);
  ctx.stroke();
  // Body
  const bgrad = ctx.createLinearGradient(0, -b.h, 0, 0);
  bgrad.addColorStop(0, flash ? '#ffffff' : '#5a1818');
  bgrad.addColorStop(1, flash ? '#ffaaaa' : '#1a0606');
  ctx.fillStyle = bgrad;
  ctx.beginPath();
  ctx.ellipse(0, -b.h * 0.4, 26, 22, 0, 0, TAU);
  ctx.fill();
  // Belly
  ctx.fillStyle = flash ? '#ffd0d0' : '#7a3030';
  ctx.beginPath();
  ctx.ellipse(0, -b.h * 0.3, 16, 14, 0, 0, TAU);
  ctx.fill();
  // Tail
  ctx.fillStyle = flash ? '#ffaaaa' : '#3a0c0c';
  ctx.beginPath();
  ctx.moveTo(20 * facing, -b.h * 0.5);
  ctx.quadraticCurveTo(45 * facing, -b.h * 0.4 + flap * 6, 60 * facing, -b.h * 0.6);
  ctx.lineTo(60 * facing, -b.h * 0.6);
  ctx.quadraticCurveTo(50 * facing, -b.h * 0.45 + flap * 6, 22 * facing, -b.h * 0.45);
  ctx.fill();
  // Head (long snout left)
  ctx.fillStyle = flash ? '#ffffff' : '#4a1010';
  ctx.beginPath();
  ctx.ellipse(-22, -b.h * 0.4, 16, 12, -0.2, 0, TAU);
  ctx.fill();
  // Snout tip
  ctx.fillStyle = flash ? '#ffaaaa' : '#2a0606';
  ctx.beginPath();
  ctx.ellipse(-34, -b.h * 0.35, 9, 6, -0.3, 0, TAU);
  ctx.fill();
  // Horns
  ctx.fillStyle = '#0a0202';
  ctx.beginPath();
  ctx.moveTo(-20, -b.h * 0.5);
  ctx.lineTo(-22, -b.h * 0.6 - 10);
  ctx.lineTo(-14, -b.h * 0.55);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-12, -b.h * 0.5);
  ctx.lineTo(-10, -b.h * 0.6 - 12);
  ctx.lineTo(-6, -b.h * 0.55);
  ctx.fill();
  // Glowing orange eye
  const glow = ctx.createRadialGradient(-22, -b.h * 0.42, 1, -22, -b.h * 0.42, 12);
  glow.addColorStop(0, `rgba(255, 100, 30, ${0.6 + Math.sin(game.t * 5) * 0.2})`);
  glow.addColorStop(1, 'rgba(255, 100, 30, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(-32, -b.h * 0.5, 20, 18);
  ctx.fillStyle = '#ffaa30';
  ctx.beginPath();
  ctx.arc(-22, -b.h * 0.42, 3, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#000';
  ctx.fillRect(-23, -b.h * 0.42, 1, 3);
  // Teeth
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(-30 - i * 2, -b.h * 0.32);
    ctx.lineTo(-30 - i * 2, -b.h * 0.28);
    ctx.lineTo(-29 - i * 2, -b.h * 0.32);
    ctx.fill();
  }
}

function drawNecromancer(b) {
  const flash = b.flash > 0;
  const t = game.t;
  // Long flowing dark green robe
  ctx.fillStyle = flash ? '#ffaaaa' : '#0a2418';
  ctx.beginPath();
  ctx.moveTo(-26, 0);
  ctx.lineTo(-22, -b.h + 30);
  ctx.lineTo(-18, -b.h + 18);
  ctx.lineTo(18, -b.h + 18);
  ctx.lineTo(22, -b.h + 30);
  ctx.lineTo(26, 0);
  ctx.closePath();
  ctx.fill();
  // Robe accent center
  ctx.fillStyle = flash ? '#ffd0d0' : '#1a4830';
  ctx.beginPath();
  ctx.moveTo(-2, -b.h + 18);
  ctx.lineTo(-6, 0);
  ctx.lineTo(6, 0);
  ctx.lineTo(2, -b.h + 18);
  ctx.closePath();
  ctx.fill();
  // Skeletal arms
  ctx.fillStyle = flash ? '#ffffff' : '#d8d0bc';
  ctx.fillRect(-22, -b.h + 24, 4, 28);
  ctx.fillRect(18, -b.h + 24, 4, 28);
  // Skull held in left hand
  ctx.fillStyle = flash ? '#ffffff' : '#e8e0c8';
  ctx.beginPath();
  ctx.arc(-22, -b.h + 56, 7, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#0a0a10';
  ctx.fillRect(-25, -b.h + 54, 2, 2);
  ctx.fillRect(-21, -b.h + 54, 2, 2);
  // Staff (right side)
  ctx.fillStyle = '#1a3010';
  ctx.fillRect(20, -b.h + 14, 3, 70);
  // Staff orb glow
  const orbGlow = ctx.createRadialGradient(22, -b.h + 8, 1, 22, -b.h + 8, 18);
  orbGlow.addColorStop(0, `rgba(120, 255, 170, ${0.7 + Math.sin(t * 5) * 0.2})`);
  orbGlow.addColorStop(1, 'rgba(120, 255, 170, 0)');
  ctx.fillStyle = orbGlow;
  ctx.fillRect(8, -b.h - 8, 28, 32);
  ctx.fillStyle = '#80ffaa';
  ctx.beginPath();
  ctx.arc(22, -b.h + 8, 6, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#d0ffe0';
  ctx.beginPath();
  ctx.arc(20, -b.h + 6, 2, 0, TAU);
  ctx.fill();
  // Hood
  ctx.fillStyle = flash ? '#ffffff' : '#04140c';
  ctx.beginPath();
  ctx.moveTo(-16, -b.h + 24);
  ctx.quadraticCurveTo(0, -b.h - 6, 16, -b.h + 24);
  ctx.lineTo(10, -b.h + 32);
  ctx.lineTo(-10, -b.h + 32);
  ctx.closePath();
  ctx.fill();
  // Glowing green eyes
  const glow = ctx.createRadialGradient(0, -b.h + 22, 1, 0, -b.h + 22, 18);
  glow.addColorStop(0, `rgba(120, 255, 170, ${0.6 + Math.sin(t * 4) * 0.2})`);
  glow.addColorStop(1, 'rgba(120, 255, 170, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(-18, -b.h + 12, 36, 18);
  ctx.fillStyle = '#80ffaa';
  ctx.fillRect(-6, -b.h + 22, 4, 3);
  ctx.fillRect(2, -b.h + 22, 4, 3);
  // Floating skulls around (lore decoration)
  for (let i = 0; i < 3; i++) {
    const a = t * 0.8 + i * (TAU / 3);
    const ox = Math.cos(a) * 32;
    const oy = -b.h * 0.3 + Math.sin(a) * 14;
    ctx.fillStyle = `rgba(220, 220, 200, ${0.5 + Math.sin(a) * 0.2})`;
    ctx.beginPath();
    ctx.arc(ox, oy, 4, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.fillRect(ox - 2, oy - 1, 1, 1);
    ctx.fillRect(ox + 1, oy - 1, 1, 1);
  }
}

function drawGolem(b) {
  const flash = b.flash > 0;
  const t = game.t;
  const walk = Math.sin(b.walkPhase) * 4;
  // Heavy stone legs
  ctx.fillStyle = flash ? '#ffaaaa' : '#3a2a18';
  ctx.fillRect(-22, -36, 18, 36);
  ctx.fillRect(4, -36, 18, 36 - Math.abs(walk));
  // Belt of stone
  ctx.fillStyle = flash ? '#ffd0d0' : '#5a4030';
  ctx.fillRect(-30, -42, 60, 8);
  // Body — massive stone
  const grad = ctx.createLinearGradient(0, -b.h, 0, -36);
  grad.addColorStop(0, flash ? '#ffffff' : '#7a6a4a');
  grad.addColorStop(0.5, flash ? '#ffd0d0' : b.type.color);
  grad.addColorStop(1, flash ? '#ffaaaa' : '#3a2818');
  ctx.fillStyle = grad;
  roundRect(-b.w/2 + 4, -b.h + 22, b.w - 8, b.h - 60, 10);
  ctx.fill();
  // Glowing core (yellow rune in chest)
  const corePulse = 0.7 + Math.sin(t * 3) * 0.3;
  const coreGlow = ctx.createRadialGradient(0, -b.h * 0.5, 1, 0, -b.h * 0.5, 28);
  coreGlow.addColorStop(0, `rgba(255, 200, 80, ${corePulse})`);
  coreGlow.addColorStop(1, 'rgba(255, 200, 80, 0)');
  ctx.fillStyle = coreGlow;
  ctx.fillRect(-30, -b.h * 0.5 - 28, 60, 56);
  ctx.fillStyle = `rgba(255, 230, 100, ${corePulse})`;
  // Diamond rune
  ctx.beginPath();
  ctx.moveTo(0, -b.h * 0.5 - 10);
  ctx.lineTo(8, -b.h * 0.5);
  ctx.lineTo(0, -b.h * 0.5 + 10);
  ctx.lineTo(-8, -b.h * 0.5);
  ctx.closePath();
  ctx.fill();
  // Cracks across body (with subtle glow)
  ctx.strokeStyle = `rgba(255, 200, 80, ${corePulse * 0.5})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-20, -b.h + 30);
  ctx.lineTo(-10, -b.h * 0.5);
  ctx.lineTo(-16, -b.h * 0.4);
  ctx.moveTo(18, -b.h + 30);
  ctx.lineTo(8, -b.h * 0.5);
  ctx.lineTo(14, -b.h * 0.3);
  ctx.stroke();
  // Massive shoulders/pauldrons
  ctx.fillStyle = flash ? '#ffaaaa' : '#3a2818';
  ctx.beginPath();
  ctx.arc(-b.w/2 + 4, -b.h + 30, 18, 0, TAU);
  ctx.arc(b.w/2 - 4, -b.h + 30, 18, 0, TAU);
  ctx.fill();
  // Rocky chunks on shoulders
  ctx.fillStyle = '#5a4830';
  for (const side of [-1, 1]) {
    for (let i = -1; i <= 1; i++) {
      const sx = side * (b.w/2 - 4) + i * 8;
      ctx.beginPath();
      ctx.moveTo(sx - 4, -b.h + 18);
      ctx.lineTo(sx, -b.h + 8);
      ctx.lineTo(sx + 4, -b.h + 18);
      ctx.closePath();
      ctx.fill();
    }
  }
  // Massive arms
  ctx.fillStyle = flash ? '#ffaaaa' : '#5a4030';
  ctx.fillRect(-b.w/2 - 4, -b.h + 40, 14, 38);
  ctx.fillRect(b.w/2 - 10, -b.h + 40, 14, 38);
  // Stone fists
  ctx.fillStyle = flash ? '#ffffff' : '#6a5040';
  ctx.beginPath();
  ctx.arc(-b.w/2 + 3, -b.h + 80, 12, 0, TAU);
  ctx.arc(b.w/2 - 3, -b.h + 80, 12, 0, TAU);
  ctx.fill();
  // Knuckles
  ctx.fillStyle = '#3a2818';
  for (const side of [-1, 1]) {
    for (let i = -1; i <= 1; i++) {
      ctx.fillRect(side * (b.w/2 - 3) + i * 4 - 1, -b.h + 76, 2, 4);
    }
  }
  // Head (smaller, blocky)
  ctx.fillStyle = flash ? '#ffffff' : '#5a4030';
  roundRect(-14, -b.h + 4, 28, 28, 4);
  ctx.fill();
  // Glowing eyes
  const eyeGlow = ctx.createRadialGradient(0, -b.h + 14, 1, 0, -b.h + 14, 20);
  eyeGlow.addColorStop(0, `rgba(255, 200, 80, ${corePulse * 0.6})`);
  eyeGlow.addColorStop(1, 'rgba(255, 200, 80, 0)');
  ctx.fillStyle = eyeGlow;
  ctx.fillRect(-20, -b.h + 4, 40, 22);
  ctx.fillStyle = '#ffe080';
  ctx.fillRect(-7, -b.h + 12, 5, 4);
  ctx.fillRect(2, -b.h + 12, 5, 4);
  // Crown of rock spikes
  ctx.fillStyle = flash ? '#ffd0d0' : '#3a2818';
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 6 - 2, -b.h + 4);
    ctx.lineTo(i * 6, -b.h - 8);
    ctx.lineTo(i * 6 + 2, -b.h + 4);
    ctx.fill();
  }
}

// ============ Coin ============
function drawCoin(c) {
  const x = sX(c.x), y = c.y;
  const bob = Math.sin(game.t * 6 + c.x) * 1.5;
  const wobble = Math.cos(c.spin) * 0.7 + 0.3;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.ellipse(x, c.groundY + 4, 5, 1.5, 0, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.translate(x, y - 4 + bob);
  ctx.scale(wobble, 1);
  ctx.fillStyle = '#aa6010';
  ctx.beginPath();
  ctx.arc(0, 0, 7, 0, TAU);
  ctx.fill();
  const grad = ctx.createRadialGradient(-1.5, -1.5, 1, 0, 0, 6);
  grad.addColorStop(0, '#fff5b0');
  grad.addColorStop(0.5, '#ffd040');
  grad.addColorStop(1, '#a87010');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, 5.5, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#a85020';
  ctx.fillRect(-2, -0.8, 4, 1.6);
  ctx.fillRect(-0.8, -2, 1.6, 4);
  ctx.restore();
  const glow = ctx.createRadialGradient(x, y - 4 + bob, 1, x, y - 4 + bob, 14);
  glow.addColorStop(0, 'rgba(255, 220, 100, 0.25)');
  glow.addColorStop(1, 'rgba(255, 220, 100, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - 14, y - 18 + bob, 28, 28);
}

// ============ Projectiles ============
function drawProjectiles() {
  for (const pr of game.projectiles) {
    const x = sX(pr.x), y = pr.y;
    if (pr.kind === 'arrow') {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.atan2(pr.vy, pr.vx));
      ctx.fillStyle = 'rgba(255, 200, 120, 0.35)';
      ctx.beginPath();
      ctx.ellipse(-12, 0, 16, 1.5, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#7a5a3a';
      ctx.fillRect(-14, -1, 24, 2);
      ctx.fillStyle = '#e8dcb0';
      ctx.beginPath();
      ctx.moveTo(10, -3); ctx.lineTo(18, 0); ctx.lineTo(10, 3); ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#b04040';
      ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(-20, -3); ctx.lineTo(-14, -1); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(-20, 3);  ctx.lineTo(-14, 1); ctx.fill();
      ctx.restore();
    } else if (pr.kind === 'slashWave') {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(pr.facing, 1);
      const a = clamp(pr.life / 0.7, 0, 1);
      const grad = ctx.createRadialGradient(0, 0, 1, 0, 0, 50);
      grad.addColorStop(0, `rgba(180, 230, 255, ${0.6 * a})`);
      grad.addColorStop(0.6, `rgba(80, 160, 255, ${0.3 * a})`);
      grad.addColorStop(1, 'rgba(80, 160, 255, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, 50, 0, TAU);
      ctx.fill();
      // Crescent slash shape
      ctx.strokeStyle = `rgba(220, 240, 255, ${0.85 * a})`;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(-20, 0, 40, -0.6, 0.6);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.95 * a})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(-20, 0, 40, -0.6, 0.6);
      ctx.stroke();
      ctx.restore();
    } else if (pr.kind === 'shadowBolt') {
      const wobble = pr.wobble || 0;
      const r = 9 + Math.sin(wobble) * 2;
      const grad = ctx.createRadialGradient(x, y, 1, x, y, 18);
      grad.addColorStop(0, 'rgba(180, 100, 220, 0.85)');
      grad.addColorStop(0.5, 'rgba(80, 30, 120, 0.6)');
      grad.addColorStop(1, 'rgba(40, 0, 60, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, 18, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#1a0220';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#a060d0';
      ctx.beginPath();
      ctx.arc(x - 2, y - 2, r * 0.4, 0, TAU);
      ctx.fill();
    } else if (pr.kind === 'fireball') {
      const wobble = pr.wobble || 0;
      const r = 11 + Math.sin(wobble) * 2;
      const grad = ctx.createRadialGradient(x, y, 2, x, y, 22);
      grad.addColorStop(0, 'rgba(255, 240, 180, 0.95)');
      grad.addColorStop(0.4, 'rgba(255, 120, 30, 0.7)');
      grad.addColorStop(1, 'rgba(180, 30, 0, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, 22, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#ffe080';
      ctx.beginPath();
      ctx.arc(x, y, r * 0.5, 0, TAU);
      ctx.fill();
    } else if (pr.kind === 'rock') {
      pr.spin += 0.15;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(pr.spin);
      // Rock shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
      ctx.beginPath(); ctx.arc(2, 2, 14, 0, TAU); ctx.fill();
      // Rock body (irregular)
      const grad = ctx.createRadialGradient(-3, -3, 1, 0, 0, 16);
      grad.addColorStop(0, '#a89478');
      grad.addColorStop(1, '#3a2818');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(-12, -8);
      ctx.lineTo(-4, -14);
      ctx.lineTo(8, -12);
      ctx.lineTo(14, -2);
      ctx.lineTo(10, 10);
      ctx.lineTo(-2, 14);
      ctx.lineTo(-12, 8);
      ctx.closePath();
      ctx.fill();
      // Cracks
      ctx.strokeStyle = '#1a0a04';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-6, -4);
      ctx.lineTo(2, 0);
      ctx.lineTo(6, 6);
      ctx.stroke();
      ctx.restore();
    } else if (pr.kind === 'goblinDagger') {
      pr.spin += 0.4;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(pr.spin);
      ctx.fillStyle = '#3a2a18';
      ctx.fillRect(-2, -1, 4, 2);
      ctx.fillStyle = '#c8c0c8';
      ctx.beginPath();
      ctx.moveTo(2, -2); ctx.lineTo(10, 0); ctx.lineTo(2, 2); ctx.closePath();
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
  pauseModal.classList.remove('visible');
  forgeModal.classList.remove('visible');
  bossBar.classList.remove('visible');
  game.challengeMode = challengeInput.checked;
  game.pauseFromMenu = false;
  // Apply persistent forge equipment
  const eq = loadForge();
  game.equipment = eq;
  game.equipDR = ARMOR_DR[eq.armor];
  bossIntro.classList.remove('visible');
  stageToast.classList.remove('visible');
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
  game.stage = 1;
  game.bossActive = false;
  game.boss = null;
  game.bossNextAt = 250;
  game.bossesDefeated = 0;
  game.unlockedWeapons = new Set(['sword', 'bow', 'hammer']);
  game.upgrades = {
    damageMul: RING_DMG[game.equipment.ring] || 1,
    speedMul: 1,
    weaponBonus: { sword: 1, bow: 1, hammer: 1, dagger: 1, spear: 1, magicSword: 1 },
    purchased: new Set(),
    stacks: {},
  };
  // Apply helmet HP bonus
  const helmHp = HELM_HP[game.equipment.helmet] || 0;
  if (helmHp > 0) {
    game.player.maxHp += helmHp;
    game.player.hp = game.player.maxHp;
  }
  killsEl.textContent = '☠ 0';
  coinsEl.textContent = '⛁ 0';
  stageEl.textContent = 'Étage 1';
  hpBar.style.width = '100%';
  hpText.textContent = '100/100';
  updateWeaponUI();
}

function gameOver() {
  game.running = false;
  game.paused = false;
  shopModal.classList.remove('visible');
  bossBar.classList.remove('visible');
  const distance = Math.floor(game.cameraX / 50);
  const current = {
    stage: game.stage,
    distance,
    kills: game.kills,
    coins: game.coins,
    bossesDefeated: game.bossesDefeated,
  };
  const prevBest = loadBestRun();
  const best = updateBestRun(current);
  const isNewRecord = current.stage > prevBest.stage
    || (current.stage === prevBest.stage && current.distance > prevBest.distance);
  const essenceGain = gainEssences(current.coins);
  overlay.querySelector('h1').textContent = isNewRecord ? 'Nouveau record !' : 'Tu es tombé';
  overlay.querySelector('.subtitle').innerHTML =
    `Étage ${current.stage} · ${current.distance} m · ${current.kills} kills · ${current.coins} ⛁`
    + (essenceGain > 0 ? `<br><span style="font-size:13px;color:#c0e0ff;">+${essenceGain} ⛧ essences pour la Forge</span>` : '')
    + `<br><span style="font-size:11px;opacity:0.7;letter-spacing:2px;">Record : étage ${best.stage} · ${best.distance} m · ${best.bossesDefeated} boss</span>`;
  startBtn.textContent = 'Recommencer';
  overlay.classList.add('visible');
  refreshStartOverlay();
}

function refreshStartOverlay() {
  const best = loadBestRun();
  const f = loadForge();
  essenceCountEl.textContent = f.essences;
  if (best.stage > 0) {
    overlay.querySelector('.subtitle').innerHTML =
      `Avance dans les ténèbres<br><span style="font-size:11px;opacity:0.7;letter-spacing:2px;">Record : étage ${best.stage} · ${best.distance} m · ${best.bossesDefeated} boss</span>`;
  }
}

// ============ Forge UI ============
function openForge() {
  renderForge();
  forgeModal.classList.add('visible');
}
function closeForge() {
  forgeModal.classList.remove('visible');
  refreshStartOverlay();
}

function renderForge() {
  const f = loadForge();
  forgeEssenceEl.textContent = '⛧ ' + f.essences;
  forgeList.innerHTML = '';
  let lastSlot = null;
  for (const item of FORGE_TIERS) {
    if (item.slot !== lastSlot) {
      const header = document.createElement('div');
      header.className = 'forge-slot-header';
      header.textContent = SLOT_LABELS[item.slot];
      forgeList.appendChild(header);
      lastSlot = item.slot;
    }
    const owned = f[item.slot] >= item.tier;
    const requiredPrev = item.tier - 1;
    const locked = !owned && f[item.slot] < requiredPrev;
    const card = document.createElement('div');
    card.className = 'shop-item forge-item';
    if (owned) card.classList.add('owned');
    else if (locked) card.classList.add('locked', 'disabled');
    else if (f.essences < item.cost) card.classList.add('disabled');
    const tierTag = owned ? '<span class="forge-tag owned-tag">Équipé</span>' : `<span class="forge-tag tier-${item.tier}">T${item.tier}</span>`;
    card.innerHTML = `
      <div class="shop-icon">${item.icon}</div>
      <div class="shop-info">
        <div class="shop-name">${item.name} ${tierTag}</div>
        <div class="shop-desc">${item.desc}${locked ? ` · Nécessite tier ${requiredPrev}` : ''}</div>
      </div>
      <div class="shop-price">${owned ? '✓' : `⛧ ${item.cost}`}</div>
    `;
    if (!owned && !locked) {
      card.addEventListener('click', () => buyForgeItem(item));
    }
    forgeList.appendChild(card);
  }
}

function buyForgeItem(item) {
  const f = loadForge();
  if (f[item.slot] >= item.tier) return;
  if (f[item.slot] < item.tier - 1) return;
  if (f.essences < item.cost) return;
  f.essences -= item.cost;
  f[item.slot] = item.tier;
  saveForge(f);
  audio.purchase();
  renderForge();
  essenceCountEl.textContent = f.essences;
}

// ============ Pause / Mute / Challenge ============
function openPauseMenu() {
  if (!game.running || game.paused) return;
  game.paused = true;
  game.pauseFromMenu = true;
  input.move.x = 0; input.move.y = 0;
  input.attack = false;
  joyTouchId = null;
  joyStick.style.transform = 'translate(-50%, -50%)';
  pauseModal.classList.add('visible');
}

function closePauseMenu() {
  pauseModal.classList.remove('visible');
  if (game.pauseFromMenu) {
    game.paused = false;
    game.pauseFromMenu = false;
  }
}

function quitToMainMenu() {
  pauseModal.classList.remove('visible');
  game.pauseFromMenu = false;
  gameOver();
}

pauseBtn.addEventListener('click', () => { audio.click(); openPauseMenu(); });
pauseResume.addEventListener('click', () => { audio.click(); closePauseMenu(); });
pauseQuit.addEventListener('click', () => { audio.click(); quitToMainMenu(); });

// Mute toggle
const MUTE_KEY = 'shadowcrawl-muted';
function applyMutedState() {
  const m = localStorage.getItem(MUTE_KEY) === '1';
  audio.setMuted(m);
  muteBtn.textContent = m ? '🔇' : '🔊';
  muteBtn.classList.toggle('muted', m);
}
muteBtn.addEventListener('click', () => {
  const cur = audio.isMuted();
  const next = !cur;
  localStorage.setItem(MUTE_KEY, next ? '1' : '0');
  applyMutedState();
  if (!next) audio.click();
});
applyMutedState();

// Challenge mode persistence
const CHALLENGE_KEY = 'shadowcrawl-challenge';
challengeInput.checked = localStorage.getItem(CHALLENGE_KEY) === '1';
challengeInput.addEventListener('change', () => {
  localStorage.setItem(CHALLENGE_KEY, challengeInput.checked ? '1' : '0');
});

// First user gesture: unlock audio context (required by browsers)
function unlockAudio() {
  audio.ensure();
  window.removeEventListener('pointerdown', unlockAudio);
  window.removeEventListener('keydown', unlockAudio);
}
window.addEventListener('pointerdown', unlockAudio);
window.addEventListener('keydown', unlockAudio);

// ESC closes pause/shop
window.addEventListener('keydown', e => {
  if (e.code === 'Escape') {
    if (game.paused) {
      if (shopModal.classList.contains('visible')) closeShop();
      else if (pauseModal.classList.contains('visible')) closePauseMenu();
    } else if (game.running) {
      openPauseMenu();
    }
  }
  if (e.code === 'KeyP' && game.running) {
    if (game.pauseFromMenu) closePauseMenu();
    else if (!game.paused) openPauseMenu();
  }
});

forgeBtn.addEventListener('click', () => { audio.ensure(); audio.click(); openForge(); });
forgeClose.addEventListener('click', () => { audio.click(); closeForge(); });
startBtn.addEventListener('click', () => { audio.ensure(); startGame(); });
refreshStartOverlay();
updateWeaponUI();
requestAnimationFrame(loop);
})();
