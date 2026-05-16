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
const comboHud = document.getElementById('combo-hud');
const comboNumEl = document.getElementById('combo-num');
const comboBarFill = document.getElementById('combo-bar-fill');
const bossWarningEl = document.getElementById('boss-warning');
const lowHpVignette = document.getElementById('low-hp-vignette');
const flashFxEl = document.getElementById('flash-fx');

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
    bossWarn() { tone({ freq: 110, sweepTo: 70, duration: 0.45, volume: 0.30, type: 'sawtooth' }); tone({ freq: 220, duration: 0.45, volume: 0.20, type: 'square', delay: 0.05 }); },
    comboBreak(){ tone({ freq: 320, sweepTo: 90, duration: 0.30, volume: 0.20, type: 'sawtooth' }); },
    chestOpen(){ tone({ freq: 880, duration: 0.10, volume: 0.25, type: 'triangle' }); tone({ freq: 1320, duration: 0.10, volume: 0.20, type: 'triangle', delay: 0.06 }); tone({ freq: 1760, duration: 0.16, volume: 0.18, type: 'sine', delay: 0.12 }); },
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
  props: [],
  lastPropX: 0,
  atmoParticles: [],
  creatures: [],            // ambient living things per biome (bats, ghosts, etc.)
  foreground: [],           // 1st-plane silhouettes that pass IN FRONT of the player
  worldEvent: null,         // { kind, timer, intensity } — biome-specific events
  worldEventCooldown: 4,
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
  // Combo system
  combo: 0,
  comboTimer: 0,
  comboBest: 0,
  // Game feel
  hitstop: 0,                // freezes update for that many seconds
  flashFx: 0,                // full-screen flash (white) intensity
  bossWarning: 0,            // pulse intensity when boss is near
  bossWarned: false,
  // Chest event
  chestSpawnedAt: 0,
  chest: null,
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
  // Critical hits: 10% base chance, ×2 damage
  const isCrit = Math.random() < 0.10;
  if (isCrit) dmg *= 2;

  e.hp -= dmg;
  e.flash = 0.15;
  e.knockback = Math.abs(knockback) * (e.isBoss ? 0.25 : 1);
  e.knockbackDir = Math.sign(knockback) || 1;
  game.damageNums.push({
    x: e.x + rand(-8, 8), y: e.y - e.h * 0.65,
    vy: -90 - (isCrit ? 30 : 0),
    text: (isCrit ? '✦' : '') + Math.round(dmg),
    life: isCrit ? 0.9 : 0.7, maxLife: isCrit ? 0.9 : 0.7,
    color: isCrit ? '#ffd040' : (dmg >= 50 ? '#ffcc40' : '#ff7070'),
    big: isCrit || dmg >= 50,
    crit: isCrit,
  });
  if (isCrit) {
    // Crit sparkle particles
    for (let i = 0; i < 8; i++) {
      const a = rand(0, TAU);
      game.particles.push({
        x: e.x, y: e.y - e.h * 0.5,
        vx: Math.cos(a) * rand(120, 220),
        vy: Math.sin(a) * rand(120, 220),
        life: 0.45, maxLife: 0.45,
        color: '#fff0a0', size: 2.5,
      });
    }
    game.shake = Math.max(game.shake, 8);
  }
  if (dmg >= 50 || e.isBoss || isCrit) audio.hitBig(); else audio.hit();
  if (e.hp <= 0 && !e.dead) {
    e.dead = true;
    e.deathTimer = e.isBoss ? 1.2 : 0.4;
    game.kills += 1;
    killsEl.textContent = '☠ ' + game.kills;
    // Combo: increment on kill, refresh timer
    game.combo += 1;
    game.comboTimer = 3.0;
    if (game.combo > game.comboBest) game.comboBest = game.combo;
    refreshComboUI();
    // Hit-stop for game feel (longer for bosses/crit kills)
    game.hitstop = Math.max(game.hitstop, e.isBoss ? 0.12 : (isCrit ? 0.06 : 0.035));
    spawnDeathParticles(e);
    if (e.isBoss) audio.bossDie(); else audio.enemyDie();
    let [lo, hi] = e.type.coinDrop;
    if (e.elite) { lo = Math.round(lo * 1.8); hi = Math.round(hi * 1.8); }
    // Combo coin bonus: ×1 / ×1.25 / ×1.5 / ×2 at thresholds 5/10/20
    const comboMul = game.combo >= 20 ? 2 : (game.combo >= 10 ? 1.5 : (game.combo >= 5 ? 1.25 : 1));
    const n = Math.floor(rand(lo, hi + 1) * comboMul);
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

// ============ Chest event ============
function maybeSpawnChest() {
  if (game.bossActive) return;
  if (game.chest) return;
  const meters = game.cameraX / 50;
  const sinceLast = meters - game.chestSpawnedAt;
  // After 100m from last chest, and not within 60m of next boss
  if (sinceLast < 100) return;
  if (game.bossNextAt - meters < 60) return;
  if (Math.random() < 0.0009) {
    const cx = game.cameraX + W + rand(180, 320);
    game.chest = {
      x: cx,
      y: (bandTop + bandBot) / 2 + 16,
      opened: false,
      openTimer: 0,
      pulse: 0,
    };
    game.chestSpawnedAt = meters;
  }
}

function updateChest(dt) {
  maybeSpawnChest();
  if (!game.chest) return;
  const ch = game.chest;
  ch.pulse += dt * 3;
  if (!ch.opened) {
    const p = game.player;
    const dx = p.x - ch.x;
    const dy = p.y - ch.y;
    if (dx * dx + dy * dy < 40 * 40) {
      ch.opened = true;
      ch.openTimer = 1.6;
      // Burst rewards: coins, hp, essence shimmer
      const coinN = 18 + Math.floor(rand(8, 18));
      for (let i = 0; i < coinN; i++) {
        game.pickups.push({
          kind: 'coin',
          x: ch.x + rand(-8, 8), y: ch.y - 8,
          vx: rand(-280, 280),
          vy: rand(-420, -240),
          onGround: false, groundY: ch.y + 4,
          life: 20, spin: rand(0, TAU), spinVel: rand(4, 9), magnet: false,
        });
      }
      // Heal partial
      const heal = Math.round(p.maxHp * 0.35);
      p.hp = Math.min(p.maxHp, p.hp + heal);
      refreshHpUI();
      game.damageNums.push({
        x: ch.x, y: ch.y - 30, vy: -90,
        text: '+' + heal + ' PV',
        life: 1.4, maxLife: 1.4,
        color: '#80ffaa', big: true,
      });
      // Sparkle particles
      for (let i = 0; i < 30; i++) {
        const a = rand(0, TAU);
        const sp = rand(120, 320);
        game.particles.push({
          x: ch.x, y: ch.y - 12,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80,
          life: 0.9, maxLife: 0.9,
          color: i % 3 === 0 ? '#ffe080' : (i % 3 === 1 ? '#fff0c0' : '#80ffaa'),
          size: 3,
        });
      }
      game.flashFx = 0.4;
      audio.chestOpen && audio.chestOpen();
    }
  } else {
    ch.openTimer -= dt;
    if (ch.openTimer <= 0) game.chest = null;
  }
  // Despawn if far behind
  if (ch && ch.x < game.cameraX - 200) game.chest = null;
}

function drawChest() {
  if (!game.chest) return;
  const ch = game.chest;
  const x = sX(ch.x);
  const y = ch.y;
  // Ground shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.beginPath();
  ctx.ellipse(x, y + 8, 28, 6, 0, 0, TAU);
  ctx.fill();
  // Glow halo
  const pulse = 0.5 + Math.sin(ch.pulse) * 0.3;
  const glow = ctx.createRadialGradient(x, y - 6, 4, x, y - 6, 60);
  glow.addColorStop(0, `rgba(255, 220, 100, ${0.6 * pulse})`);
  glow.addColorStop(1, 'rgba(255, 200, 80, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - 60, y - 60, 120, 80);
  // Chest body
  ctx.fillStyle = '#3a2614';
  roundRect(x - 22, y - 18, 44, 26, 3);
  ctx.fill();
  ctx.strokeStyle = '#1a0e06';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Iron bands
  ctx.fillStyle = '#1a1208';
  ctx.fillRect(x - 22, y - 8, 44, 3);
  ctx.fillRect(x - 22, y + 4, 44, 3);
  // Chest lid (lifts when opened)
  ctx.save();
  ctx.translate(x, y - 18);
  if (ch.opened) ctx.rotate(-Math.min(1.2, (1.6 - ch.openTimer) * 1.5));
  ctx.fillStyle = '#4a3018';
  ctx.beginPath();
  ctx.moveTo(-22, 0);
  ctx.quadraticCurveTo(0, -16, 22, 0);
  ctx.lineTo(22, 4);
  ctx.lineTo(-22, 4);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#1a0e06';
  ctx.stroke();
  // Lock
  if (!ch.opened) {
    ctx.fillStyle = '#d4a040';
    ctx.fillRect(-4, -4, 8, 8);
    ctx.fillStyle = '#1a0e06';
    ctx.fillRect(-1, -1, 2, 4);
  }
  ctx.restore();
  // Inner glow when opened
  if (ch.opened) {
    const innerGlow = ctx.createRadialGradient(x, y - 12, 1, x, y - 12, 30);
    innerGlow.addColorStop(0, `rgba(255, 240, 180, ${ch.openTimer * 0.6})`);
    innerGlow.addColorStop(1, 'rgba(255, 200, 80, 0)');
    ctx.fillStyle = innerGlow;
    ctx.fillRect(x - 30, y - 40, 60, 40);
  }
  // Sparkle on top
  if (!ch.opened) {
    const sx = x + Math.cos(ch.pulse * 2) * 16;
    const sy = y - 30 + Math.sin(ch.pulse * 3) * 4;
    ctx.fillStyle = `rgba(255, 240, 180, ${pulse})`;
    ctx.beginPath();
    ctx.arc(sx, sy, 2, 0, TAU);
    ctx.fill();
  }
}

function updateEmbers(dt) {
  if (Math.random() < dt * 22) {
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
  // Lock camera at this point (used by render/update bounds)
  game.bossArenaX = game.cameraX;
  // Big spawn flash & shake
  game.flashFx = 0.5;
  game.shake = Math.max(game.shake, 14);
  game.bossWarning = 0;
  game.bossWarned = false;
}

function onBossDefeated(boss) {
  game.bossActive = false;
  game.boss = null;
  game.bossesDefeated += 1;
  game.stage += 1;
  game.bossWarning = 0;
  game.bossWarned = false;
  // Next boss further away
  game.bossNextAt = Math.floor(game.cameraX / 50) + 250;
  bossBar.classList.remove('visible');
  // Victory flash + shake
  game.flashFx = 0.7;
  game.shake = Math.max(game.shake, 20);
  // Bonus heal on stage clear (25% maxHp)
  const p = game.player;
  if (p && p.hp > 0) {
    const heal = Math.round(p.maxHp * 0.25);
    p.hp = Math.min(p.maxHp, p.hp + heal);
    refreshHpUI();
    game.damageNums.push({
      x: p.x, y: p.y - p.h * 0.8, vy: -100,
      text: '+' + heal + ' PV',
      life: 1.5, maxLife: 1.5,
      color: '#80ffaa', big: true,
    });
  }
  const biome = getBiome();
  stageEl.textContent = `Étage ${game.stage} · ${biome.name}`;

  // Stage toast
  stageToastTitle.textContent = `Étage ${game.stage} — ${biome.name}`;
  stageToastSub.textContent = biome.sub;
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
  const ratio = clamp(p.hp / p.maxHp, 0, 1);
  hpBar.style.width = (ratio * 100) + '%';
  hpText.textContent = Math.max(0, Math.round(p.hp)) + '/' + p.maxHp;
  if (lowHpVignette) {
    if (ratio < 0.3 && game.running) lowHpVignette.classList.add('visible');
    else lowHpVignette.classList.remove('visible');
  }
}

function refreshComboUI() {
  if (!comboHud) return;
  if (game.combo < 2) {
    comboHud.classList.remove('visible', 'hot', 'fire');
    return;
  }
  comboHud.classList.add('visible');
  comboHud.classList.toggle('hot', game.combo >= 5 && game.combo < 15);
  comboHud.classList.toggle('fire', game.combo >= 15);
  comboNumEl.textContent = 'x' + game.combo;
}

function updateComboBar() {
  if (!comboBarFill) return;
  if (game.combo >= 2) {
    comboBarFill.style.width = clamp((game.comboTimer / 3.0) * 100, 0, 100) + '%';
  }
}

function updateBossWarningUI() {
  if (!bossWarningEl) return;
  if (game.bossWarning > 0.3 && !game.bossActive) bossWarningEl.classList.add('visible');
  else bossWarningEl.classList.remove('visible');
}

function updateFlashFxUI() {
  if (!flashFxEl) return;
  flashFxEl.style.opacity = game.flashFx > 0 ? Math.min(0.6, game.flashFx) : 0;
}

shopBtn.addEventListener('click', toggleShop);
shopClose.addEventListener('click', closeShop);

// ============ Main loop ============
let lastT = 0;
function loop(t) {
  const rawDt = Math.min(0.033, (t - lastT) / 1000);
  lastT = t;
  game.t += rawDt;

  if (game.running && !game.paused) {
    // Hit-stop: if active, freeze gameplay update (keep rendering for FX)
    if (game.hitstop > 0) {
      game.hitstop -= rawDt;
    } else {
      update(rawDt);
    }
  }
  if (game.flashFx > 0) game.flashFx = Math.max(0, game.flashFx - rawDt * 4);
  render(rawDt);
  updateComboBar();
  updateBossWarningUI();
  updateFlashFxUI();

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

    // Particle trails per projectile kind
    if (pr.kind === 'shadowBolt' && Math.random() < 0.7) {
      game.particles.push({
        x: pr.x + rand(-3, 3), y: pr.y + rand(-3, 3),
        vx: rand(-25, 25), vy: rand(-25, 25),
        life: 0.4, maxLife: 0.4,
        color: '#a060c0', size: 2.5,
      });
    } else if (pr.kind === 'fireball' && Math.random() < 0.85) {
      game.particles.push({
        x: pr.x, y: pr.y,
        vx: rand(-20, 20), vy: rand(-50, -10),
        life: 0.45, maxLife: 0.45,
        color: Math.random() < 0.5 ? '#ff8030' : '#ffe080', size: 3,
      });
    } else if (pr.kind === 'rock' && Math.random() < 0.4) {
      game.particles.push({
        x: pr.x, y: pr.y,
        vx: rand(-15, 15), vy: rand(-15, 15),
        life: 0.5, maxLife: 0.5,
        color: '#7a6a4a', size: 2,
      });
    } else if (pr.kind === 'slashWave' && Math.random() < 0.7) {
      game.particles.push({
        x: pr.x + rand(-15, 15), y: pr.y + rand(-15, 15),
        vx: rand(-15, 15), vy: rand(-15, 15),
        life: 0.4, maxLife: 0.4,
        color: '#80c0ff', size: 2.5,
      });
    } else if (pr.kind === 'arrow' && Math.random() < 0.4) {
      game.particles.push({
        x: pr.x, y: pr.y,
        vx: rand(-8, 8), vy: rand(-8, 8),
        life: 0.18, maxLife: 0.18,
        color: '#e8dcb0', size: 1.4,
      });
    }

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
  maybeSpawnProp();
  updateProps();
  updateAtmosphere(dt);
  updateChest(dt);
  updateCreatures(dt);
  maybeSpawnForeground();
  updateForeground(dt);
  updateWorldEvents(dt);

  // Combo timer decay
  if (game.combo > 0) {
    game.comboTimer -= dt;
    if (game.comboTimer <= 0) {
      if (game.combo >= 5) audio.coin && audio.comboBreak && audio.comboBreak();
      game.combo = 0;
      refreshComboUI();
    }
  }

  // Boss approach warning (50m before)
  if (!game.bossActive) {
    const meters = game.cameraX / 50;
    const dist = game.bossNextAt - meters;
    if (dist > 0 && dist <= 50) {
      game.bossWarning = 1 - dist / 50;
      if (!game.bossWarned && dist < 35) {
        game.bossWarned = true;
        audio.bossWarn && audio.bossWarn();
      }
    } else {
      game.bossWarning *= Math.max(0, 1 - dt * 4);
    }
  } else {
    game.bossWarning *= Math.max(0, 1 - dt * 4);
  }

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
  drawCreaturesBack();    // ambient living things (bats, souls, glowbugs, books, hammers)
  drawGround();
  drawAtmosphere(dt);
  drawProps();

  if (game.player) {
    const all = [];
    for (const e of game.enemies) all.push({ y: e.y, draw: () => drawEnemy(e) });
    for (const c of game.pickups) all.push({ y: c.y, draw: () => drawCoin(c) });
    if (game.chest) all.push({ y: game.chest.y, draw: () => drawChest() });
    all.push({ y: game.player.y, draw: () => drawPlayer() });
    all.sort((a, b) => a.y - b.y);
    for (const item of all) item.draw();

    drawProjectiles();
    drawParticles();
    drawForeground();     // 1st-plane hanging things IN FRONT of entities
    drawDamageNums();
    drawWorldEventOverlay();
    drawTorchOverlay();
  }

  ctx.restore();
}

// ============ Biomes ============
const BIOMES = [
  {
    id: 'dungeon', name: 'Donjon', sub: 'Le donjon s\'enfonce...',
    skyTop: '#06060c', skyBot: '#0a0a14',
    floorTop: '#1a1a24', floorBot: '#0a0a10',
    pillar: ['#15151f', '#26262e', '#15151f'],
    pillarCap: '#1c1c26',
    crackColor: 'rgba(60, 50, 70, 0.35)',
    floorPattern: 'cobble',
    floorTint: 'rgba(255,255,255,0.04)',
    edgeColor: 'rgba(120, 80, 60, 0.4)',
    torchFlame: ['rgba(255, 230, 120, ', 'rgba(255, 140, 40, ', 'rgba(180, 40, 0, 0)'],
    torchCore: 'rgba(255, 240, 180, ',
    emberColor: 'rgba(255, 130, 50, ',
    propTypes: ['skull', 'crackedSlab'],
    fogTint: null,
    ceilingType: 'arches',
  },
  {
    id: 'crypts', name: 'Cryptes', sub: 'Les cryptes s\'ouvrent...',
    skyTop: '#04100a', skyBot: '#0a1810',
    floorTop: '#1a2418', floorBot: '#0a120a',
    pillar: ['#0a1a14', '#1a3022', '#0a1a14'],
    pillarCap: '#102018',
    crackColor: 'rgba(80, 160, 100, 0.25)',
    floorPattern: 'crackedStone',
    floorTint: 'rgba(140, 220, 140, 0.05)',
    edgeColor: 'rgba(100, 180, 100, 0.4)',
    torchFlame: ['rgba(140, 255, 160, ', 'rgba(60, 200, 90, ', 'rgba(20, 100, 40, 0)'],
    torchCore: 'rgba(200, 255, 220, ',
    emberColor: 'rgba(80, 220, 120, ',
    propTypes: ['coffin', 'bones', 'skull'],
    fogTint: 'rgba(60, 200, 100, 0.04)',
    ceilingType: 'chains',
  },
  {
    id: 'caves', name: 'Cavernes Souterraines', sub: 'L\'écho des profondeurs...',
    skyTop: '#06080e', skyBot: '#0c1018',
    floorTop: '#1a1c28', floorBot: '#08080f',
    pillar: ['#1a2028', '#2a3040', '#1a2028'],
    pillarCap: '#202632',
    crackColor: 'rgba(120, 160, 220, 0.25)',
    floorPattern: 'rough',
    floorTint: 'rgba(120, 180, 220, 0.04)',
    edgeColor: 'rgba(100, 140, 180, 0.4)',
    torchFlame: ['rgba(140, 200, 255, ', 'rgba(60, 130, 220, ', 'rgba(20, 60, 140, 0)'],
    torchCore: 'rgba(220, 240, 255, ',
    emberColor: 'rgba(120, 180, 240, ',
    propTypes: ['stalagmite', 'mushroom', 'puddle'],
    fogTint: 'rgba(80, 140, 220, 0.05)',
    ceilingType: 'stalactites',
  },
  {
    id: 'library', name: 'Bibliothèque Hantée', sub: 'Les pages murmurent...',
    skyTop: '#0c0814', skyBot: '#150a20',
    floorTop: '#1c1428', floorBot: '#0c0612',
    pillar: ['#1a1428', '#2a1a3a', '#1a1428'],
    pillarCap: '#22182e',
    crackColor: 'rgba(180, 100, 220, 0.30)',
    floorPattern: 'planks',
    floorTint: 'rgba(180, 120, 220, 0.04)',
    edgeColor: 'rgba(140, 80, 180, 0.5)',
    torchFlame: ['rgba(220, 140, 255, ', 'rgba(140, 60, 220, ', 'rgba(70, 20, 130, 0)'],
    torchCore: 'rgba(240, 200, 255, ',
    emberColor: 'rgba(180, 120, 220, ',
    propTypes: ['bookshelf', 'candle', 'book'],
    fogTint: 'rgba(140, 80, 200, 0.05)',
    ceilingType: 'books',
  },
  {
    id: 'forge', name: 'Forge Oubliée', sub: 'Les forges s\'embrasent...',
    skyTop: '#180806', skyBot: '#241008',
    floorTop: '#2a1408', floorBot: '#0a0606',
    pillar: ['#1a0808', '#3a1810', '#1a0808'],
    pillarCap: '#221008',
    crackColor: 'rgba(255, 100, 30, 0.4)',
    floorPattern: 'magma',
    floorTint: 'rgba(255, 120, 40, 0.06)',
    edgeColor: 'rgba(200, 80, 30, 0.6)',
    torchFlame: ['rgba(255, 200, 80, ', 'rgba(255, 90, 30, ', 'rgba(160, 30, 0, 0)'],
    torchCore: 'rgba(255, 240, 200, ',
    emberColor: 'rgba(255, 120, 40, ',
    propTypes: ['anvil', 'magmaCrack', 'forgeBlock'],
    fogTint: 'rgba(255, 100, 40, 0.06)',
    ceilingType: 'magma',
  },
];

function getBiome() {
  const idx = (game.stage - 1) % BIOMES.length;
  return BIOMES[idx];
}

// ============ Background ============
function drawBackground(dt) {
  const biome = getBiome();

  // 1. Sky / distance gradient (the void behind any opening)
  const skyGrad = ctx.createLinearGradient(0, 0, 0, bandTop);
  skyGrad.addColorStop(0, biome.skyTop);
  skyGrad.addColorStop(1, biome.skyBot);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, W, bandTop);

  // 2. CONTINUOUS BACK WALL — gives the world architectural coherence.
  //    Drawn first; then openings (windows, niches) cut through it visually.
  drawBackWall(biome);

  // 3. Far iconic biome openings (windows, niches, crystals) — embedded IN the wall
  drawFarBiome(biome);

  // 4. Ceiling decoration per biome
  drawCeiling(biome);

  // 5. Subtle cracks across the wall
  ctx.strokeStyle = biome.crackColor;
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

  // 6. Mid biome decor (gargoyles, chandeliers, etc.)
  drawMidBiome(biome);

  // 7. Dense mid-distance silhouette layer
  drawMidSilhouettes(biome);

  // 8. PILLARS — now span FULL height from ceiling (0) to floor (bandTop)
  const midOff = (game.cameraX * 0.5) % 360;
  for (let i = -1; i < W / 360 + 2; i++) {
    const x = i * 360 - midOff;
    drawPillar(x, biome);
  }

  // 9. Wall torches — mounted on the back wall with brackets
  const torchOff = (game.cameraX * 0.6) % 280;
  for (let i = -1; i < W / 280 + 2; i++) {
    const x = i * 280 + 140 - torchOff;
    drawWallTorch(x, bandTop * 0.62, biome);
  }

  // 10. Biome fog tint
  if (biome.fogTint) {
    ctx.fillStyle = biome.fogTint;
    ctx.fillRect(0, 0, W, bandTop);
  }
}

// ============ Back wall (continuous structure behind everything) ============
function drawBackWall(biome) {
  const wallTop = 28;       // below the ceiling decor
  const wallBot = bandTop;  // meets the floor
  const wallH = wallBot - wallTop;

  // Base wall color per biome (deeper than sky, ties the room together)
  const wallColors = {
    dungeon: { base: '#16121c', light: '#221c2a', shadow: '#0a0710', mortar: '#04030a' },
    crypts:  { base: '#0e1a14', light: '#1a2a1e', shadow: '#06100a', mortar: '#02060a' },
    caves:   { base: '#12161e', light: '#1c2230', shadow: '#080a12', mortar: '#02040a' },
    library: { base: '#18102a', light: '#241844', shadow: '#0a0618', mortar: '#04020c' },
    forge:   { base: '#180a08', light: '#2a1410', shadow: '#0a0604', mortar: '#04020a' },
  };
  const c = wallColors[biome.id] || wallColors.dungeon;

  // Solid wall base with subtle vertical gradient (slightly darker near floor)
  const grad = ctx.createLinearGradient(0, wallTop, 0, wallBot);
  grad.addColorStop(0, c.base);
  grad.addColorStop(0.7, c.base);
  grad.addColorStop(1, c.shadow);
  ctx.fillStyle = grad;
  ctx.fillRect(0, wallTop, W, wallH);

  // Brick courses — parallax 0.45 so they scroll with the wall
  const off = (game.cameraX * 0.45) % 64;
  const rowH = 18;
  const rows = Math.ceil(wallH / rowH) + 1;
  ctx.lineWidth = 1;
  ctx.strokeStyle = c.mortar;

  for (let r = 0; r < rows; r++) {
    const y = wallTop + r * rowH;
    if (y > wallBot) break;
    // Horizontal mortar line
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
    // Vertical mortar lines, offset every other row (brick pattern)
    const stagger = r % 2 ? 32 : 0;
    const cellOff = (off + stagger) % 64;
    for (let x = -cellOff; x < W + 64; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + rowH);
      ctx.stroke();
      // Per-brick subtle highlight (top edge)
      if (((Math.floor((x + game.cameraX * 0.45 + stagger) / 64) * 7 + r * 13) % 5) === 0) {
        ctx.fillStyle = c.light;
        ctx.fillRect(x + 1, y + 1, 62, 1);
      }
    }
  }

  // Worn patches (random darker stains, deterministic per region)
  const stainOff = (game.cameraX * 0.45) % 320;
  for (let i = -1; i < W / 320 + 2; i++) {
    const sx = i * 320 - stainOff;
    const worldTile = Math.floor((i * 320 + game.cameraX * 0.45) / 320);
    const seed = ((worldTile * 2654435761) >>> 0) / 0xFFFFFFFF;
    if (seed < 0.5) continue;
    const stainGrad = ctx.createRadialGradient(sx + 60, wallTop + 60 + seed * 80, 5, sx + 60, wallTop + 60 + seed * 80, 80);
    stainGrad.addColorStop(0, c.shadow);
    stainGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = stainGrad;
    ctx.fillRect(sx, wallTop, 160, wallH);
  }

  // Floor baseboard (heavy stone line where wall meets floor)
  ctx.fillStyle = c.shadow;
  ctx.fillRect(0, wallBot - 4, W, 4);
  ctx.fillStyle = c.light;
  ctx.fillRect(0, wallBot - 4, W, 1);
}

// ============ Far biome layer (deep wall) ============
// Dense mid-distance silhouette layer (between far structures and props) — kills the empty feeling
function drawMidSilhouettes(biome) {
  const id = biome.id;
  const off = (game.cameraX * 0.40) % 90;
  const base = bandTop - 4;
  for (let i = -1; i < W / 90 + 2; i++) {
    const x = i * 90 - off;
    // Deterministic per-tile seed based on world-x
    const worldTile = Math.floor((i * 90 + game.cameraX * 0.40) / 90);
    const seed = ((worldTile * 1103515245 + 12345) >>> 0) / 0xFFFFFFFF;
    if (id === 'dungeon') {
      // Broken pillars + low walls
      if (seed < 0.6) {
        const h = 50 + seed * 80;
        ctx.fillStyle = '#08060e';
        ctx.fillRect(x, base - h, 22, h);
        // Crenellation top
        ctx.fillStyle = '#0a0810';
        ctx.fillRect(x, base - h - 4, 6, 4);
        ctx.fillRect(x + 8, base - h - 4, 6, 4);
        ctx.fillRect(x + 16, base - h - 4, 6, 4);
      } else if (seed < 0.85) {
        // Arch silhouette
        ctx.fillStyle = '#06040c';
        ctx.beginPath();
        ctx.moveTo(x, base);
        ctx.lineTo(x, base - 70);
        ctx.quadraticCurveTo(x + 20, base - 95, x + 40, base - 70);
        ctx.lineTo(x + 40, base);
        ctx.lineTo(x + 30, base);
        ctx.lineTo(x + 30, base - 60);
        ctx.quadraticCurveTo(x + 20, base - 78, x + 10, base - 60);
        ctx.lineTo(x + 10, base);
        ctx.closePath();
        ctx.fill();
      }
    } else if (id === 'crypts') {
      if (seed < 0.5) {
        // Tombstone
        ctx.fillStyle = '#0a1810';
        ctx.beginPath();
        ctx.moveTo(x + 4, base);
        ctx.lineTo(x + 4, base - 40);
        ctx.quadraticCurveTo(x + 14, base - 50, x + 24, base - 40);
        ctx.lineTo(x + 24, base);
        ctx.closePath();
        ctx.fill();
        // Cross
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(x + 13, base - 36, 2, 18);
        ctx.fillRect(x + 9, base - 30, 10, 2);
      } else if (seed < 0.8) {
        // Open coffin standing
        ctx.fillStyle = '#0a1a10';
        ctx.beginPath();
        ctx.moveTo(x + 6, base);
        ctx.lineTo(x + 4, base - 60);
        ctx.lineTo(x + 12, base - 70);
        ctx.lineTo(x + 22, base - 70);
        ctx.lineTo(x + 30, base - 60);
        ctx.lineTo(x + 28, base);
        ctx.closePath();
        ctx.fill();
        // Inner dark
        ctx.fillStyle = '#020806';
        ctx.fillRect(x + 10, base - 56, 14, 50);
      }
    } else if (id === 'caves') {
      if (seed < 0.55) {
        // Tall stalagmite cluster
        ctx.fillStyle = '#0a0e16';
        for (let s = 0; s < 3; s++) {
          const sx = x + s * 9 + 2;
          const sh = 30 + ((seed * 70 + s * 13) % 50);
          ctx.beginPath();
          ctx.moveTo(sx, base);
          ctx.lineTo(sx + 4, base - sh);
          ctx.lineTo(sx + 8, base);
          ctx.closePath();
          ctx.fill();
        }
      } else if (seed < 0.85) {
        // Boulder
        ctx.fillStyle = '#0a0e18';
        ctx.beginPath();
        ctx.ellipse(x + 18, base - 14, 22, 18, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#10141e';
        ctx.beginPath();
        ctx.ellipse(x + 14, base - 18, 12, 9, 0, 0, TAU);
        ctx.fill();
      }
    } else if (id === 'library') {
      if (seed < 0.6) {
        // Tall bookcase silhouette (shorter than the far one)
        ctx.fillStyle = '#0c0418';
        ctx.fillRect(x + 2, base - 80, 30, 80);
        // Shelves
        ctx.fillStyle = '#1a0a24';
        for (let s = 1; s <= 4; s++) ctx.fillRect(x + 2, base - 80 + s * 16, 30, 2);
        // Tiny glowing rune
        if (seed > 0.4) {
          const pulse = 0.5 + Math.sin(game.t * 2 + seed * 10) * 0.3;
          ctx.fillStyle = `rgba(200, 140, 255, ${pulse})`;
          ctx.fillRect(x + 14, base - 50, 4, 4);
        }
      } else if (seed < 0.85) {
        // Lectern (reading stand) with a real candle on top
        // Stand base
        ctx.fillStyle = '#0c0418';
        ctx.fillRect(x + 14, base - 28, 6, 28);
        // Wide foot
        ctx.fillStyle = '#06020c';
        ctx.fillRect(x + 8, base - 4, 18, 4);
        // Sloped reading surface
        ctx.fillStyle = '#1a0a24';
        ctx.beginPath();
        ctx.moveTo(x + 6, base - 32);
        ctx.lineTo(x + 28, base - 38);
        ctx.lineTo(x + 28, base - 30);
        ctx.lineTo(x + 6, base - 28);
        ctx.closePath();
        ctx.fill();
        // Open book on lectern
        ctx.fillStyle = '#d8c890';
        ctx.fillRect(x + 10, base - 34, 14, 4);
        ctx.fillStyle = '#3a2a1a';
        ctx.fillRect(x + 16, base - 34, 1, 4);
        // Candle holder on the corner (attached to lectern, not floating)
        ctx.fillStyle = '#0a0a0c';
        ctx.fillRect(x + 26, base - 38, 4, 3);
        // Candle stick
        ctx.fillStyle = '#e8dcb0';
        ctx.fillRect(x + 27, base - 48, 2, 10);
        // Wick
        ctx.fillStyle = '#08040a';
        ctx.fillRect(x + 27.6, base - 50, 0.8, 2);
        // Purple flame
        const pulse = 0.5 + Math.sin(game.t * 6 + seed * 6) * 0.35;
        const grad = ctx.createRadialGradient(x + 28, base - 53, 0.5, x + 28, base - 53, 10);
        grad.addColorStop(0, `rgba(230, 170, 255, ${pulse})`);
        grad.addColorStop(0.5, `rgba(160, 80, 220, ${pulse * 0.6})`);
        grad.addColorStop(1, 'rgba(80, 30, 160, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x + 28, base - 53, 10, 0, TAU);
        ctx.fill();
        ctx.fillStyle = `rgba(240, 210, 255, ${pulse})`;
        ctx.beginPath();
        ctx.ellipse(x + 28, base - 52, 1, 3, 0, 0, TAU);
        ctx.fill();
      }
    } else if (id === 'forge') {
      if (seed < 0.55) {
        // Forge with glowing coals
        ctx.fillStyle = '#0a0404';
        ctx.fillRect(x + 2, base - 26, 30, 26);
        ctx.fillStyle = '#1a0808';
        ctx.fillRect(x + 4, base - 24, 26, 6);
        // Glowing coals
        const pulse = 0.6 + Math.sin(game.t * 5 + seed * 8) * 0.3;
        const grad = ctx.createRadialGradient(x + 17, base - 21, 1, x + 17, base - 21, 18);
        grad.addColorStop(0, `rgba(255, 200, 80, ${pulse})`);
        grad.addColorStop(0.5, `rgba(255, 100, 30, ${pulse * 0.6})`);
        grad.addColorStop(1, 'rgba(180, 30, 0, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(x - 4, base - 42, 40, 30);
      } else if (seed < 0.85) {
        // Anvil silhouette
        ctx.fillStyle = '#0a0608';
        ctx.fillRect(x + 6, base - 6, 22, 6);
        ctx.beginPath();
        ctx.moveTo(x + 4, base - 8);
        ctx.lineTo(x, base - 18);
        ctx.lineTo(x + 34, base - 18);
        ctx.lineTo(x + 30, base - 8);
        ctx.closePath();
        ctx.fill();
        // Spark on top occasionally
        if (Math.sin(game.t * 8 + seed * 20) > 0.85) {
          ctx.fillStyle = '#ffd860';
          ctx.beginPath();
          ctx.arc(x + 17, base - 18, 1.5, 0, TAU);
          ctx.fill();
        }
      }
    }
  }
}

function drawFarBiome(biome) {
  const id = biome.id;
  if (id === 'dungeon') {
    const off = (game.cameraX * 0.18) % 360;
    for (let i = -1; i < W / 360 + 2; i++) {
      drawGothicWindow(i * 360 + 60 - off, bandTop * 0.16, 56, bandTop * 0.55);
    }
  } else if (id === 'crypts') {
    const off = (game.cameraX * 0.20) % 240;
    for (let i = -1; i < W / 240 + 2; i++) {
      drawCryptNiche(i * 240 + 30 - off, bandTop * 0.62);
    }
  } else if (id === 'caves') {
    const off = (game.cameraX * 0.20) % 200;
    for (let i = -1; i < W / 200 + 2; i++) {
      drawCrystalCluster(i * 200 + 30 - off, bandTop * 0.5 + (i * 17 % 30), i);
    }
  } else if (id === 'library') {
    const off = (game.cameraX * 0.16) % 240;
    for (let i = -1; i < W / 240 + 2; i++) {
      drawDeepBookshelf(i * 240 - off, bandTop * 0.16, bandTop * 0.7);
    }
  } else if (id === 'forge') {
    const off = (game.cameraX * 0.18) % 320;
    for (let i = -1; i < W / 320 + 2; i++) {
      drawLavaFall(i * 320 + 60 - off, bandTop * 0.18, bandTop * 0.7);
    }
  }
}

function drawGothicWindow(x, y, w, h) {
  // STONE NICHE recess (slightly darker — gives the window depth into the wall)
  ctx.fillStyle = '#06060c';
  ctx.fillRect(x - 10, y - w * 0.3, w + 20, h + w * 0.35 + 8);

  // === Stained glass panels ===
  // We define a clipped arch path and fill with multi-color radial gradient,
  // then overlay subtle colored panes for the "stained" effect.
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x, y + w * 0.5);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + w, y + w * 0.5);
  ctx.quadraticCurveTo(x + w / 2, y - w * 0.2, x, y + w * 0.5);
  ctx.closePath();
  ctx.clip();

  // Bright divine moonlight base (creates the "from behind" glow)
  const base = ctx.createRadialGradient(x + w / 2, y + h * 0.6, 1, x + w / 2, y + h * 0.4, w * 1.4);
  base.addColorStop(0, 'rgba(220, 230, 255, 0.95)');
  base.addColorStop(0.4, 'rgba(150, 180, 230, 0.75)');
  base.addColorStop(1, 'rgba(40, 60, 110, 0.55)');
  ctx.fillStyle = base;
  ctx.fillRect(x - 10, y - 30, w + 20, h + 40);

  // Stained colored panels (in a leaded pattern). Pick palette pseudo-randomly per window.
  const seed = ((x * 12345) >>> 0) / 0xFFFFFFFF;
  const palettes = [
    ['rgba(180, 40, 50, 0.55)',  'rgba(60, 100, 200, 0.55)', 'rgba(220, 180, 60, 0.5)'],   // crimson / blue / gold
    ['rgba(80, 160, 120, 0.55)', 'rgba(160, 70, 180, 0.55)', 'rgba(220, 200, 80, 0.45)'],  // green / purple / yellow
    ['rgba(70, 100, 200, 0.55)', 'rgba(220, 80, 60, 0.50)',  'rgba(180, 180, 220, 0.4)'],  // blue / red / silver
  ];
  const pal = palettes[Math.floor(seed * palettes.length) % palettes.length];

  // Diamond panes — 4 columns × 5 rows
  const cols = 4, rows = 5;
  const cellW = w / cols;
  const cellH = h / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = (r * 3 + c * 7 + Math.floor(seed * 17)) % pal.length;
      ctx.fillStyle = pal[idx];
      const px = x + c * cellW;
      const py = y + r * cellH;
      ctx.fillRect(px, py, cellW, cellH);
    }
  }

  // Central rose medallion (a circle of bright glow)
  const rose = ctx.createRadialGradient(x + w / 2, y + h * 0.35, 1, x + w / 2, y + h * 0.35, w * 0.5);
  rose.addColorStop(0, 'rgba(255, 230, 180, 0.9)');
  rose.addColorStop(0.3, 'rgba(220, 160, 80, 0.4)');
  rose.addColorStop(1, 'rgba(180, 100, 50, 0)');
  ctx.fillStyle = rose;
  ctx.fillRect(x - 6, y - 6, w + 12, h * 0.7);

  // Petal-like spokes around the rose (white radial bars)
  ctx.strokeStyle = 'rgba(255, 240, 200, 0.4)';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y + h * 0.35);
    ctx.lineTo(x + w / 2 + Math.cos(a) * w * 0.45, y + h * 0.35 + Math.sin(a) * w * 0.45);
    ctx.stroke();
  }

  ctx.restore();

  // === Leaded came (the lead strips between glass panes) ===
  ctx.strokeStyle = '#08060c';
  ctx.lineWidth = 1.5;
  // Vertical mullions
  for (let c = 1; c < cols; c++) {
    const px = x + c * (w / cols);
    ctx.beginPath();
    ctx.moveTo(px, y + Math.max(0, (cols === 4 && c === 2) ? 0 : w * 0.5 * (1 - c / cols)));
    ctx.lineTo(px, y + h);
    ctx.stroke();
  }
  // Horizontal transoms
  for (let r = 1; r < rows; r++) {
    ctx.beginPath();
    ctx.moveTo(x, y + r * (h / rows));
    ctx.lineTo(x + w, y + r * (h / rows));
    ctx.stroke();
  }

  // === Stone frame around the opening (the "cut" through the wall) ===
  // Outer arch trim (light stone)
  ctx.fillStyle = '#3a3344';
  ctx.beginPath();
  ctx.moveTo(x - 10, y + w * 0.5 + 4);
  ctx.quadraticCurveTo(x + w / 2, y - w * 0.35, x + w + 10, y + w * 0.5 + 4);
  ctx.lineTo(x + w + 4, y + w * 0.5);
  ctx.quadraticCurveTo(x + w / 2, y - w * 0.2, x - 4, y + w * 0.5);
  ctx.closePath();
  ctx.fill();
  // Inner arch shadow (creates a real "carved" feel)
  ctx.strokeStyle = '#06040a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y + w * 0.5);
  ctx.quadraticCurveTo(x + w / 2, y - w * 0.2, x + w, y + w * 0.5);
  ctx.stroke();
  // Side stone trim
  ctx.fillStyle = '#3a3344';
  ctx.fillRect(x - 8, y + w * 0.5, 4, h - w * 0.5);
  ctx.fillRect(x + w + 4, y + w * 0.5, 4, h - w * 0.5);
  ctx.fillStyle = '#1a1622';
  ctx.fillRect(x - 8, y + w * 0.5, 1, h - w * 0.5);
  ctx.fillRect(x + w + 6, y + w * 0.5, 1, h - w * 0.5);

  // Bottom stone sill (with shadow below)
  ctx.fillStyle = '#3a3344';
  ctx.fillRect(x - 12, y + h, w + 24, 6);
  ctx.fillStyle = '#5a5260';
  ctx.fillRect(x - 12, y + h, w + 24, 2);
  ctx.fillStyle = '#06040a';
  ctx.fillRect(x - 12, y + h + 6, w + 24, 2);

  // Keystone at top of arch (carved trapezoid)
  ctx.fillStyle = '#4a4458';
  ctx.beginPath();
  ctx.moveTo(x + w / 2 - 6, y - w * 0.18);
  ctx.lineTo(x + w / 2 + 6, y - w * 0.18);
  ctx.lineTo(x + w / 2 + 4, y - w * 0.05);
  ctx.lineTo(x + w / 2 - 4, y - w * 0.05);
  ctx.closePath();
  ctx.fill();

  // === Volumetric light shaft entering the room ===
  // Beams that come down-and-in from the window, fading toward the floor.
  const shaft = ctx.createLinearGradient(x + w / 2, y + h * 0.4, x + w / 2 + 14, bandTop + 90);
  shaft.addColorStop(0, 'rgba(220, 230, 255, 0.35)');
  shaft.addColorStop(0.6, 'rgba(180, 200, 240, 0.12)');
  shaft.addColorStop(1, 'rgba(160, 180, 220, 0)');
  ctx.fillStyle = shaft;
  ctx.beginPath();
  ctx.moveTo(x - 4, y + h);
  ctx.lineTo(x + w + 4, y + h);
  ctx.lineTo(x + w + 30, bandTop + 90);
  ctx.lineTo(x - 30, bandTop + 90);
  ctx.closePath();
  ctx.fill();

  // Wall glow halo
  const halo = ctx.createRadialGradient(x + w / 2, y + h / 2, 4, x + w / 2, y + h / 2, 90);
  halo.addColorStop(0, 'rgba(180, 200, 240, 0.20)');
  halo.addColorStop(1, 'rgba(160, 180, 220, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(x - 50, y - 30, w + 100, h + 80);

  // Dust motes drifting through the light shaft
  if (Math.random() < 0.04) {
    game.atmoParticles.push({
      kind: 'paper', // reuse existing kind for simple particle draw
      x: x + game.cameraX + rand(-w * 0.4, w * 0.4),
      y: y + rand(0, h * 0.4),
      vx: rand(-2, 6),
      vy: rand(8, 20),
      rot: 0, rotV: 0,
      life: rand(3, 5), maxLife: 5,
    });
  }
}

function drawCryptNiche(x, baseY) {
  const w = 36, h = 56;
  // Stone frame around the niche (wider than the cavity, gives it depth)
  ctx.fillStyle = '#16241a';
  ctx.beginPath();
  ctx.moveTo(x - 6, baseY + 4);
  ctx.lineTo(x - 6, baseY - h + w / 2 - 4);
  ctx.quadraticCurveTo(x + w / 2, baseY - h - w * 0.2, x + w + 6, baseY - h + w / 2 - 4);
  ctx.lineTo(x + w + 6, baseY + 4);
  ctx.closePath();
  ctx.fill();
  // Lighter top arch trim
  ctx.fillStyle = '#22341e';
  ctx.beginPath();
  ctx.moveTo(x - 5, baseY - h + w / 2 - 2);
  ctx.quadraticCurveTo(x + w / 2, baseY - h - w * 0.15, x + w + 5, baseY - h + w / 2 - 2);
  ctx.lineTo(x + w + 2, baseY - h + w / 2);
  ctx.quadraticCurveTo(x + w / 2, baseY - h - w * 0.1, x - 2, baseY - h + w / 2);
  ctx.closePath();
  ctx.fill();
  // Niche cavity (dark interior)
  ctx.fillStyle = '#040804';
  ctx.beginPath();
  ctx.moveTo(x, baseY);
  ctx.lineTo(x, baseY - h + w / 2);
  ctx.quadraticCurveTo(x + w / 2, baseY - h - w * 0.1, x + w, baseY - h + w / 2);
  ctx.lineTo(x + w, baseY);
  ctx.closePath();
  ctx.fill();
  // Sarcophagus inside
  ctx.fillStyle = '#0a1c10';
  ctx.beginPath();
  ctx.moveTo(x + 6, baseY - 4);
  ctx.lineTo(x + 4, baseY - 26);
  ctx.lineTo(x + w - 4, baseY - 26);
  ctx.lineTo(x + w - 6, baseY - 4);
  ctx.closePath();
  ctx.fill();
  // Cross on sarcophagus
  ctx.fillStyle = '#3a5a3a';
  ctx.fillRect(x + w / 2 - 1, baseY - 22, 2, 12);
  ctx.fillRect(x + w / 2 - 4, baseY - 18, 8, 2);
  // Eerie green glow inside niche
  const pulse = 0.4 + Math.sin(game.t * 1.5 + x * 0.05) * 0.25;
  const glow = ctx.createRadialGradient(x + w / 2, baseY - 28, 1, x + w / 2, baseY - 28, 24);
  glow.addColorStop(0, `rgba(120, 240, 150, ${pulse * 0.7})`);
  glow.addColorStop(1, 'rgba(60, 200, 100, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - 8, baseY - 50, w + 16, 30);
  // Frame
  ctx.strokeStyle = 'rgba(60, 140, 80, 0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, baseY);
  ctx.lineTo(x, baseY - h + w / 2);
  ctx.quadraticCurveTo(x + w / 2, baseY - h - w * 0.1, x + w, baseY - h + w / 2);
  ctx.lineTo(x + w, baseY);
  ctx.stroke();
}

function drawCrystalCluster(x, baseY, variant) {
  const palette = [
    { rgb: '128, 192, 255' },
    { rgb: '192, 128, 255' },
    { rgb: '120, 255, 200' },
  ][((variant % 3) + 3) % 3];
  const pulse = 0.5 + Math.sin(game.t * 2 + x * 0.03) * 0.3;
  // Outer glow
  const glow = ctx.createRadialGradient(x, baseY - 14, 1, x, baseY - 14, 50);
  glow.addColorStop(0, `rgba(${palette.rgb}, ${pulse * 0.55})`);
  glow.addColorStop(1, `rgba(${palette.rgb}, 0)`);
  ctx.fillStyle = glow;
  ctx.fillRect(x - 50, baseY - 64, 100, 80);
  // Main crystal
  ctx.fillStyle = `rgba(${palette.rgb}, 0.65)`;
  ctx.beginPath();
  ctx.moveTo(x, baseY - 38);
  ctx.lineTo(x + 9, baseY - 14);
  ctx.lineTo(x, baseY);
  ctx.lineTo(x - 9, baseY - 14);
  ctx.closePath();
  ctx.fill();
  // Highlight stripe
  ctx.fillStyle = `rgba(255, 255, 255, ${pulse * 0.6})`;
  ctx.beginPath();
  ctx.moveTo(x - 1, baseY - 35);
  ctx.lineTo(x + 1, baseY - 18);
  ctx.lineTo(x - 4, baseY - 12);
  ctx.closePath();
  ctx.fill();
  // Side smaller crystals
  ctx.fillStyle = `rgba(${palette.rgb}, 0.55)`;
  ctx.beginPath();
  ctx.moveTo(x - 18, baseY - 22);
  ctx.lineTo(x - 13, baseY - 8);
  ctx.lineTo(x - 23, baseY - 8);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + 18, baseY - 18);
  ctx.lineTo(x + 24, baseY - 6);
  ctx.lineTo(x + 13, baseY - 6);
  ctx.closePath();
  ctx.fill();
}

function drawDeepBookshelf(x, yT, yB) {
  const w = 240;
  const h = yB - yT;
  // Backplate
  ctx.fillStyle = '#160626';
  ctx.fillRect(x, yT, w, h);
  // Vertical dividers
  ctx.fillStyle = '#08020c';
  for (let i = 0; i <= 4; i++) ctx.fillRect(x + i * (w / 4) - 1, yT, 2, h);
  // Shelves with books
  const rows = 5;
  const colors = ['#6a2a3a', '#3a2a5a', '#5a3a2a', '#3a2a4a', '#7a4040', '#2a3a5a', '#5a4070', '#4a3a30'];
  for (let r = 0; r < rows; r++) {
    const ry = yT + (r + 0.85) * (h / rows);
    ctx.fillStyle = '#06010a';
    ctx.fillRect(x, ry, w, 3);
    const bw = w / 22;
    for (let b = 0; b < 22; b++) {
      const bx = x + 2 + b * bw;
      const bh = 13 + ((b * 17 + r * 7) % 9);
      ctx.fillStyle = colors[(b + r * 3) % colors.length];
      ctx.fillRect(bx, ry - bh, bw - 1, bh);
      // Random gold spine accent
      if ((b + r) % 5 === 0) {
        ctx.fillStyle = 'rgba(220, 180, 80, 0.6)';
        ctx.fillRect(bx + 1, ry - bh + 4, bw - 3, 1);
      }
    }
  }
  // Subtle arcane glow from a hidden tome
  const pulse = 0.3 + Math.sin(game.t * 1.5 + x * 0.02) * 0.2;
  const glow = ctx.createRadialGradient(x + w * 0.5, yT + h * 0.5, 1, x + w * 0.5, yT + h * 0.5, 50);
  glow.addColorStop(0, `rgba(180, 120, 220, ${pulse * 0.5})`);
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x + w * 0.3, yT + h * 0.3, w * 0.4, h * 0.4);
}

function drawLavaFall(x, yT, yB) {
  const w = 32;
  const h = yB - yT;
  // Recess (dark wall)
  ctx.fillStyle = '#080204';
  ctx.fillRect(x - 4, yT, w + 8, h);
  // Lava column
  const grad = ctx.createLinearGradient(x, yT, x, yB);
  grad.addColorStop(0, '#ffea60');
  grad.addColorStop(0.4, '#ff8030');
  grad.addColorStop(1, '#a00808');
  ctx.fillStyle = grad;
  ctx.fillRect(x, yT, w, h);
  // Animated ripple bands (scrolling)
  const off = (game.t * 30) % 22;
  ctx.strokeStyle = 'rgba(255, 240, 120, 0.6)';
  ctx.lineWidth = 1;
  for (let yy = yT - 22 + off; yy < yB; yy += 22) {
    ctx.beginPath();
    ctx.moveTo(x, yy);
    ctx.lineTo(x + w, yy);
    ctx.stroke();
  }
  // Side glow (orange diffusion)
  const pulse = 0.6 + Math.sin(game.t * 4 + x * 0.05) * 0.2;
  const sideGlow = ctx.createLinearGradient(x - 32, 0, x + w + 32, 0);
  sideGlow.addColorStop(0, 'rgba(255, 100, 30, 0)');
  sideGlow.addColorStop(0.5, `rgba(255, 100, 30, ${pulse * 0.45})`);
  sideGlow.addColorStop(1, 'rgba(255, 100, 30, 0)');
  ctx.fillStyle = sideGlow;
  ctx.fillRect(x - 32, yT, w + 64, h);
  // Pool at bottom
  ctx.fillStyle = '#ffea60';
  ctx.beginPath();
  ctx.ellipse(x + w / 2, yB + 4, w * 0.7, 6, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 200, 100, 0.6)';
  ctx.beginPath();
  ctx.ellipse(x + w / 2, yB + 2, w * 0.5, 3, 0, 0, TAU);
  ctx.fill();
}

// ============ Mid biome layer (between pillars) ============
function drawMidBiome(biome) {
  const id = biome.id;
  if (id === 'dungeon') {
    const off = (game.cameraX * 0.42) % 480;
    for (let i = -1; i < W / 480 + 2; i++) {
      drawGargoyle(i * 480 + 240 - off, bandTop * 0.6);
    }
  } else if (id === 'crypts') {
    const off = (game.cameraX * 0.42) % 460;
    for (let i = -1; i < W / 460 + 2; i++) {
      drawIronCandelabra(i * 460 + 220 - off, bandTop - 4);
    }
  } else if (id === 'caves') {
    const off = (game.cameraX * 0.42) % 380;
    for (let i = -1; i < W / 380 + 2; i++) {
      drawTallStalagmite(i * 380 + 200 - off, bandTop * 0.55);
    }
  } else if (id === 'library') {
    const off = (game.cameraX * 0.42) % 540;
    for (let i = -1; i < W / 540 + 2; i++) {
      drawHangingChandelier(i * 540 + 270 - off, bandTop * 0.18);
    }
  } else if (id === 'forge') {
    const off = (game.cameraX * 0.42) % 460;
    for (let i = -1; i < W / 460 + 2; i++) {
      drawHangingCauldron(i * 460 + 230 - off, bandTop * 0.18);
    }
  }
}

function drawGargoyle(x, baseY) {
  // Pedestal
  ctx.fillStyle = '#1a1a22';
  ctx.fillRect(x - 14, baseY - 6, 28, 8);
  ctx.fillStyle = '#26262e';
  ctx.fillRect(x - 12, baseY - 8, 24, 2);
  // Body (crouched gargoyle)
  ctx.fillStyle = '#15151c';
  ctx.beginPath();
  ctx.moveTo(x - 10, baseY - 8);
  ctx.lineTo(x - 12, baseY - 24);
  ctx.lineTo(x - 6, baseY - 30);
  ctx.lineTo(x + 6, baseY - 30);
  ctx.lineTo(x + 12, baseY - 24);
  ctx.lineTo(x + 10, baseY - 8);
  ctx.closePath();
  ctx.fill();
  // Wings (folded)
  ctx.fillStyle = '#0a0a12';
  ctx.beginPath();
  ctx.moveTo(x - 12, baseY - 22);
  ctx.lineTo(x - 18, baseY - 16);
  ctx.lineTo(x - 14, baseY - 10);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + 12, baseY - 22);
  ctx.lineTo(x + 18, baseY - 16);
  ctx.lineTo(x + 14, baseY - 10);
  ctx.fill();
  // Horns + head detail
  ctx.fillStyle = '#0a0a12';
  ctx.beginPath();
  ctx.moveTo(x - 6, baseY - 30);
  ctx.lineTo(x - 8, baseY - 38);
  ctx.lineTo(x - 4, baseY - 30);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x + 6, baseY - 30);
  ctx.lineTo(x + 8, baseY - 38);
  ctx.lineTo(x + 4, baseY - 30);
  ctx.fill();
  // Glowing eyes
  const pulse = 0.6 + Math.sin(game.t * 3 + x * 0.05) * 0.3;
  ctx.fillStyle = `rgba(255, 60, 50, ${pulse})`;
  ctx.fillRect(x - 4, baseY - 26, 2, 2);
  ctx.fillRect(x + 2, baseY - 26, 2, 2);
}

function drawIronCandelabra(x, baseY) {
  // Floor shadow under the base
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.beginPath();
  ctx.ellipse(x, baseY + 2, 22, 5, 0, 0, TAU);
  ctx.fill();

  // === Heavy weighted base (3-tier) ===
  // Bottom-most flat plate
  ctx.fillStyle = '#0a0a0c';
  ctx.fillRect(x - 18, baseY - 3, 36, 4);
  // Middle ring (slightly inset)
  ctx.fillStyle = '#1a1a1e';
  ctx.fillRect(x - 14, baseY - 7, 28, 5);
  // Top tier (decorative bevel)
  ctx.fillStyle = '#0a0a0c';
  ctx.fillRect(x - 10, baseY - 11, 20, 5);
  // Highlight on the front edge
  ctx.fillStyle = '#2a2a30';
  ctx.fillRect(x - 18, baseY - 3, 36, 1);

  // === Pole (twisted iron, thicker now) ===
  ctx.fillStyle = '#1a1a1c';
  ctx.fillRect(x - 2, baseY - 70, 4, 60);
  // Pole highlight (vertical streak)
  ctx.fillStyle = '#2a2a30';
  ctx.fillRect(x - 2, baseY - 70, 1, 60);
  // Twisted bands (3 small horizontal ridges)
  ctx.fillStyle = '#0a0a0c';
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(x - 3, baseY - 30 - i * 16, 6, 1.5);
  }
  // Decorative ornament at mid-pole (small sphere)
  ctx.fillStyle = '#2a2228';
  ctx.beginPath();
  ctx.arc(x, baseY - 40, 4, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#3a3038';
  ctx.beginPath();
  ctx.arc(x - 1, baseY - 41, 1.5, 0, TAU);
  ctx.fill();

  // === Arms (curved iron rods) ===
  ctx.strokeStyle = '#1a1a1c';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  // Left arm
  ctx.beginPath();
  ctx.moveTo(x, baseY - 52);
  ctx.quadraticCurveTo(x - 18, baseY - 60, x - 16, baseY - 72);
  ctx.stroke();
  // Right arm
  ctx.beginPath();
  ctx.moveTo(x, baseY - 52);
  ctx.quadraticCurveTo(x + 18, baseY - 60, x + 16, baseY - 72);
  ctx.stroke();
  // Arm decorative curls (small inward spirals)
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x - 11, baseY - 62, 3, 0, Math.PI * 1.4);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x + 11, baseY - 62, 3, Math.PI * -0.4, Math.PI);
  ctx.stroke();
  ctx.lineCap = 'butt';

  // === Candle holders (cup + candle + flame) ===
  for (const ox of [-16, 0, 16]) {
    // Holder cup
    ctx.fillStyle = '#0a0a0c';
    ctx.fillRect(x + ox - 3, baseY - 74, 6, 3);
    ctx.fillStyle = '#1a1a1e';
    ctx.fillRect(x + ox - 4, baseY - 74, 8, 1);
    // Candle (with wax drip)
    ctx.fillStyle = '#e8dcb0';
    ctx.fillRect(x + ox - 1.5, baseY - 84, 3, 10);
    ctx.fillStyle = '#d0c498';
    ctx.fillRect(x + ox - 1.5, baseY - 74, 3, 2);
    // Wick
    ctx.fillStyle = '#08040a';
    ctx.fillRect(x + ox - 0.4, baseY - 86, 0.8, 2);
    // Green flame
    const flicker = 0.7 + Math.sin(game.t * 8 + x + ox) * 0.3;
    const flameY = baseY - 90 - flicker * 1.5;
    const grad = ctx.createRadialGradient(x + ox, flameY, 0.5, x + ox, flameY, 11);
    grad.addColorStop(0, `rgba(180, 255, 200, ${flicker})`);
    grad.addColorStop(0.5, `rgba(120, 230, 150, ${flicker * 0.7})`);
    grad.addColorStop(1, 'rgba(40, 160, 80, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x + ox, flameY, 11, 0, TAU);
    ctx.fill();
    // Flame core (tear-drop)
    ctx.fillStyle = `rgba(230, 255, 230, ${flicker})`;
    ctx.beginPath();
    ctx.ellipse(x + ox, flameY + 1, 1.2, 4, 0, 0, TAU);
    ctx.fill();
  }
}

function drawTallStalagmite(x, baseY) {
  // Big stalagmite from the floor
  const grad = ctx.createLinearGradient(x, baseY, x, baseY - 80);
  grad.addColorStop(0, '#2a3340');
  grad.addColorStop(1, '#3a4458');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(x - 18, baseY);
  ctx.lineTo(x - 4, baseY - 80);
  ctx.lineTo(x + 4, baseY - 80);
  ctx.lineTo(x + 18, baseY);
  ctx.closePath();
  ctx.fill();
  // Highlight
  ctx.fillStyle = '#5a6478';
  ctx.beginPath();
  ctx.moveTo(x - 10, baseY);
  ctx.lineTo(x - 1, baseY - 78);
  ctx.lineTo(x + 1, baseY - 78);
  ctx.lineTo(x - 4, baseY);
  ctx.closePath();
  ctx.fill();
  // Tiny crystal at top
  ctx.fillStyle = 'rgba(120, 200, 255, 0.7)';
  ctx.beginPath();
  ctx.moveTo(x, baseY - 88);
  ctx.lineTo(x + 3, baseY - 80);
  ctx.lineTo(x - 3, baseY - 80);
  ctx.closePath();
  ctx.fill();
}

function drawHangingChandelier(x, yT) {
  // Ceiling anchor plate (so it's clearly attached to the ceiling)
  ctx.fillStyle = '#0a0612';
  ctx.fillRect(x - 8, 0, 16, 4);
  ctx.fillStyle = '#1a0a24';
  ctx.fillRect(x - 6, 4, 12, 2);

  // Chain with VISIBLE links (alternating oval shape, top to chandelier)
  const linkH = 7;
  for (let cy = 6; cy < yT; cy += linkH) {
    const horiz = (Math.floor((cy - 6) / linkH) % 2) === 0;
    ctx.strokeStyle = '#1a0a20';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    if (horiz) ctx.ellipse(x, cy + linkH * 0.5, 3, linkH * 0.5, 0, 0, TAU);
    else ctx.ellipse(x, cy + linkH * 0.5, 1.5, linkH * 0.5, 0, 0, TAU);
    ctx.stroke();
    // Inner highlight
    ctx.strokeStyle = '#3a1a44';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    if (horiz) ctx.ellipse(x - 1, cy + linkH * 0.4, 2, linkH * 0.35, 0, 0, TAU);
    else ctx.ellipse(x - 0.5, cy + linkH * 0.4, 1, linkH * 0.35, 0, 0, TAU);
    ctx.stroke();
  }

  // Ring
  ctx.strokeStyle = '#1a0a20';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(x, yT + 10, 18, 0, TAU);
  ctx.stroke();
  // Inner ring detail
  ctx.fillStyle = '#3a1a44';
  ctx.beginPath();
  ctx.arc(x, yT + 10, 4, 0, TAU);
  ctx.fill();
  // Candles around
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU - Math.PI / 2;
    const cx = x + Math.cos(a) * 18;
    const cy = yT + 10 + Math.sin(a) * 18;
    ctx.fillStyle = '#d8d0a8';
    ctx.fillRect(cx - 1, cy - 6, 2, 6);
    const flicker = 0.7 + Math.sin(game.t * 8 + i) * 0.3;
    const grad = ctx.createRadialGradient(cx, cy - 8, 0.5, cx, cy - 8, 7);
    grad.addColorStop(0, `rgba(220, 140, 255, ${flicker})`);
    grad.addColorStop(1, 'rgba(140, 60, 220, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy - 8, 7, 0, TAU);
    ctx.fill();
    ctx.fillStyle = `rgba(240, 210, 255, ${flicker})`;
    ctx.beginPath();
    ctx.ellipse(cx, cy - 8, 1, 2.4, 0, 0, TAU);
    ctx.fill();
  }
}

function drawHangingCauldron(x, yT) {
  // Ceiling anchor plate
  ctx.fillStyle = '#0a0606';
  ctx.fillRect(x - 8, 0, 16, 4);
  ctx.fillStyle = '#1a0808';
  ctx.fillRect(x - 6, 4, 12, 2);

  // VISIBLE chain links
  const linkH = 8;
  for (let cy = 6; cy < yT; cy += linkH) {
    const horiz = (Math.floor((cy - 6) / linkH) % 2) === 0;
    ctx.strokeStyle = '#1a0a08';
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (horiz) ctx.ellipse(x, cy + linkH * 0.5, 3.5, linkH * 0.5, 0, 0, TAU);
    else ctx.ellipse(x, cy + linkH * 0.5, 1.8, linkH * 0.5, 0, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = '#3a1a10';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    if (horiz) ctx.ellipse(x - 1, cy + linkH * 0.4, 2.4, linkH * 0.35, 0, 0, TAU);
    else ctx.ellipse(x - 0.5, cy + linkH * 0.4, 1.2, linkH * 0.35, 0, 0, TAU);
    ctx.stroke();
  }
  // Hook above cauldron
  ctx.strokeStyle = '#1a0a08';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, yT - 4);
  ctx.quadraticCurveTo(x, yT + 2, x + 3, yT + 4);
  ctx.stroke();
  // Cauldron body
  ctx.fillStyle = '#1a0a08';
  ctx.beginPath();
  ctx.moveTo(x - 18, yT + 4);
  ctx.lineTo(x - 14, yT + 22);
  ctx.lineTo(x + 14, yT + 22);
  ctx.lineTo(x + 18, yT + 4);
  ctx.closePath();
  ctx.fill();
  // Rim
  ctx.fillStyle = '#3a1a08';
  ctx.fillRect(x - 18, yT + 2, 36, 3);
  // Glowing molten interior
  const pulse = 0.65 + Math.sin(game.t * 4 + x * 0.04) * 0.3;
  ctx.fillStyle = `rgba(255, 160, 50, ${pulse})`;
  ctx.fillRect(x - 14, yT + 4, 28, 4);
  // Glow above
  const glow = ctx.createRadialGradient(x, yT + 4, 1, x, yT + 4, 24);
  glow.addColorStop(0, `rgba(255, 120, 30, ${pulse * 0.6})`);
  glow.addColorStop(1, 'rgba(255, 120, 30, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - 24, yT - 22, 48, 30);
}

function drawCeiling(biome) {
  if (biome.ceilingType === 'stalactites') {
    const off = (game.cameraX * 0.4) % 60;
    ctx.fillStyle = '#1a2028';
    for (let i = -1; i < W / 60 + 1; i++) {
      const x = i * 60 - off;
      const h = 14 + (i * 17 % 20);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 8, h);
      ctx.lineTo(x + 16, 0);
      ctx.fill();
    }
  } else if (biome.ceilingType === 'chains') {
    const off = (game.cameraX * 0.4) % 110;
    ctx.strokeStyle = 'rgba(60, 80, 60, 0.6)';
    ctx.lineWidth = 1.5;
    for (let i = -1; i < W / 110 + 1; i++) {
      const x = i * 110 - off;
      const len = 30 + (i * 23 % 40);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, len);
      ctx.stroke();
      // tiny bone hanging
      ctx.fillStyle = '#c8c0a8';
      ctx.fillRect(x - 3, len, 6, 2);
    }
  } else if (biome.ceilingType === 'books') {
    const off = (game.cameraX * 0.45) % 140;
    for (let i = -1; i < W / 140 + 1; i++) {
      const x = i * 140 - off;
      // bookshelf strip
      ctx.fillStyle = '#2a1840';
      ctx.fillRect(x, 0, 100, 24);
      ctx.fillStyle = '#4a2858';
      // book spines
      const colors = ['#6a2a3a', '#3a2a5a', '#5a3a2a', '#3a2a4a'];
      for (let j = 0; j < 8; j++) {
        ctx.fillStyle = colors[j % colors.length];
        ctx.fillRect(x + 4 + j * 12, 4, 10, 16);
      }
    }
  } else if (biome.ceilingType === 'magma') {
    const off = (game.cameraX * 0.3) % 200;
    ctx.strokeStyle = 'rgba(255, 100, 40, 0.5)';
    ctx.lineWidth = 2;
    for (let i = -1; i < W / 200 + 1; i++) {
      const x = i * 200 - off;
      ctx.beginPath();
      ctx.moveTo(x, 8);
      ctx.lineTo(x + 60, 18);
      ctx.lineTo(x + 100, 12);
      ctx.lineTo(x + 160, 22);
      ctx.stroke();
    }
    // glow
    ctx.fillStyle = 'rgba(255, 80, 30, 0.08)';
    ctx.fillRect(0, 0, W, 30);
  }
}

function drawPillar(x, biome) {
  // FULL-HEIGHT pillar: ceiling (y=0) to floor (bandTop)
  const top = 0;
  const bot = bandTop;
  const w = 50;

  // Shaft gradient (vertical 3-stop, gives stone roundness)
  const grad = ctx.createLinearGradient(x, 0, x + w, 0);
  grad.addColorStop(0, biome.pillar[0]);
  grad.addColorStop(0.5, biome.pillar[1]);
  grad.addColorStop(1, biome.pillar[2]);
  ctx.fillStyle = grad;
  ctx.fillRect(x, top + 18, w, bot - top - 30);

  // Top capital (wider, 3-tier stone block)
  ctx.fillStyle = biome.pillarCap;
  ctx.fillRect(x - 8, top + 18, w + 16, 10);
  ctx.fillRect(x - 5, top + 10, w + 10, 8);
  ctx.fillRect(x - 2, top, w + 4, 10);

  // Base capital (wider stone block at floor)
  ctx.fillStyle = biome.pillarCap;
  ctx.fillRect(x - 5, bot - 18, w + 10, 8);
  ctx.fillRect(x - 8, bot - 10, w + 16, 10);

  // Vertical seam (gives depth + the impression of a column)
  ctx.strokeStyle = biome.crackColor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + 25, top + 28);
  ctx.lineTo(x + 22, bot - 22);
  ctx.stroke();

  // Side highlight strip (lighter edge — suggests light from one side)
  ctx.fillStyle = biome.pillar[2];
  ctx.fillRect(x + w - 6, top + 22, 2, bot - top - 42);

  // Forge: glowing magma vein
  if (biome.id === 'forge') {
    const pulse = 0.5 + Math.sin(game.t * 3 + x * 0.05) * 0.3;
    ctx.fillStyle = `rgba(255, 100, 40, ${pulse})`;
    ctx.fillRect(x + 20, top + 30, 3, bot - top - 50);
  }
  // Library: glowing rune
  if (biome.id === 'library') {
    const pulse = 0.4 + Math.sin(game.t * 2 + x * 0.05) * 0.25;
    ctx.fillStyle = `rgba(180, 120, 220, ${pulse})`;
    ctx.fillRect(x + 22, top + 80 + ((x * 7) % 60), 6, 6);
  }
}

function drawWallTorch(x, y, biome) {
  const flicker = Math.sin(game.t * 12 + x) * 0.2 + 0.8;

  // MOUNTING BRACKET — triangle of stone fixed to the wall
  ctx.fillStyle = '#1a1410';
  ctx.beginPath();
  ctx.moveTo(x - 8, y + 4);
  ctx.lineTo(x + 8, y + 4);
  ctx.lineTo(x + 4, y + 14);
  ctx.lineTo(x - 4, y + 14);
  ctx.closePath();
  ctx.fill();
  // Bracket bolts (visible mounting points)
  ctx.fillStyle = '#3a2a1a';
  ctx.beginPath(); ctx.arc(x - 6, y + 6, 1.4, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 6, y + 6, 1.4, 0, TAU); ctx.fill();

  // Torch shaft (wooden, sticks UP from the bracket)
  ctx.fillStyle = '#2a1808';
  ctx.fillRect(x - 2.5, y - 12, 5, 18);
  ctx.fillStyle = '#3a2410';
  ctx.fillRect(x - 2.5, y - 12, 5, 1);
  ctx.fillRect(x - 2.5, y, 5, 1);

  // Iron cup / brazier on top
  ctx.fillStyle = '#1a1410';
  ctx.beginPath();
  ctx.moveTo(x - 5, y - 12);
  ctx.lineTo(x + 5, y - 12);
  ctx.lineTo(x + 3, y - 18);
  ctx.lineTo(x - 3, y - 18);
  ctx.closePath();
  ctx.fill();

  // Flame
  const grad = ctx.createRadialGradient(x, y - 22, 1, x, y - 22, 22);
  grad.addColorStop(0, biome.torchFlame[0] + flicker + ')');
  grad.addColorStop(0.4, biome.torchFlame[1] + (flicker * 0.8) + ')');
  grad.addColorStop(1, biome.torchFlame[2]);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y - 22, 22, 0, TAU);
  ctx.fill();
  // Flame core
  ctx.fillStyle = biome.torchCore + flicker + ')';
  ctx.beginPath();
  ctx.ellipse(x, y - 22, 3, 7, 0, 0, TAU);
  ctx.fill();
  // Pool of warm light on the wall around the torch
  const wallGlow = ctx.createRadialGradient(x, y - 8, 4, x, y - 8, 70);
  wallGlow.addColorStop(0, biome.torchFlame[0] + (flicker * 0.18) + ')');
  wallGlow.addColorStop(1, biome.torchFlame[2]);
  ctx.fillStyle = wallGlow;
  ctx.fillRect(x - 70, y - 60, 140, 90);

  // Occasional spark drifting up
  if (Math.random() < 0.10) {
    game.embers.push({
      x: x + game.cameraX + rand(-3, 3),
      y: y - 22,
      vx: rand(-6, 6),
      vy: rand(-50, -25),
      life: rand(1, 2), maxLife: 2,
      size: rand(1, 2),
    });
  }
}

function drawGround() {
  const biome = getBiome();
  const floorH = H - bandTop;

  // Base floor gradient (lighter near the camera, darker into the foreground/depth)
  const grad = ctx.createLinearGradient(0, bandTop, 0, H);
  grad.addColorStop(0, biome.floorTop);
  grad.addColorStop(1, biome.floorBot);
  ctx.fillStyle = grad;
  ctx.fillRect(0, bandTop, W, floorH);

  // Perspective tile pattern — tiles converge toward a vanishing point above
  // (the wall meets the floor at bandTop). We use horizontal rows that get
  // smaller toward bandTop, and vertical seams that converge.
  ctx.lineWidth = 1;
  if (biome.floorPattern === 'cobble' || biome.floorPattern === 'magma') {
    drawTiledFloor(biome, 'square');
  } else if (biome.floorPattern === 'crackedStone') {
    drawTiledFloor(biome, 'cracked');
  } else if (biome.floorPattern === 'rough') {
    drawTiledFloor(biome, 'rough');
  } else if (biome.floorPattern === 'planks') {
    drawPlankFloor(biome);
  }

  // Magma extras (glowing cracks on top of the tiles)
  if (biome.floorPattern === 'magma') {
    const off2 = game.cameraX % 280;
    const pulse = 0.5 + Math.sin(game.t * 2.5) * 0.25;
    ctx.strokeStyle = `rgba(255, 100, 40, ${pulse})`;
    ctx.lineWidth = 2;
    for (let i = -1; i < W / 280 + 1; i++) {
      const x = i * 280 - off2;
      const y = bandTop + 30 + (i % 4) * 20;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 60, y + 14);
      ctx.lineTo(x + 130, y + 6);
      ctx.lineTo(x + 200, y + 22);
      ctx.stroke();
    }
  }

  // Top edge of the floor (the seam where floor meets wall baseboard)
  ctx.strokeStyle = biome.edgeColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, bandTop);
  ctx.lineTo(W, bandTop);
  ctx.stroke();

  // Floor shading near the wall (a soft strip of shadow where wall meets floor)
  const shadeGrad = ctx.createLinearGradient(0, bandTop, 0, bandTop + 18);
  shadeGrad.addColorStop(0, 'rgba(0, 0, 0, 0.45)');
  shadeGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = shadeGrad;
  ctx.fillRect(0, bandTop, W, 18);
}

function drawTiledFloor(biome, style) {
  const floorH = H - bandTop;
  const off = game.cameraX % 80;
  // Horizontal "rows" — get tighter near the back (perspective)
  const rowYs = [];
  for (let r = 0; r < 8; r++) {
    // Easing: rows compress toward bandTop
    const t = r / 7;
    const eased = Math.pow(t, 1.35);
    rowYs.push(bandTop + eased * floorH);
  }

  // Row lines (horizontal seams between courses)
  ctx.strokeStyle = biome.floorTint;
  ctx.lineWidth = 1;
  for (const y of rowYs) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // Vertical seams converging on a vanishing point above (cx = W/2, vy = bandTop - 80)
  const vpX = W / 2;
  const vpY = bandTop - 80;
  // Bottom-edge tile spacing (80 world px), staggered every other row
  for (let r = 0; r < rowYs.length - 1; r++) {
    const yTop = rowYs[r];
    const yBot = rowYs[r + 1];
    // Tile width at this depth (interpolate from 80 at bottom to ~38 near back)
    const t = r / (rowYs.length - 1);
    const tileW = 80 - t * 44;
    const stagger = r % 2 ? tileW * 0.5 : 0;
    const rowOff = (game.cameraX % tileW + stagger) % tileW;
    for (let x = -rowOff; x < W + tileW; x += tileW) {
      ctx.beginPath();
      ctx.moveTo(x, yBot);
      ctx.lineTo(x, yTop);
      ctx.stroke();
      // Per-tile detail
      if (style === 'cracked' && Math.random() < 0.04) {
        // Quick crack
        ctx.strokeStyle = biome.crackColor;
        ctx.beginPath();
        ctx.moveTo(x + 6, yTop + 4);
        ctx.lineTo(x + 18, yTop + 12);
        ctx.lineTo(x + 14, yTop + 22);
        ctx.stroke();
        ctx.strokeStyle = biome.floorTint;
      } else if (style === 'rough' && Math.random() < 0.04) {
        // Pebble (rounded bump)
        ctx.fillStyle = biome.floorTint;
        ctx.beginPath();
        ctx.arc(x + tileW * 0.5, (yTop + yBot) * 0.5, 2.5, 0, TAU);
        ctx.fill();
      }
    }
  }

  // Moss tufts for crackedStone (cryptes)
  if (style === 'cracked') {
    ctx.fillStyle = 'rgba(80, 160, 80, 0.30)';
    const mOff = game.cameraX % 150;
    for (let i = -1; i < W / 150 + 1; i++) {
      const x = i * 150 - mOff + 60;
      const y = rowYs[2 + (i % 3)];
      ctx.fillRect(x, y - 1, 14, 3);
    }
  }
}

function drawPlankFloor(biome) {
  const floorH = H - bandTop;
  // Long horizontal planks that go INTO the depth (parallel to camera motion)
  // They converge slightly via row spacing.
  const rows = 7;
  const plankW = 200; // length along the screen
  const off = game.cameraX % plankW;
  // Plank seams (horizontal — separating rows of planks)
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(60, 35, 20, 0.6)';
  const rowYs = [];
  for (let r = 0; r <= rows; r++) {
    const t = r / rows;
    const eased = Math.pow(t, 1.35);
    rowYs.push(bandTop + eased * floorH);
  }
  for (const y of rowYs) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  // Plank end-seams (vertical short marks) — staggered per row, scroll with camera
  ctx.strokeStyle = 'rgba(40, 25, 15, 0.7)';
  ctx.lineWidth = 1;
  for (let r = 0; r < rows; r++) {
    const yTop = rowYs[r];
    const yBot = rowYs[r + 1];
    const stagger = (r * 60) % plankW;
    const rowOff = (off + stagger) % plankW;
    for (let x = -rowOff; x < W + plankW; x += plankW) {
      ctx.beginPath();
      ctx.moveTo(x, yTop);
      ctx.lineTo(x, yBot);
      ctx.stroke();
    }
  }
  // Wood grain hint (thin streaks)
  ctx.strokeStyle = 'rgba(180, 120, 60, 0.08)';
  for (let r = 0; r < rows; r++) {
    const y = (rowYs[r] + rowYs[r + 1]) / 2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
}

function drawEmbers() {
  const biome = getBiome();
  const colorPrefix = biome.emberColor;
  for (const em of game.embers) {
    const a = clamp(em.life / em.maxLife, 0, 1);
    ctx.fillStyle = colorPrefix + (a * 0.7) + ')';
    ctx.beginPath();
    ctx.arc(sX(em.x), em.y, em.size, 0, TAU);
    ctx.fill();
  }
}

// ============ Atmosphere (per biome) ============
// ============ Ambient creatures (per-biome living things) ============
function updateCreatures(dt) {
  const biome = getBiome();
  const id = biome.id;

  // Spawn rates per biome (densified — 2-3× more life everywhere)
  if (id === 'dungeon' && Math.random() < dt * 1.8) {
    // Bat flying across (deep background)
    const fromLeft = Math.random() < 0.5;
    game.creatures.push({
      kind: 'bat',
      x: fromLeft ? game.cameraX - 30 : game.cameraX + W + 30,
      y: rand(40, bandTop * 0.7),
      vx: (fromLeft ? 1 : -1) * rand(120, 200),
      vy: 0,
      phase: rand(0, TAU),
      life: 6, maxLife: 6,
      depth: rand(0.6, 0.95),  // 1 = full size, smaller = farther
    });
  } else if (id === 'crypts' && Math.random() < dt * 2.5) {
    // Wandering soul (drifts upward, fades)
    game.creatures.push({
      kind: 'soul',
      x: game.cameraX + rand(-20, W + 20),
      y: rand(bandBot - 20, H + 10),
      vx: rand(-15, 15),
      vy: rand(-30, -15),
      phase: rand(0, TAU),
      life: rand(3, 5), maxLife: 5,
      size: rand(8, 14),
    });
  } else if (id === 'caves' && Math.random() < dt * 5.5) {
    // Glowbug (small luminous insect, zigzag)
    game.creatures.push({
      kind: 'glowbug',
      x: game.cameraX + rand(-20, W + 20),
      y: rand(bandTop + 20, bandBot - 10),
      vx: rand(-50, 50),
      vy: rand(-25, 25),
      phase: rand(0, TAU),
      life: rand(2.5, 4.5), maxLife: 4.5,
      color: Math.random() < 0.7 ? '120,200,255' : '180,140,255',
    });
  } else if (id === 'library' && Math.random() < dt * 1.5) {
    // Floating spell book (flapping pages)
    game.creatures.push({
      kind: 'flybook',
      x: game.cameraX + rand(-20, W + 20),
      y: rand(60, bandTop * 0.6),
      vx: rand(-25, -8),
      vy: rand(-10, 10),
      phase: rand(0, TAU),
      flap: 0,
      life: rand(4, 7), maxLife: 7,
    });
  } else if (id === 'forge' && Math.random() < dt * 1.2) {
    // Hanging hammer that strikes (background mech)
    const startX = game.cameraX + W + rand(40, 240);
    game.creatures.push({
      kind: 'forgeHammer',
      x: startX,
      anchorY: bandTop * 0.3,
      swing: 0,
      strikeTimer: rand(1.5, 3.0),
      life: 14, maxLife: 14,
      vx: 0,  // stays anchored to world (scrolls naturally)
    });
  }

  for (const c of game.creatures) {
    c.phase += dt * 6;
    c.life -= dt;
    if (c.kind === 'bat') {
      c.x += c.vx * dt;
      c.y += Math.sin(c.phase * 1.2) * 60 * dt;
    } else if (c.kind === 'soul') {
      c.x += c.vx * dt + Math.sin(c.phase) * 12 * dt;
      c.y += c.vy * dt;
    } else if (c.kind === 'glowbug') {
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      // direction changes occasionally
      if (Math.random() < dt * 1.5) c.vx = rand(-50, 50);
      if (Math.random() < dt * 1.5) c.vy = rand(-25, 25);
    } else if (c.kind === 'flybook') {
      c.x += c.vx * dt;
      c.y += c.vy * dt + Math.sin(c.phase * 0.7) * 15 * dt;
      c.flap += dt * 8;
    } else if (c.kind === 'forgeHammer') {
      c.strikeTimer -= dt;
      if (c.strikeTimer <= 0) {
        c.swing = 1; // trigger
        c.strikeTimer = rand(1.6, 2.6);
        // Sparks burst at strike
        for (let i = 0; i < 8; i++) {
          game.particles.push({
            x: c.x, y: c.anchorY + 56,
            vx: rand(-180, 180), vy: rand(-120, -30),
            life: 0.7, maxLife: 0.7,
            color: i % 2 ? '#ffcc40' : '#ff7020',
            size: 2,
          });
        }
      }
      if (c.swing > 0) c.swing = Math.max(0, c.swing - dt * 4);
    }
  }
  // Cleanup
  game.creatures = game.creatures.filter(c => c.life > 0 && c.x > game.cameraX - 200 && c.x < game.cameraX + W + 400);
}

function drawCreaturesBack() {
  // Drawn between ground and entities (background-ish)
  for (const c of game.creatures) {
    const x = sX(c.x);
    if (c.kind === 'bat') drawBatCreature(c, x);
    else if (c.kind === 'soul') drawSoul(c, x);
    else if (c.kind === 'glowbug') drawGlowbug(c, x);
    else if (c.kind === 'flybook') drawFlybook(c, x);
    else if (c.kind === 'forgeHammer') drawForgeHammer(c, x);
  }
}

function drawBatCreature(c, x) {
  const a = clamp(c.life / c.maxLife, 0, 1);
  const flap = Math.sin(c.phase * 3) * 6;
  const dir = Math.sign(c.vx) || 1;
  const s = c.depth;
  ctx.save();
  ctx.translate(x, c.y);
  ctx.scale(dir * s, s);
  ctx.globalAlpha = a * 0.85;
  // Body
  ctx.fillStyle = '#08040a';
  ctx.beginPath();
  ctx.ellipse(0, 0, 3, 4, 0, 0, TAU);
  ctx.fill();
  // Wings
  ctx.beginPath();
  ctx.moveTo(-2, -1);
  ctx.quadraticCurveTo(-10, -6 + flap, -16, -2 + flap * 0.4);
  ctx.quadraticCurveTo(-10, 0, -3, 2);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(2, -1);
  ctx.quadraticCurveTo(10, -6 - flap, 16, -2 - flap * 0.4);
  ctx.quadraticCurveTo(10, 0, 3, 2);
  ctx.closePath();
  ctx.fill();
  // Tiny red eye
  ctx.fillStyle = `rgba(200, 30, 30, ${a})`;
  ctx.fillRect(1, -2, 1.2, 1);
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawSoul(c, x) {
  const a = clamp(c.life / c.maxLife, 0, 1);
  const pulse = 0.6 + Math.sin(c.phase) * 0.3;
  // Glow
  const grad = ctx.createRadialGradient(x, c.y, 1, x, c.y, c.size * 2);
  grad.addColorStop(0, `rgba(140, 255, 180, ${a * 0.6 * pulse})`);
  grad.addColorStop(1, 'rgba(60, 200, 100, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(x - c.size * 2, c.y - c.size * 2, c.size * 4, c.size * 4);
  // Ghostly figure (small)
  ctx.fillStyle = `rgba(180, 255, 200, ${a * 0.5})`;
  ctx.beginPath();
  ctx.moveTo(x, c.y - c.size * 0.7);
  ctx.quadraticCurveTo(x - c.size * 0.5, c.y - c.size * 0.5, x - c.size * 0.4, c.y + c.size * 0.4);
  ctx.lineTo(x - c.size * 0.2, c.y + c.size * 0.7);
  ctx.lineTo(x, c.y + c.size * 0.5);
  ctx.lineTo(x + c.size * 0.2, c.y + c.size * 0.7);
  ctx.lineTo(x + c.size * 0.4, c.y + c.size * 0.4);
  ctx.quadraticCurveTo(x + c.size * 0.5, c.y - c.size * 0.5, x, c.y - c.size * 0.7);
  ctx.closePath();
  ctx.fill();
  // Eyes
  ctx.fillStyle = `rgba(255, 255, 255, ${a * 0.9})`;
  ctx.fillRect(x - 2, c.y - 2, 1.2, 1.5);
  ctx.fillRect(x + 1, c.y - 2, 1.2, 1.5);
}

function drawGlowbug(c, x) {
  const a = clamp(c.life / c.maxLife, 0, 1);
  const pulse = 0.5 + Math.sin(c.phase * 2) * 0.4;
  const grad = ctx.createRadialGradient(x, c.y, 0.5, x, c.y, 10);
  grad.addColorStop(0, `rgba(${c.color}, ${a * pulse})`);
  grad.addColorStop(1, `rgba(${c.color}, 0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(x - 10, c.y - 10, 20, 20);
  ctx.fillStyle = `rgba(${c.color}, ${a})`;
  ctx.beginPath();
  ctx.arc(x, c.y, 1.5, 0, TAU);
  ctx.fill();
}

function drawFlybook(c, x) {
  const a = clamp(c.life / c.maxLife, 0, 1);
  const flap = Math.sin(c.flap) * 0.6;
  ctx.save();
  ctx.translate(x, c.y);
  ctx.rotate(Math.sin(c.phase * 0.5) * 0.2);
  ctx.globalAlpha = a;
  // Cover
  ctx.fillStyle = '#3a1a4a';
  ctx.fillRect(-8, -5, 16, 10);
  // Pages flapping (above + below cover)
  ctx.fillStyle = '#e8d8b0';
  ctx.beginPath();
  ctx.moveTo(-7, -4);
  ctx.lineTo(-9 - flap * 4, -7 - flap * 3);
  ctx.lineTo(7, -4);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-7, 4);
  ctx.lineTo(-9 + flap * 4, 7 + flap * 3);
  ctx.lineTo(7, 4);
  ctx.closePath();
  ctx.fill();
  // Magical trail
  ctx.fillStyle = `rgba(200, 140, 255, ${a * 0.4})`;
  ctx.beginPath();
  ctx.arc(0, 0, 14, 0, TAU);
  ctx.fill();
  // Tiny rune on cover
  ctx.fillStyle = '#ffd860';
  ctx.fillRect(-1, -1.5, 2, 3);
  ctx.restore();
  ctx.globalAlpha = 1;

  // Page particles trailing
  if (Math.random() < 0.2) {
    game.particles.push({
      x: c.x + rand(-4, 4), y: c.y + rand(-4, 4),
      vx: rand(-10, -2), vy: rand(-8, 8),
      life: 0.7, maxLife: 0.7,
      color: '#d8c890', size: 1.2,
    });
  }
}

function drawForgeHammer(c, x) {
  const swing = c.swing;
  const angle = -Math.PI * 0.5 + swing * Math.PI * 0.4 - 0.3;
  // Chain
  ctx.strokeStyle = '#3a2a20';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, c.anchorY);
  // Multi-link chain
  const headX = x + Math.cos(angle) * 50;
  const headY = c.anchorY + 50 + Math.sin(angle) * 50;
  ctx.lineTo(headX, headY);
  ctx.stroke();
  // Chain links (dots along the line)
  for (let i = 1; i <= 6; i++) {
    const t = i / 7;
    const lx = x + (headX - x) * t;
    const ly = c.anchorY + (headY - c.anchorY) * t;
    ctx.fillStyle = '#1a1010';
    ctx.beginPath();
    ctx.arc(lx, ly, 1.6, 0, TAU);
    ctx.fill();
  }
  // Hammer head
  ctx.fillStyle = '#2a1810';
  ctx.fillRect(headX - 7, headY - 5, 14, 10);
  ctx.fillStyle = '#5a3a20';
  ctx.fillRect(headX - 7, headY - 5, 14, 2);
  // Anchor point
  ctx.fillStyle = '#1a0a08';
  ctx.fillRect(x - 3, c.anchorY - 2, 6, 4);
  // Glow at head if recently struck
  if (swing > 0.3) {
    const grad = ctx.createRadialGradient(headX, headY, 1, headX, headY, 24);
    grad.addColorStop(0, `rgba(255, 180, 60, ${swing * 0.6})`);
    grad.addColorStop(1, 'rgba(255, 100, 30, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(headX - 24, headY - 24, 48, 48);
  }
}

// ============ Foreground (1st-plane silhouettes) ============
function maybeSpawnForeground() {
  const biome = getBiome();
  const last = game.foreground.length ? game.foreground[game.foreground.length - 1].x : 0;
  // Spawn frequently (every ~90-160 world px) — denser foreground
  if (game.cameraX + W + 80 < last - 60) return;
  if (Math.random() < 0.06 || game.foreground.length === 0) {
    const x = Math.max(game.cameraX + W + rand(60, 140), last + rand(90, 160));
    const types = {
      dungeon: ['chain', 'banner'],
      crypts:  ['boneString', 'hangingSkull'],
      caves:   ['hangingMushroom', 'rootVine'],
      library: ['scrollRibbon', 'hangingScroll'],
      forge:   ['hangingTong', 'hangingHammer'],
    };
    const list = types[biome.id] || ['chain'];
    const kind = list[Math.floor(Math.random() * list.length)];
    game.foreground.push({
      kind,
      x,
      yTop: 0,
      sway: rand(0, TAU),
      length: rand(40, 90),
    });
  }
  // Cleanup
  game.foreground = game.foreground.filter(f => f.x > game.cameraX - 60);
}

function updateForeground(dt) {
  for (const f of game.foreground) {
    f.sway += dt * 1.2;
  }
}

function drawForeground() {
  for (const f of game.foreground) {
    const x = sX(f.x);
    if (x < -40 || x > W + 40) continue;
    const sway = Math.sin(f.sway) * 4;
    if (f.kind === 'chain') drawFgChain(x, f, sway);
    else if (f.kind === 'banner') drawFgBanner(x, f, sway);
    else if (f.kind === 'boneString') drawFgBoneString(x, f, sway);
    else if (f.kind === 'hangingSkull') drawFgHangingSkull(x, f, sway);
    else if (f.kind === 'hangingMushroom') drawFgHangingMushroom(x, f, sway);
    else if (f.kind === 'rootVine') drawFgRootVine(x, f, sway);
    else if (f.kind === 'scrollRibbon') drawFgScrollRibbon(x, f, sway);
    else if (f.kind === 'hangingScroll') drawFgHangingScroll(x, f, sway);
    else if (f.kind === 'hangingTong') drawFgHangingTong(x, f, sway);
    else if (f.kind === 'hangingHammer') drawFgHangingHammer(x, f, sway);
  }
}

function drawFgChain(x, f, sway) {
  const links = 14;
  ctx.fillStyle = '#06060c';
  for (let i = 0; i < links; i++) {
    const y = i * 8;
    const sx = sway * (i / links);
    ctx.beginPath();
    ctx.ellipse(x + sx, y, 3, 4, 0, 0, TAU);
    ctx.fill();
  }
  // Hook on top
  ctx.strokeStyle = '#06060c';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(x, 4, 4, 0, Math.PI);
  ctx.stroke();
}
function drawFgBanner(x, f, sway) {
  // Tall tattered banner hanging from above
  ctx.fillStyle = '#1a0606';
  ctx.beginPath();
  ctx.moveTo(x - 16, 0);
  ctx.lineTo(x + 16, 0);
  ctx.lineTo(x + 14 + sway * 0.5, 90);
  ctx.lineTo(x + 8 + sway * 0.7, 110);
  ctx.lineTo(x + 2 + sway * 0.7, 96);
  ctx.lineTo(x - 4 + sway * 0.7, 112);
  ctx.lineTo(x - 14 + sway * 0.5, 90);
  ctx.closePath();
  ctx.fill();
  // Crest
  ctx.fillStyle = '#8a2020';
  ctx.beginPath();
  ctx.arc(x, 30, 8, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#1a0606';
  ctx.fillRect(x - 1, 24, 2, 12);
  ctx.fillRect(x - 5, 28, 10, 2);
  // Pole
  ctx.fillStyle = '#08080a';
  ctx.fillRect(x - 17, -4, 34, 4);
}
function drawFgBoneString(x, f, sway) {
  // Vertical string of bones
  ctx.strokeStyle = '#1a1410';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x + sway, 80);
  ctx.stroke();
  for (let i = 0; i < 5; i++) {
    const y = 12 + i * 16;
    const sx = sway * (y / 80);
    // Bone
    ctx.fillStyle = '#d8c8a8';
    ctx.fillRect(x + sx - 4, y, 8, 3);
    ctx.beginPath(); ctx.arc(x + sx - 4, y + 1.5, 2, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(x + sx + 4, y + 1.5, 2, 0, TAU); ctx.fill();
  }
}
function drawFgHangingSkull(x, f, sway) {
  ctx.strokeStyle = '#08080a';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x + sway, 38);
  ctx.stroke();
  // Skull
  ctx.fillStyle = '#d8c8a0';
  ctx.beginPath();
  ctx.arc(x + sway, 48, 9, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#08040a';
  ctx.fillRect(x + sway - 4, 46, 3, 3);
  ctx.fillRect(x + sway + 1, 46, 3, 3);
  ctx.fillRect(x + sway - 0.5, 52, 1, 2);
  // Jaw
  ctx.fillStyle = '#a89878';
  ctx.fillRect(x + sway - 5, 54, 10, 3);
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = '#08040a';
    ctx.fillRect(x + sway - 4 + i * 2.5, 55, 1, 2);
  }
}
function drawFgHangingMushroom(x, f, sway) {
  // Stalactite with glowing mushroom cluster
  ctx.fillStyle = '#1a1822';
  ctx.beginPath();
  ctx.moveTo(x - 6, 0);
  ctx.lineTo(x + 6, 0);
  ctx.lineTo(x + 2 + sway, 38);
  ctx.lineTo(x - 2 + sway, 38);
  ctx.closePath();
  ctx.fill();
  // Glowing caps
  const pulse = 0.5 + Math.sin(f.sway * 2) * 0.3;
  for (let i = 0; i < 3; i++) {
    const cx = x + sway + (i - 1) * 4;
    const cy = 36 + i;
    const grad = ctx.createRadialGradient(cx, cy, 0.5, cx, cy, 12);
    grad.addColorStop(0, `rgba(140, 220, 255, ${pulse * 0.7})`);
    grad.addColorStop(1, 'rgba(80, 160, 220, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(cx - 12, cy - 12, 24, 24);
    ctx.fillStyle = `rgba(180, 240, 255, ${pulse})`;
    ctx.beginPath();
    ctx.arc(cx, cy + 2, 2.5, 0, TAU);
    ctx.fill();
  }
}
function drawFgRootVine(x, f, sway) {
  ctx.strokeStyle = '#3a2818';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.quadraticCurveTo(x + sway * 1.5, 40, x + sway, 80);
  ctx.stroke();
  // Small leaves
  ctx.fillStyle = '#2a3a18';
  for (let i = 1; i < 4; i++) {
    const t = i / 4;
    const lx = x + sway * (t + 0.3);
    const ly = 80 * t;
    const side = i % 2 ? 1 : -1;
    ctx.beginPath();
    ctx.ellipse(lx + side * 5, ly, 5, 2.5, side * 0.4, 0, TAU);
    ctx.fill();
  }
}
function drawFgScrollRibbon(x, f, sway) {
  // Magical ribbon with glowing runes
  ctx.fillStyle = '#5a2a7a';
  ctx.beginPath();
  ctx.moveTo(x - 3, 0);
  ctx.quadraticCurveTo(x + sway * 1.2, 30, x - 3 + sway, 70);
  ctx.quadraticCurveTo(x + 3 + sway, 60, x + 3, 0);
  ctx.closePath();
  ctx.fill();
  // Runes
  const pulse = 0.5 + Math.sin(f.sway * 3) * 0.4;
  ctx.fillStyle = `rgba(220, 180, 255, ${pulse})`;
  for (let i = 1; i < 4; i++) {
    const t = i / 4;
    ctx.fillRect(x - 1 + sway * t, 70 * t - 1, 2, 2);
  }
}
function drawFgHangingScroll(x, f, sway) {
  ctx.strokeStyle = '#06060c';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x + sway * 0.5, 16);
  ctx.stroke();
  // Scroll
  ctx.fillStyle = '#e8d8b0';
  ctx.fillRect(x + sway * 0.5 - 5, 16, 10, 30);
  // Roller
  ctx.fillStyle = '#3a2818';
  ctx.fillRect(x + sway * 0.5 - 7, 14, 14, 3);
  ctx.fillRect(x + sway * 0.5 - 7, 45, 14, 3);
  // Lines (writing)
  ctx.fillStyle = '#5a4030';
  for (let i = 0; i < 4; i++) {
    ctx.fillRect(x + sway * 0.5 - 3, 20 + i * 5, 6, 0.8);
  }
}
function drawFgHangingTong(x, f, sway) {
  ctx.strokeStyle = '#06060c';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x + sway, 26);
  ctx.stroke();
  // Tongs
  ctx.strokeStyle = '#3a2010';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x + sway - 4, 26);
  ctx.lineTo(x + sway - 7, 50);
  ctx.moveTo(x + sway + 4, 26);
  ctx.lineTo(x + sway + 7, 50);
  ctx.stroke();
  // Tong heads
  ctx.fillStyle = '#1a1008';
  ctx.fillRect(x + sway - 9, 48, 4, 6);
  ctx.fillRect(x + sway + 5, 48, 4, 6);
}
function drawFgHangingHammer(x, f, sway) {
  ctx.strokeStyle = '#06060c';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x + sway, 30);
  ctx.stroke();
  // Shaft
  ctx.fillStyle = '#3a2010';
  ctx.fillRect(x + sway - 1.5, 30, 3, 20);
  // Head
  ctx.fillStyle = '#1a1008';
  ctx.fillRect(x + sway - 7, 26, 14, 8);
  ctx.fillStyle = '#5a3a20';
  ctx.fillRect(x + sway - 7, 26, 14, 2);
}

// ============ World events (lightning, rumble, etc.) ============
function updateWorldEvents(dt) {
  const biome = getBiome();
  game.worldEventCooldown -= dt;
  if (!game.worldEvent && game.worldEventCooldown <= 0) {
    // Trigger random event for this biome
    if (biome.id === 'dungeon' && Math.random() < 0.3) {
      game.worldEvent = { kind: 'lightning', timer: 0.5, intensity: 1, total: 0.5 };
      audio.bossWarn && audio.bossWarn(); // low rumble (reuse)
    } else if (biome.id === 'crypts' && Math.random() < 0.3) {
      game.worldEvent = { kind: 'wail', timer: 2.5, intensity: 1, total: 2.5 };
    } else if (biome.id === 'caves' && Math.random() < 0.3) {
      game.worldEvent = { kind: 'rumble', timer: 1.5, intensity: 1, total: 1.5 };
      game.shake = Math.max(game.shake, 6);
    } else if (biome.id === 'library' && Math.random() < 0.3) {
      game.worldEvent = { kind: 'pageStorm', timer: 3.0, intensity: 1, total: 3.0 };
      // Spawn a swirl of papers
      for (let i = 0; i < 30; i++) {
        game.atmoParticles.push({
          kind: 'paper',
          x: game.cameraX + rand(-50, W + 50),
          y: rand(0, bandTop),
          vx: rand(-60, -15),
          vy: rand(-30, 30),
          rot: rand(0, TAU),
          rotV: rand(-1.5, 1.5),
          life: rand(3, 5), maxLife: 5,
        });
      }
    } else if (biome.id === 'forge' && Math.random() < 0.3) {
      game.worldEvent = { kind: 'bellows', timer: 1.5, intensity: 1, total: 1.5 };
      // Big ember burst
      for (let i = 0; i < 40; i++) {
        game.embers.push({
          x: game.cameraX + rand(0, W),
          y: rand(bandBot, H),
          vx: rand(-30, 30),
          vy: rand(-200, -80),
          life: rand(1, 2.5), maxLife: 2.5,
          size: rand(1.5, 3),
        });
      }
    }
    game.worldEventCooldown = rand(8, 16);
  }
  if (game.worldEvent) {
    game.worldEvent.timer -= dt;
    if (game.worldEvent.timer <= 0) game.worldEvent = null;
  }
}

function drawWorldEventOverlay() {
  const ev = game.worldEvent;
  if (!ev) return;
  const t = ev.timer / ev.total;
  if (ev.kind === 'lightning') {
    // Bright flash, decays fast
    const a = Math.max(0, t) * (Math.random() < 0.5 ? 1 : 0.3);
    ctx.fillStyle = `rgba(200, 220, 255, ${a * 0.55})`;
    ctx.fillRect(0, 0, W, H);
    // Lightning bolt zigzag
    if (Math.random() < 0.4) {
      ctx.strokeStyle = `rgba(220, 230, 255, ${a})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      let lx = rand(W * 0.2, W * 0.8);
      ctx.moveTo(lx, 0);
      for (let i = 1; i < 6; i++) {
        lx += rand(-30, 30);
        ctx.lineTo(lx, (H / 6) * i);
      }
      ctx.stroke();
    }
  } else if (ev.kind === 'wail') {
    // Green tinted pulse
    const pulse = Math.sin((1 - t) * Math.PI) * 0.3;
    ctx.fillStyle = `rgba(80, 220, 120, ${pulse * 0.18})`;
    ctx.fillRect(0, 0, W, H);
  } else if (ev.kind === 'rumble') {
    // Dust falling from ceiling
    if (Math.random() < 0.6) {
      game.particles.push({
        x: game.cameraX + rand(0, W),
        y: rand(0, 20),
        vx: rand(-5, 5), vy: rand(20, 60),
        life: 1.2, maxLife: 1.2,
        color: '#3a3028', size: 1.5,
      });
    }
  } else if (ev.kind === 'pageStorm') {
    // Faint purple tint
    ctx.fillStyle = `rgba(180, 120, 220, ${Math.max(0, t) * 0.10})`;
    ctx.fillRect(0, 0, W, H);
  } else if (ev.kind === 'bellows') {
    // Warm orange glow flash
    ctx.fillStyle = `rgba(255, 120, 40, ${Math.max(0, t) * 0.18})`;
    ctx.fillRect(0, 0, W, H);
  }
}

function updateAtmosphere(dt) {
  const biome = getBiome();
  const id = biome.id;

  // Crypt floor fog
  if (id === 'crypts') {
    if (Math.random() < dt * 6) {
      game.atmoParticles.push({
        kind: 'fog',
        x: game.cameraX + W + rand(-100, 50),
        y: rand(bandBot - 30, H + 20),
        r: rand(50, 120),
        vx: -rand(15, 35),
        life: rand(4, 7), maxLife: 7,
      });
    }
  }
  // Cave water drops
  if (id === 'caves') {
    if (Math.random() < dt * 3) {
      game.atmoParticles.push({
        kind: 'drop',
        x: game.cameraX + rand(0, W),
        y: rand(0, 40),
        vy: 0,
        life: 3, maxLife: 3,
        target: rand(bandTop + 10, bandBot),
      });
    }
  }
  // Library floating papers
  if (id === 'library') {
    if (Math.random() < dt * 1.5) {
      game.atmoParticles.push({
        kind: 'paper',
        x: game.cameraX + rand(-40, W + 40),
        y: rand(20, bandTop * 0.9),
        vx: rand(-15, -5),
        vy: rand(-4, 4),
        rot: rand(0, TAU),
        rotV: rand(-0.6, 0.6),
        life: rand(5, 9), maxLife: 9,
      });
    }
  }
  // Forge extra cinders
  if (id === 'forge') {
    if (Math.random() < dt * 14) {
      game.atmoParticles.push({
        kind: 'cinder',
        x: game.cameraX + rand(-50, W + 50),
        y: rand(bandBot - 30, H),
        vx: rand(-10, 10),
        vy: rand(-90, -50),
        life: rand(1.2, 2.5), maxLife: 2.5,
        size: rand(1, 2.5),
      });
    }
  }

  // Update particles
  for (const a of game.atmoParticles) {
    if (a.kind === 'fog') {
      a.x += a.vx * dt;
      a.life -= dt;
    } else if (a.kind === 'drop') {
      a.vy += 600 * dt;
      a.y += a.vy * dt;
      if (a.y >= a.target) {
        // Splash: small ground particles
        for (let i = 0; i < 3; i++) {
          game.particles.push({
            x: a.x, y: a.target,
            vx: rand(-50, 50), vy: rand(-80, -20),
            life: 0.3, maxLife: 0.3,
            color: '#a0c0ff', size: 1.5,
          });
        }
        a.life = 0;
      }
    } else if (a.kind === 'paper') {
      a.x += a.vx * dt;
      a.y += a.vy * dt + Math.sin(a.rot) * 8 * dt;
      a.rot += a.rotV * dt;
      a.life -= dt;
    } else if (a.kind === 'cinder') {
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      a.vy += 30 * dt;  // weak gravity (slows rise)
      a.life -= dt;
    }
  }
  game.atmoParticles = game.atmoParticles.filter(a => a.life > 0);
}

function drawAtmosphere(dt) {
  const biome = getBiome();
  const id = biome.id;

  // Donjon: moonlight beams from windows
  if (id === 'dungeon') {
    const off = (game.cameraX * 0.18) % 360;
    for (let i = -1; i < W / 360 + 2; i++) {
      const x = i * 360 + 88 - off;
      const grad = ctx.createLinearGradient(x, bandTop * 0.4, x + 70, H);
      grad.addColorStop(0, 'rgba(180, 200, 240, 0.13)');
      grad.addColorStop(1, 'rgba(180, 200, 240, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(x, bandTop * 0.5);
      ctx.lineTo(x + 32, bandTop * 0.5);
      ctx.lineTo(x + 90, H);
      ctx.lineTo(x - 32, H);
      ctx.closePath();
      ctx.fill();
    }
  }

  // Forge: heat shimmer (subtle wave overlay near floor)
  if (id === 'forge') {
    const grad = ctx.createLinearGradient(0, bandTop, 0, H);
    grad.addColorStop(0, 'rgba(255, 100, 30, 0)');
    grad.addColorStop(0.6, 'rgba(255, 80, 20, 0.04)');
    grad.addColorStop(1, 'rgba(255, 60, 10, 0.08)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, bandTop, W, H - bandTop);
  }

  // Particles
  for (const a of game.atmoParticles) {
    const x = sX(a.x);
    if (a.kind === 'fog') {
      const alpha = clamp(a.life / a.maxLife, 0, 1);
      const grad = ctx.createRadialGradient(x, a.y, 1, x, a.y, a.r);
      grad.addColorStop(0, `rgba(140, 220, 160, ${alpha * 0.18})`);
      grad.addColorStop(1, 'rgba(140, 220, 160, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(x, a.y, a.r, a.r * 0.5, 0, 0, TAU);
      ctx.fill();
    } else if (a.kind === 'drop') {
      ctx.fillStyle = 'rgba(180, 220, 255, 0.85)';
      ctx.beginPath();
      ctx.ellipse(x, a.y, 1.5, 4, 0, 0, TAU);
      ctx.fill();
    } else if (a.kind === 'paper') {
      const alpha = clamp(a.life / a.maxLife, 0, 1);
      ctx.save();
      ctx.translate(x, a.y);
      ctx.rotate(a.rot);
      ctx.fillStyle = `rgba(220, 200, 160, ${alpha * 0.7})`;
      ctx.fillRect(-5, -3, 10, 6);
      ctx.strokeStyle = `rgba(80, 50, 30, ${alpha * 0.5})`;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(-3, -1); ctx.lineTo(3, -1);
      ctx.moveTo(-3, 1);  ctx.lineTo(3, 1);
      ctx.stroke();
      ctx.restore();
    } else if (a.kind === 'cinder') {
      const alpha = clamp(a.life / a.maxLife, 0, 1);
      ctx.fillStyle = `rgba(255, ${100 + Math.floor(alpha * 100)}, 30, ${alpha})`;
      ctx.beginPath();
      ctx.arc(x, a.y, a.size * alpha + 0.5, 0, TAU);
      ctx.fill();
    }
  }
}

// ============ Props (decorative scenery) ============
function maybeSpawnProp() {
  if (!game.lastPropX) game.lastPropX = -200;
  // Spawn more densely — 60-130 px instead of 120-260
  const target = game.lastPropX + rand(60, 130);
  if (game.cameraX < target) return;
  game.lastPropX = game.cameraX;
  const biome = getBiome();
  const type = biome.propTypes[Math.floor(Math.random() * biome.propTypes.length)];
  const x = game.cameraX + W + 40 + rand(0, 60);
  // anchor on or near the floor
  const y = rand(bandTop + 25, bandBot + 5);
  game.props.push({ type, x, y, seed: Math.random() });
  // 30% chance to spawn a second prop right after (clustered)
  if (Math.random() < 0.30) {
    game.props.push({
      type: biome.propTypes[Math.floor(Math.random() * biome.propTypes.length)],
      x: x + rand(20, 50),
      y: rand(bandTop + 25, bandBot + 5),
      seed: Math.random(),
    });
  }
}

function updateProps() {
  game.props = game.props.filter(pr => pr.x > game.cameraX - 200);
}

function drawProps() {
  for (const pr of game.props) {
    const x = sX(pr.x);
    const y = pr.y;
    drawProp(pr, x, y);
  }
}

function drawProp(pr, x, y) {
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(x, y + 2, 12, 3, 0, 0, TAU);
  ctx.fill();

  if (pr.type === 'skull') {
    ctx.fillStyle = '#c8c0a8';
    ctx.beginPath();
    ctx.arc(x, y - 5, 6, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#a89870';
    ctx.fillRect(x - 4, y - 1, 8, 2);
    ctx.fillStyle = '#000';
    ctx.fillRect(x - 3, y - 6, 2, 2);
    ctx.fillRect(x + 1, y - 6, 2, 2);
  } else if (pr.type === 'crackedSlab') {
    ctx.fillStyle = '#1a1a26';
    ctx.fillRect(x - 14, y - 4, 28, 6);
    ctx.strokeStyle = 'rgba(80, 60, 80, 0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 8, y - 4);
    ctx.lineTo(x - 4, y);
    ctx.lineTo(x + 4, y - 2);
    ctx.stroke();
  } else if (pr.type === 'coffin') {
    ctx.fillStyle = '#3a2818';
    // Diamond-ish coffin viewed from above (top-down side perspective)
    ctx.beginPath();
    ctx.moveTo(x - 18, y - 4);
    ctx.lineTo(x - 14, y - 12);
    ctx.lineTo(x + 14, y - 12);
    ctx.lineTo(x + 18, y - 4);
    ctx.lineTo(x + 14, y + 4);
    ctx.lineTo(x - 14, y + 4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#5a3818';
    ctx.lineWidth = 1;
    ctx.stroke();
    // cross
    ctx.fillStyle = '#a08858';
    ctx.fillRect(x - 1, y - 9, 2, 8);
    ctx.fillRect(x - 3, y - 7, 6, 2);
  } else if (pr.type === 'bones') {
    ctx.fillStyle = '#c8c0a8';
    // long bone
    ctx.fillRect(x - 8, y - 2, 14, 2);
    ctx.beginPath();
    ctx.arc(x - 9, y - 1, 2, 0, TAU);
    ctx.arc(x + 7, y - 1, 2, 0, TAU);
    ctx.fill();
    // short bone
    ctx.fillRect(x - 4, y, 10, 1);
  } else if (pr.type === 'stalagmite') {
    ctx.fillStyle = '#3a4458';
    ctx.beginPath();
    ctx.moveTo(x - 8, y);
    ctx.lineTo(x, y - 24);
    ctx.lineTo(x + 8, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#5a6478';
    ctx.beginPath();
    ctx.moveTo(x - 4, y);
    ctx.lineTo(x, y - 24);
    ctx.lineTo(x - 1, y);
    ctx.closePath();
    ctx.fill();
  } else if (pr.type === 'mushroom') {
    // stem
    ctx.fillStyle = '#d8d0c0';
    ctx.fillRect(x - 2, y - 10, 4, 10);
    // cap
    const capColor = pr.seed < 0.5 ? '#b03040' : '#3060a0';
    ctx.fillStyle = capColor;
    ctx.beginPath();
    ctx.arc(x, y - 10, 7, Math.PI, TAU);
    ctx.fill();
    // spots
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - 4, y - 12, 2, 2);
    ctx.fillRect(x + 1, y - 14, 2, 2);
    // glow
    const glow = ctx.createRadialGradient(x, y - 10, 1, x, y - 10, 18);
    glow.addColorStop(0, capColor === '#b03040' ? 'rgba(220,80,100,0.25)' : 'rgba(80,160,255,0.25)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - 18, y - 28, 36, 30);
  } else if (pr.type === 'puddle') {
    ctx.fillStyle = 'rgba(80, 140, 200, 0.5)';
    ctx.beginPath();
    ctx.ellipse(x, y, 18, 5, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(180, 220, 255, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(x, y - 1, 14, 3, 0, 0, TAU);
    ctx.stroke();
  } else if (pr.type === 'bookshelf') {
    ctx.fillStyle = '#2a1830';
    ctx.fillRect(x - 14, y - 32, 28, 32);
    // shelves
    ctx.fillStyle = '#1a0820';
    ctx.fillRect(x - 14, y - 22, 28, 1);
    ctx.fillRect(x - 14, y - 12, 28, 1);
    // books
    const colors = ['#6a2a3a', '#3a2a5a', '#5a3a2a', '#3a2a4a', '#7a4040', '#2a3a5a'];
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = colors[(i + row * 2 + Math.floor(pr.seed * 6)) % colors.length];
        ctx.fillRect(x - 12 + i * 5, y - 30 + row * 10, 4, 8);
      }
    }
  } else if (pr.type === 'candle') {
    // candlestick base
    ctx.fillStyle = '#3a2818';
    ctx.fillRect(x - 4, y - 2, 8, 4);
    ctx.fillRect(x - 2, y - 14, 4, 12);
    // candle
    ctx.fillStyle = '#e8e0c0';
    ctx.fillRect(x - 1.5, y - 22, 3, 8);
    // flame
    const flicker = 0.7 + Math.sin(game.t * 8 + pr.seed * 10) * 0.3;
    const grad = ctx.createRadialGradient(x, y - 24, 0.5, x, y - 24, 12);
    grad.addColorStop(0, `rgba(220, 140, 255, ${flicker})`);
    grad.addColorStop(1, 'rgba(140, 60, 220, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y - 24, 12, 0, TAU);
    ctx.fill();
    ctx.fillStyle = `rgba(255, 220, 255, ${flicker})`;
    ctx.beginPath();
    ctx.ellipse(x, y - 24, 1.5, 4, 0, 0, TAU);
    ctx.fill();
  } else if (pr.type === 'book') {
    ctx.fillStyle = pr.seed < 0.5 ? '#3a2a5a' : '#5a2a3a';
    ctx.fillRect(x - 6, y - 3, 12, 4);
    ctx.fillStyle = '#d8c890';
    ctx.fillRect(x - 5, y - 2.5, 10, 0.6);
  } else if (pr.type === 'anvil') {
    ctx.fillStyle = '#1a1a20';
    // base
    ctx.fillRect(x - 8, y - 2, 16, 4);
    // body
    ctx.beginPath();
    ctx.moveTo(x - 10, y - 4);
    ctx.lineTo(x - 14, y - 10);
    ctx.lineTo(x + 14, y - 10);
    ctx.lineTo(x + 10, y - 4);
    ctx.closePath();
    ctx.fill();
    // top edge highlight
    ctx.fillStyle = '#3a3a40';
    ctx.fillRect(x - 14, y - 11, 28, 1);
  } else if (pr.type === 'magmaCrack') {
    const pulse = 0.5 + Math.sin(game.t * 4 + pr.seed * 10) * 0.3;
    ctx.fillStyle = `rgba(255, 100, 40, ${pulse * 0.4})`;
    ctx.beginPath();
    ctx.ellipse(x, y, 28, 7, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = `rgba(255, 200, 80, ${pulse})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 22, y);
    ctx.lineTo(x - 6, y - 3);
    ctx.lineTo(x + 8, y + 2);
    ctx.lineTo(x + 22, y - 1);
    ctx.stroke();
  } else if (pr.type === 'forgeBlock') {
    // small forge with glowing coals
    ctx.fillStyle = '#1a0808';
    ctx.fillRect(x - 14, y - 14, 28, 14);
    ctx.fillStyle = '#3a1a10';
    ctx.fillRect(x - 12, y - 12, 24, 4);
    // glow
    const pulse = 0.6 + Math.sin(game.t * 5 + pr.seed * 5) * 0.3;
    const glow = ctx.createRadialGradient(x, y - 6, 1, x, y - 6, 22);
    glow.addColorStop(0, `rgba(255, 200, 80, ${pulse * 0.8})`);
    glow.addColorStop(1, 'rgba(255, 80, 20, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - 22, y - 22, 44, 26);
    ctx.fillStyle = `rgba(255, 140, 40, ${pulse})`;
    ctx.fillRect(x - 8, y - 8, 16, 4);
  }
}

// ============ Hero ============
function drawPlayer() {
  const p = game.player;
  const x = sX(p.x);
  const y = p.y;
  const blink = p.invuln > 0 && Math.floor(p.invuln * 20) % 2 === 0;
  if (blink) return;

  // Ground shadow (wider when attacking — feet planted)
  const shadowR = p.attackTimer > 0 ? 26 : 22;
  const sg = ctx.createRadialGradient(x, y + 4, 2, x, y + 4, shadowR + 4);
  sg.addColorStop(0, 'rgba(0, 0, 0, 0.65)');
  sg.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = sg;
  ctx.beginPath();
  ctx.ellipse(x, y + 4, shadowR, 6.5, 0, 0, TAU);
  ctx.fill();

  // Dark aura behind hero (pulsing red wisps)
  drawDarkAura(p, x, y);

  const walk = p.moving ? Math.sin(p.walkPhase) : 0;
  // Walk bob + idle breathing
  const bob = p.moving ? Math.abs(walk) * 2 : (Math.sin(game.t * 1.6) * 0.7);

  ctx.save();
  ctx.translate(x, y - bob);
  // Back attachment (sheathed dagger / scabbard silhouette)
  drawBackBlade(p);
  drawCape(p, walk);
  drawLegs(p, walk);
  drawArmor(p);
  drawArm(p);            // off-hand arm with gauntlet
  drawPauldrons(p);
  drawHelm(p, walk);
  drawPlayerWeapon(p);

  // Ring glow on hand (only if equipped)
  const eq = getEquipPalette();
  if (eq.ringRGB) {
    const handX = p.facing * 18;
    const handY = -p.h * 0.45;
    const pulse = 0.55 + Math.sin(game.t * 5) * 0.30;
    const glow = ctx.createRadialGradient(handX, handY, 0.5, handX, handY, 14);
    glow.addColorStop(0, `rgba(${eq.ringRGB}, ${pulse})`);
    glow.addColorStop(0.5, `rgba(${eq.ringRGB}, ${pulse * 0.4})`);
    glow.addColorStop(1, `rgba(${eq.ringRGB}, 0)`);
    ctx.fillStyle = glow;
    ctx.fillRect(handX - 14, handY - 14, 28, 28);
    ctx.fillStyle = eq.ringHand;
    ctx.beginPath();
    ctx.arc(handX, handY, 1.6, 0, TAU);
    ctx.fill();
  }
  ctx.restore();

  // Speed lines / dark wisps when running (outside translate)
  if (p.moving && Math.random() < 0.35) {
    game.particles.push({
      x: p.x - p.facing * rand(8, 18),
      y: p.y - rand(8, p.h * 0.7),
      vx: -p.facing * rand(20, 60),
      vy: rand(-20, -5),
      life: 0.35, maxLife: 0.35,
      color: 'rgba(120, 20, 30, 0.7)',
      size: 2.2,
    });
  }
}

function drawDarkAura(p, x, y) {
  // Subtle red mist around the lower body — gives "presence"
  const pulse = 0.6 + Math.sin(game.t * 2.2) * 0.25;
  const grad = ctx.createRadialGradient(x, y - p.h * 0.35, 4, x, y - p.h * 0.35, 44);
  grad.addColorStop(0, `rgba(140, 20, 30, ${0.20 * pulse})`);
  grad.addColorStop(0.6, `rgba(80, 10, 20, ${0.10 * pulse})`);
  grad.addColorStop(1, 'rgba(40, 0, 10, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(x, y - p.h * 0.35, 30, 50, 0, 0, TAU);
  ctx.fill();
}

function drawBackBlade(p) {
  // Sheathed secondary blade on back (visible behind shoulder, opposite-facing)
  const sx = -p.facing * 6;
  const top = -p.h + 4;
  ctx.save();
  ctx.translate(sx, top + 16);
  ctx.rotate(-p.facing * 0.4);
  // Pommel
  ctx.fillStyle = '#3a2410';
  ctx.fillRect(-3, -2, 6, 5);
  ctx.fillStyle = '#aa7028';
  ctx.beginPath(); ctx.arc(0, -3, 2.2, 0, TAU); ctx.fill();
  // Scabbard
  ctx.fillStyle = '#1a0a08';
  ctx.fillRect(-2.5, 3, 5, 22);
  ctx.fillStyle = '#3a2010';
  ctx.fillRect(-2.5, 8, 5, 1);
  ctx.fillRect(-2.5, 16, 5, 1);
  ctx.restore();
}

function drawCape(p, walk) {
  const sway = walk * 4 + Math.sin(game.t * 2.5) * 1.5;
  const f = -p.facing;

  // Outer dark layer (almost black)
  ctx.fillStyle = p.flash > 0 ? '#ffaaaa' : '#1a0608';
  ctx.beginPath();
  ctx.moveTo(f * 9, -p.h * 0.86);
  ctx.quadraticCurveTo(f * 30 + sway, -p.h * 0.4, f * 26 + sway * 1.2, -p.h * 0.02);
  // Torn bottom edge (zigzag)
  ctx.lineTo(f * 22 + sway, -p.h * 0.08);
  ctx.lineTo(f * 19 + sway, -p.h * 0.02);
  ctx.lineTo(f * 15 + sway, -p.h * 0.10);
  ctx.lineTo(f * 12 + sway, -p.h * 0.03);
  ctx.lineTo(f * 9 + sway, -p.h * 0.09);
  ctx.lineTo(f * 5, -p.h * 0.04);
  ctx.quadraticCurveTo(f * 16, -p.h * 0.4, f * 5, -p.h * 0.86);
  ctx.closePath();
  ctx.fill();

  // Mid layer (deep red)
  ctx.fillStyle = p.flash > 0 ? '#ffd0d0' : '#7a1a1a';
  ctx.beginPath();
  ctx.moveTo(f * 7, -p.h * 0.84);
  ctx.quadraticCurveTo(f * 24 + sway, -p.h * 0.4, f * 22 + sway, -p.h * 0.08);
  ctx.lineTo(f * 19 + sway, -p.h * 0.12);
  ctx.lineTo(f * 15 + sway, -p.h * 0.15);
  ctx.lineTo(f * 11 + sway, -p.h * 0.10);
  ctx.lineTo(f * 5, -p.h * 0.10);
  ctx.quadraticCurveTo(f * 14, -p.h * 0.4, f * 4, -p.h * 0.84);
  ctx.closePath();
  ctx.fill();

  // Highlight (brighter red, narrow strip)
  ctx.fillStyle = p.flash > 0 ? '#ffe8e8' : '#b03030';
  ctx.beginPath();
  ctx.moveTo(f * 5, -p.h * 0.82);
  ctx.quadraticCurveTo(f * 16 + sway, -p.h * 0.4, f * 14 + sway, -p.h * 0.15);
  ctx.lineTo(f * 9 + sway, -p.h * 0.20);
  ctx.lineTo(f * 4, -p.h * 0.18);
  ctx.quadraticCurveTo(f * 10, -p.h * 0.4, f * 2, -p.h * 0.82);
  ctx.closePath();
  ctx.fill();

  // Cape clasp at shoulder (chain link)
  ctx.fillStyle = p.flash > 0 ? '#fff' : '#8a6020';
  ctx.beginPath();
  ctx.arc(f * 8, -p.h * 0.85, 2.2, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#3a2008';
  ctx.beginPath();
  ctx.arc(f * 8, -p.h * 0.85, 1, 0, TAU);
  ctx.fill();
}

function drawLegs(p, walk) {
  const legW = 9, legH = 22;
  const offset = walk * 5;
  const eq = getEquipPalette();
  const flash = p.flash > 0;

  // Back leg (drawn first, behind)
  drawSingleLeg(p, -legW - 4, -legH - 4 + offset, legW, legH, eq, flash, 0.85);
  // Front leg (full color)
  drawSingleLeg(p, 4, -legH - 4 - offset, legW, legH, eq, flash, 1.0);
}

function drawSingleLeg(p, lx, ly, lw, lh, eq, flash, shadeMul) {
  // Cloth pants (dark)
  ctx.fillStyle = flash ? '#ffaaaa' : (shadeMul < 1 ? '#10101a' : '#15151c');
  ctx.fillRect(lx, ly, lw, lh);

  // Thigh plate (top half, metallic)
  const plateGrad = ctx.createLinearGradient(0, ly, 0, ly + lh * 0.55);
  plateGrad.addColorStop(0, flash ? '#fff' : eq.armorMid);
  plateGrad.addColorStop(1, flash ? '#ffaaaa' : '#08080e');
  ctx.fillStyle = plateGrad;
  ctx.fillRect(lx, ly + 2, lw, lh * 0.5);

  // Knee guard (rounded plate)
  ctx.fillStyle = flash ? '#fff' : eq.armorBase;
  ctx.beginPath();
  ctx.ellipse(lx + lw / 2, ly + lh * 0.55, lw * 0.6, 4, 0, 0, TAU);
  ctx.fill();
  // Knee spike (small)
  ctx.fillStyle = flash ? '#ffd0d0' : eq.armorAccent;
  ctx.beginPath();
  ctx.moveTo(lx + lw / 2 - 2, ly + lh * 0.55);
  ctx.lineTo(lx + lw / 2, ly + lh * 0.55 - 4);
  ctx.lineTo(lx + lw / 2 + 2, ly + lh * 0.55);
  ctx.closePath();
  ctx.fill();

  // Boot (armored, wider at toe in facing dir)
  const bootY = ly + lh - 6;
  ctx.fillStyle = flash ? '#ffaaaa' : '#0a0a10';
  ctx.fillRect(lx - 1, bootY, lw + 2 + (p.facing > 0 ? 3 : 0) * (lx > 0 ? 1 : 0), 6);
  // Buckle strap on boot
  ctx.fillStyle = flash ? '#ffd0d0' : eq.armorBelt;
  ctx.fillRect(lx, bootY + 1, lw, 1.5);
}

function drawArm(p) {
  // Off-hand arm hanging at side (or holding shield-side)
  const eq = getEquipPalette();
  const armX = -p.facing * 12;
  const top = -p.h + 22;
  const swing = p.moving ? Math.sin(p.walkPhase + Math.PI) * 4 : Math.sin(game.t * 1.6) * 0.6;

  // Upper arm
  ctx.fillStyle = p.flash > 0 ? '#ffaaaa' : '#15151c';
  ctx.fillRect(armX - 3, top, 6, 18);
  // Shoulder pad (lighter)
  ctx.fillStyle = p.flash > 0 ? '#fff' : eq.armorMid;
  ctx.beginPath();
  ctx.ellipse(armX, top + 1, 5, 4, 0, 0, TAU);
  ctx.fill();
  // Forearm with gauntlet (segmented)
  const faTop = top + 16 + swing * 0.4;
  ctx.fillStyle = p.flash > 0 ? '#ffaaaa' : eq.armorBase;
  ctx.fillRect(armX - 3.5, faTop, 7, 12);
  // Gauntlet segments (3 horizontal lines)
  ctx.fillStyle = p.flash > 0 ? '#ffd0d0' : '#0a0a10';
  ctx.fillRect(armX - 3.5, faTop + 3, 7, 0.8);
  ctx.fillRect(armX - 3.5, faTop + 7, 7, 0.8);
  // Knuckle spikes
  if (eq.armor >= 2) {
    ctx.fillStyle = eq.armorAccent;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(armX + i * 1.8 - 0.8, faTop + 11);
      ctx.lineTo(armX + i * 1.8, faTop + 13.5);
      ctx.lineTo(armX + i * 1.8 + 0.8, faTop + 11);
      ctx.closePath();
      ctx.fill();
    }
  }
  // Fist (closed)
  ctx.fillStyle = p.flash > 0 ? '#ffaaaa' : '#08080e';
  ctx.beginPath();
  ctx.arc(armX, faTop + 13, 2.5, 0, TAU);
  ctx.fill();
}

function drawArmor(p) {
  const top = -p.h + 18;
  const bottom = -22;
  const eq = getEquipPalette();
  const flash = p.flash > 0;

  // Outer silhouette (gives the chest depth)
  ctx.fillStyle = flash ? '#ffaaaa' : '#04020a';
  roundRect(-17, top - 1, 34, bottom - top + 2, 5);
  ctx.fill();

  // Body plate gradient
  const grad = ctx.createLinearGradient(0, top, 0, bottom);
  grad.addColorStop(0, flash ? '#ffffff' : eq.armorBase);
  grad.addColorStop(0.5, flash ? '#ffaaaa' : eq.armorMid);
  grad.addColorStop(1, flash ? '#ffaaaa' : '#0e0a14');
  ctx.fillStyle = grad;
  roundRect(-16, top, 32, bottom - top, 4);
  ctx.fill();

  // Inner chest split line (gives chiselled chest plate look)
  ctx.strokeStyle = flash ? '#fff' : 'rgba(0, 0, 0, 0.6)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, top + 4);
  ctx.lineTo(0, bottom - 4);
  ctx.stroke();

  // Side rivets (4 down each side)
  ctx.fillStyle = flash ? '#fff' : eq.armorBelt;
  for (let i = 0; i < 4; i++) {
    const ry = top + 6 + i * ((bottom - top - 10) / 3);
    ctx.beginPath(); ctx.arc(-13, ry, 1.2, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(13, ry, 1.2, 0, TAU); ctx.fill();
  }

  // Tier 2/3: extra plate ridges
  if (eq.armor >= 2) {
    ctx.strokeStyle = eq.armorAccent;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-14, top + 8);  ctx.lineTo(14, top + 8);
    ctx.moveTo(-15, bottom - 8); ctx.lineTo(15, bottom - 8);
    ctx.stroke();
  }

  // Pulsing rune on chest (always visible — signature element)
  const runePulse = 0.55 + Math.sin(game.t * 2.3) * 0.35;
  const runeColor = eq.crestColor;
  // Rune halo
  const runeGlow = ctx.createRadialGradient(0, top + 14, 1, 0, top + 14, 14);
  runeGlow.addColorStop(0, `rgba(255, 60, 50, ${runePulse * 0.5})`);
  runeGlow.addColorStop(1, 'rgba(255, 60, 50, 0)');
  ctx.fillStyle = runeGlow;
  ctx.fillRect(-14, top + 4, 28, 22);
  // Rune shape: inverted triangle + slash (cross-like sigil)
  ctx.fillStyle = flash ? '#fff' : runeColor;
  ctx.beginPath();
  ctx.moveTo(-5, top + 8);
  ctx.lineTo(5, top + 8);
  ctx.lineTo(0, top + 18);
  ctx.closePath();
  ctx.fill();
  // Vertical bar across triangle
  ctx.fillRect(-0.8, top + 6, 1.6, 14);
  // Tiny side ticks
  ctx.fillRect(-4, top + 12, 2, 1);
  ctx.fillRect(2, top + 12, 2, 1);

  // V-crest (chevron pointing down, framing the rune)
  ctx.strokeStyle = flash ? '#ffd0d0' : eq.armorAccent;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-10, top + 22);
  ctx.lineTo(0, top + 28);
  ctx.lineTo(10, top + 22);
  ctx.stroke();

  // Belt
  ctx.fillStyle = '#1a0810';
  ctx.fillRect(-17, bottom - 4, 34, 5);
  // Belt buckle (skull stylized)
  ctx.fillStyle = flash ? '#fff' : eq.armorBelt;
  ctx.fillRect(-4, bottom - 4, 8, 5);
  ctx.fillStyle = '#08040a';
  ctx.fillRect(-2.5, bottom - 3, 1.5, 1.5);
  ctx.fillRect(1, bottom - 3, 1.5, 1.5);
  ctx.fillRect(-1, bottom - 1, 2, 1);
  // Hanging belt pouch / loincloth strip (small)
  ctx.fillStyle = flash ? '#ffd0d0' : '#5a1818';
  ctx.beginPath();
  ctx.moveTo(-6, bottom + 1);
  ctx.lineTo(-3, bottom + 8);
  ctx.lineTo(3, bottom + 8);
  ctx.lineTo(6, bottom + 1);
  ctx.closePath();
  ctx.fill();
  // Tier 3: gold trim along top edge
  if (eq.armor === 3) {
    ctx.fillStyle = '#ffd860';
    ctx.fillRect(-16, top + 1, 32, 1);
  }
}

function drawPauldrons(p) {
  const top = -p.h + 18;
  const eq = getEquipPalette();
  const flash = p.flash > 0;

  for (const side of [-1, 1]) {
    // Layered shadow under pauldron (depth)
    ctx.fillStyle = flash ? '#ffaaaa' : '#04020a';
    ctx.beginPath();
    ctx.ellipse(side * 19, top + 5, 12, 9, 0, 0, TAU);
    ctx.fill();

    // Pauldron base (large dome)
    const pg = ctx.createRadialGradient(side * 18, top + 1, 1, side * 18, top + 4, 12);
    pg.addColorStop(0, flash ? '#fff' : eq.armorBase);
    pg.addColorStop(1, flash ? '#ffaaaa' : '#08040a');
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.ellipse(side * 18, top + 4, 11, 9, 0, 0, TAU);
    ctx.fill();

    // Pauldron rim (lighter band on top)
    ctx.strokeStyle = flash ? '#ffd0d0' : eq.armorAccent;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.ellipse(side * 18, top + 4, 11, 9, 0, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();

    // Top spike (large)
    ctx.fillStyle = flash ? '#ffd0d0' : eq.armorAccent;
    ctx.beginPath();
    ctx.moveTo(side * 22, top - 2);
    ctx.lineTo(side * 30, top - 12);
    ctx.lineTo(side * 24, top + 2);
    ctx.closePath();
    ctx.fill();
    // Spike highlight
    ctx.strokeStyle = flash ? '#fff' : 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(side * 22, top - 2);
    ctx.lineTo(side * 30, top - 12);
    ctx.stroke();

    // Mini secondary spike (front)
    ctx.fillStyle = flash ? '#ffd0d0' : '#1a0a12';
    ctx.beginPath();
    ctx.moveTo(side * 14, top - 2);
    ctx.lineTo(side * 18, top - 7);
    ctx.lineTo(side * 17, top + 1);
    ctx.closePath();
    ctx.fill();
  }
}

function getEquipPalette() {
  const eq = game.equipment || { helmet: 0, armor: 0, ring: 0 };
  return {
    helmet: eq.helmet,
    armor: eq.armor,
    ring: eq.ring,
    helmBase:  ['#1c1820', '#3a2818', '#42424c', '#4a3a08'][eq.helmet],
    helmAccent:['#0a0810', '#22140a', '#22222a', '#1a1408'][eq.helmet],
    helmTrim:  [null,      '#aa7038', '#a0a0b8', '#ffd860'][eq.helmet],
    visorRGB:  ['255, 60, 50', '255, 100, 30', '120, 200, 255', '255, 220, 80'][eq.helmet],
    armorBase:   ['#2a2236', '#3a2818', '#3a3a48', '#4a3a08'][eq.armor],
    armorMid:    ['#1a1422', '#22180a', '#1c1c28', '#2a1f04'][eq.armor],
    armorAccent: ['#3a2240', '#7a4818', '#a0a0b8', '#ffd860'][eq.armor],
    armorBelt:   ['#aa6020', '#cc8030', '#a0a0b8', '#ffd860'][eq.armor],
    crestColor:  ['#cc1818', '#cc1818', '#cc1818', '#ff4040'][eq.armor],
    ringHand: [null, '#ff6060', '#80c0ff', '#ffd840'][eq.ring],
    ringRGB:  [null, '255, 96, 96', '128, 192, 255', '255, 216, 64'][eq.ring],
  };
}

function drawHelm(p, walk) {
  const top = -p.h + 2;
  const eq = getEquipPalette();
  const flash = p.flash > 0;

  // Outer silhouette (helmet depth)
  ctx.fillStyle = flash ? '#ffaaaa' : '#02020a';
  ctx.beginPath();
  ctx.moveTo(-14, top + 25);
  ctx.lineTo(-14, top + 7);
  ctx.quadraticCurveTo(0, top - 5, 14, top + 7);
  ctx.lineTo(14, top + 25);
  ctx.lineTo(p.facing * 10, top + 30);
  ctx.lineTo(-p.facing * 10, top + 30);
  ctx.closePath();
  ctx.fill();

  // Base helm with gradient (top brighter than chin)
  const hg = ctx.createLinearGradient(0, top - 2, 0, top + 28);
  hg.addColorStop(0, flash ? '#ffffff' : eq.helmBase);
  hg.addColorStop(0.6, flash ? '#ffaaaa' : eq.helmAccent);
  hg.addColorStop(1, flash ? '#ffaaaa' : '#04040a');
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.moveTo(-13, top + 24);
  ctx.lineTo(-13, top + 8);
  ctx.quadraticCurveTo(0, top - 4, 13, top + 8);
  ctx.lineTo(13, top + 24);
  ctx.lineTo(p.facing * 9, top + 28);
  ctx.lineTo(-p.facing * 9, top + 28);
  ctx.closePath();
  ctx.fill();

  // Brow ridge (menacing brow shadow)
  ctx.fillStyle = flash ? '#fff' : '#000';
  ctx.beginPath();
  ctx.moveTo(-12, top + 12);
  ctx.quadraticCurveTo(0, top + 8, 12, top + 12);
  ctx.lineTo(11, top + 14);
  ctx.quadraticCurveTo(0, top + 11, -11, top + 14);
  ctx.closePath();
  ctx.fill();

  // Inner dark eye socket
  ctx.fillStyle = '#000';
  ctx.fillRect(-10, top + 13, 20, 7);

  // Helm trim band (only with equipment)
  if (eq.helmTrim) {
    ctx.fillStyle = flash ? '#ffd0d0' : eq.helmTrim;
    ctx.fillRect(-13, top + 22, 26, 2);
  }

  // Nose guard / face strip (vertical center bar from brow down to chin)
  ctx.fillStyle = flash ? '#fff' : eq.helmAccent;
  ctx.fillRect(-1.5, top + 12, 3, 16);
  ctx.fillStyle = flash ? '#fff' : 'rgba(255, 255, 255, 0.2)';
  ctx.fillRect(-0.5, top + 13, 1, 14);

  // Chin grille (3 vertical bars on lower jaw)
  ctx.fillStyle = flash ? '#fff' : eq.helmAccent;
  for (let i = -1; i <= 1; i++) {
    if (i === 0) continue; // skip center (nose guard already there)
    ctx.fillRect(i * 5 - 0.6, top + 21, 1.2, 7);
  }

  // Horns (more curved + thicker)
  ctx.fillStyle = flash ? '#ffaaaa' : eq.helmAccent;
  ctx.beginPath();
  ctx.moveTo(-13, top + 8);
  ctx.quadraticCurveTo(-26, top - 4, -20, top - 18);
  ctx.quadraticCurveTo(-12, top - 6, -10, top + 6);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(13, top + 8);
  ctx.quadraticCurveTo(26, top - 4, 20, top - 18);
  ctx.quadraticCurveTo(12, top - 6, 10, top + 6);
  ctx.closePath();
  ctx.fill();

  // Horn ridges (3 small dark notches per horn for texture)
  ctx.fillStyle = flash ? '#ffd0d0' : '#08040a';
  for (let i = 0; i < 3; i++) {
    const t2 = 0.3 + i * 0.2;
    ctx.fillRect(-22 + i * 2, top - 8 + i * 4, 3, 0.8);
    ctx.fillRect(20 - i * 2, top - 8 + i * 4, 3, 0.8);
  }

  // Horn tips with trim color (high tier)
  if (eq.helmTrim && eq.helmet >= 2) {
    ctx.fillStyle = eq.helmTrim;
    ctx.beginPath();
    ctx.arc(-21, top - 16, 2.8, 0, TAU);
    ctx.arc(21, top - 16, 2.8, 0, TAU);
    ctx.fill();
  }

  // Tier 3: gold crown spikes between horns
  if (eq.helmet === 3) {
    ctx.fillStyle = '#ffe080';
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 5 - 1.5, top + 2);
      ctx.lineTo(i * 5, top - 7);
      ctx.lineTo(i * 5 + 1.5, top + 2);
      ctx.fill();
    }
  }

  // Visor / eye glow (glowing slit between brow and nose-guard)
  const glowAlpha = 0.75 + Math.sin(game.t * 6) * 0.22;
  const glow = ctx.createRadialGradient(p.facing * 1, top + 16, 1, p.facing * 1, top + 16, 18);
  glow.addColorStop(0, `rgba(${eq.visorRGB}, ${glowAlpha * 0.85})`);
  glow.addColorStop(1, `rgba(${eq.visorRGB}, 0)`);
  ctx.fillStyle = glow;
  ctx.fillRect(-18, top + 5, 36, 26);

  // Two eye slits (left + right of nose-guard) — more menacing than a single bar
  ctx.fillStyle = `rgb(${eq.visorRGB})`;
  ctx.fillRect(-9 + p.facing * 0.5, top + 15, 6, 2.5);
  ctx.fillRect(3 + p.facing * 0.5, top + 15, 6, 2.5);
  // Hot core (white center of each slit)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-8 + p.facing * 0.5, top + 15.5, 4, 1.2);
  ctx.fillRect(4 + p.facing * 0.5, top + 15.5, 4, 1.2);

  // Tiny eye-glow particle drift (occasional)
  if (Math.random() < 0.06) {
    game.particles.push({
      x: p.x + p.facing * rand(-4, 4),
      y: p.y + (top + 16) - rand(0, 4),
      vx: p.facing * rand(-5, 15),
      vy: rand(-30, -10),
      life: 0.5, maxLife: 0.5,
      color: `rgba(${eq.visorRGB}, 0.8)`,
      size: 1.4,
    });
  }
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
function drawAttackTelegraph(e, x, y) {
  let aoeRadius = 0;
  let dirRange = 0;
  let dirAngle = 0;

  if (e.skillState === 'windup' && e.type.skill && e.type.skill.name === 'slam') {
    aoeRadius = e.type.skill.aoeRadius;
  } else if (e.isBoss && e.bossId === 'golem' && e.ai && e.ai.state === 'windup') {
    const phase2 = e.hp < e.maxHp * 0.4;
    aoeRadius = phase2 ? 240 : 200;
  } else if (e.skillState === 'windup' && e.type.skill && e.type.skill.name === 'shieldBash') {
    const p = game.player;
    if (p) {
      dirAngle = Math.atan2(p.y - e.y, p.x - e.x);
      dirRange = e.type.skill.range || 150;
    }
  } else if (e.skillState === 'windup' && e.type.skill && e.type.skill.name === 'lunge') {
    const p = game.player;
    if (p) {
      dirAngle = Math.atan2(p.y - e.y, p.x - e.x);
      dirRange = e.type.skill.range || 110;
    }
  }

  const pulse = 0.4 + Math.sin(game.t * 14) * 0.25;

  if (aoeRadius > 0) {
    ctx.save();
    ctx.fillStyle = `rgba(255, 40, 40, ${pulse * 0.18})`;
    ctx.beginPath();
    ctx.ellipse(x, y + 2, aoeRadius, aoeRadius * 0.32, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = `rgba(255, 60, 60, ${pulse + 0.3})`;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([10, 6]);
    ctx.beginPath();
    ctx.ellipse(x, y + 2, aoeRadius, aoeRadius * 0.32, 0, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  if (dirRange > 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(dirAngle);
    ctx.fillStyle = `rgba(255, 60, 60, ${pulse * 0.22})`;
    ctx.fillRect(0, -14, dirRange, 28);
    ctx.strokeStyle = `rgba(255, 60, 60, ${pulse + 0.3})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 4]);
    ctx.strokeRect(0, -14, dirRange, 28);
    ctx.setLineDash([]);
    ctx.fillStyle = `rgba(255, 80, 80, ${pulse + 0.4})`;
    ctx.beginPath();
    ctx.moveTo(dirRange, -18);
    ctx.lineTo(dirRange + 16, 0);
    ctx.lineTo(dirRange, 18);
    ctx.fill();
    ctx.restore();
  }
}

function drawEnemy(e) {
  const x = sX(e.x), y = e.y;
  const bob = Math.sin(e.bobble) * (e.type.flying ? 7 : 2);
  const dying = e.dead;
  const alpha = dying ? Math.max(0, e.deathTimer / (e.isBoss ? 1.2 : 0.4)) : (e.type.ghostly ? 0.75 : 1);

  // Attack telegraph (drawn first, on the ground, before other auras)
  if (!dying) drawAttackTelegraph(e, x, y);

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
  ctx.textAlign = 'center';
  for (const dn of game.damageNums) {
    const a = clamp(dn.life / dn.maxLife, 0, 1);
    const size = dn.crit ? 26 : (dn.big ? 21 : 16);
    ctx.font = `bold ${size}px sans-serif`;
    ctx.globalAlpha = a;
    // Outline glow for crit
    if (dn.crit) {
      ctx.fillStyle = 'rgba(255, 200, 60, 0.4)';
      ctx.fillText(dn.text, sX(dn.x), dn.y - 2);
      ctx.fillStyle = 'rgba(255, 200, 60, 0.4)';
      ctx.fillText(dn.text, sX(dn.x), dn.y + 2);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
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
  // Light radius pulses gently and flashes brighter on attack/combo
  const flicker = 1 + Math.sin(game.t * 6) * 0.05;
  const attackPulse = p.attackTimer > 0 ? 1.25 : 1;
  const comboBoost = 1 + Math.min(0.4, game.combo * 0.015);
  const innerR = 110 * flicker * attackPulse * comboBoost;
  const outerR = Math.max(W, H) * 0.85;

  // Biome-tinted vignette (instead of pure black — keeps world visible AND atmospheric)
  const biome = getBiome();
  const vignetteColor = biome.id === 'crypts' ? '6, 16, 10'
    : biome.id === 'caves' ? '6, 10, 18'
    : biome.id === 'library' ? '10, 6, 18'
    : biome.id === 'forge' ? '20, 6, 4'
    : '6, 6, 12';
  const grad = ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR);
  grad.addColorStop(0, `rgba(${vignetteColor}, 0)`);
  grad.addColorStop(0.45, `rgba(${vignetteColor}, 0.18)`);
  grad.addColorStop(1, `rgba(${vignetteColor}, 0.55)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Biome ambient mood wash (subtle tint over the whole screen — gives each world a "color of the soul")
  const moodColor = biome.id === 'crypts' ? '40, 120, 70'
    : biome.id === 'caves' ? '60, 100, 160'
    : biome.id === 'library' ? '120, 60, 160'
    : biome.id === 'forge' ? '200, 70, 20'
    : '120, 60, 40';
  ctx.fillStyle = `rgba(${moodColor}, 0.05)`;
  ctx.fillRect(0, 0, W, H);

  // Biome-tinted warm aura around player (closer halo)
  const auraColor = biome.id === 'crypts' ? '120, 220, 140'
    : biome.id === 'caves' ? '120, 180, 240'
    : biome.id === 'library' ? '180, 120, 220'
    : biome.id === 'forge' ? '255, 90, 30'
    : '255, 100, 50';
  const auraR = 260 * flicker * attackPulse;
  const warm = ctx.createRadialGradient(cx, cy, 20, cx, cy, auraR);
  warm.addColorStop(0, `rgba(${auraColor}, ${0.18 * attackPulse})`);
  warm.addColorStop(1, `rgba(${auraColor}, 0)`);
  ctx.fillStyle = warm;
  ctx.fillRect(0, 0, W, H);

  // Crit/kill flash (white) — driven by flashFx
  if (game.flashFx > 0) {
    ctx.fillStyle = `rgba(255, 240, 200, ${Math.min(0.35, game.flashFx)})`;
    ctx.fillRect(0, 0, W, H);
  }

  // Boss approach warning (red edge pulse)
  if (game.bossWarning > 0.05 && !game.bossActive) {
    const pulse = (Math.sin(game.t * 5) * 0.5 + 0.5);
    const edge = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.7);
    edge.addColorStop(0, 'rgba(180, 0, 0, 0)');
    edge.addColorStop(1, `rgba(220, 20, 20, ${0.18 * game.bossWarning * pulse + 0.06 * game.bossWarning})`);
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, W, H);
  }
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
  game.props = [];
  game.lastPropX = 0;
  game.atmoParticles = [];
  game.creatures = [];
  game.foreground = [];
  game.worldEvent = null;
  game.worldEventCooldown = 4;
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
  game.combo = 0;
  game.comboTimer = 0;
  game.comboBest = 0;
  game.hitstop = 0;
  game.flashFx = 0;
  game.bossWarning = 0;
  game.bossWarned = false;
  game.chestSpawnedAt = 0;
  game.chest = null;
  if (comboHud) comboHud.classList.remove('visible', 'hot', 'fire');
  if (bossWarningEl) bossWarningEl.classList.remove('visible');
  if (lowHpVignette) lowHpVignette.classList.remove('visible');
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
  stageEl.textContent = 'Étage 1 · Donjon';
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
