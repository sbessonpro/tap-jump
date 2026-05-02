(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const overlay = document.getElementById('overlay');
  const startBtn = document.getElementById('start-btn');
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');

  let W = 0, H = 0, GROUND_Y = 0;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    GROUND_Y = H * 0.82;
  }
  window.addEventListener('resize', resize);
  resize();

  const player = {
    x: 0, y: 0, w: 44, h: 56,
    vy: 0, onGround: true,
  };
  const GRAVITY = 2200;
  const JUMP_V = -880;

  let obstacles = [];
  let particles = [];
  let speed = 360;
  let spawnTimer = 0;
  let spawnInterval = 1.4;
  let score = 0;
  let best = parseInt(localStorage.getItem('tapjump-best') || '0', 10);
  let running = false;
  let lastT = 0;

  bestEl.textContent = 'Record : ' + best;

  function reset() {
    player.x = W * 0.18;
    player.y = GROUND_Y - player.h;
    player.vy = 0;
    player.onGround = true;
    obstacles = [];
    particles = [];
    speed = 360;
    spawnTimer = 0;
    spawnInterval = 1.4;
    score = 0;
    scoreEl.textContent = '0';
  }

  function jump() {
    if (!running) return;
    if (player.onGround) {
      player.vy = JUMP_V;
      player.onGround = false;
      for (let i = 0; i < 8; i++) {
        particles.push({
          x: player.x + player.w / 2,
          y: player.y + player.h,
          vx: (Math.random() - 0.5) * 200,
          vy: Math.random() * 100,
          life: 0.4,
          maxLife: 0.4,
        });
      }
    }
  }

  function spawnObstacle() {
    const tall = Math.random() < 0.35;
    const w = 24 + Math.random() * 14;
    const h = tall ? 70 + Math.random() * 30 : 40 + Math.random() * 20;
    obstacles.push({
      x: W + 20,
      y: GROUND_Y - h,
      w, h,
      hue: 350 + Math.random() * 30,
    });
  }

  function gameOver() {
    running = false;
    if (score > best) {
      best = score;
      localStorage.setItem('tapjump-best', String(best));
    }
    bestEl.textContent = 'Record : ' + best;
    overlay.querySelector('h1').textContent = 'Game Over';
    overlay.querySelector('p').textContent = 'Score : ' + score;
    startBtn.textContent = 'Rejouer';
    overlay.classList.add('visible');
  }

  function start() {
    overlay.classList.remove('visible');
    reset();
    running = true;
    lastT = performance.now();
    requestAnimationFrame(loop);
  }

  function update(dt) {
    speed += dt * 6;
    spawnTimer += dt;
    const interval = Math.max(0.7, spawnInterval - speed * 0.0008);
    if (spawnTimer >= interval) {
      spawnTimer = 0;
      spawnObstacle();
    }

    player.vy += GRAVITY * dt;
    player.y += player.vy * dt;
    if (player.y + player.h >= GROUND_Y) {
      player.y = GROUND_Y - player.h;
      player.vy = 0;
      player.onGround = true;
    }

    for (const o of obstacles) o.x -= speed * dt;
    obstacles = obstacles.filter(o => o.x + o.w > -10);

    for (const o of obstacles) {
      if (
        player.x < o.x + o.w &&
        player.x + player.w > o.x &&
        player.y < o.y + o.h &&
        player.y + player.h > o.y
      ) {
        gameOver();
        return;
      }
    }

    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 400 * dt;
      p.life -= dt;
    }
    particles = particles.filter(p => p.life > 0);

    score += Math.floor(dt * 60);
    scoreEl.textContent = score;
  }

  let bgOffset = 0;
  function drawBackground(dt) {
    bgOffset = (bgOffset + speed * dt * 0.3) % 80;
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    for (let i = -1; i < W / 80 + 1; i++) {
      const x = i * 80 - bgOffset;
      const y = GROUND_Y * 0.55 + Math.sin(i * 1.3) * 20;
      ctx.beginPath();
      ctx.arc(x + 40, y, 30, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawGround() {
    ctx.fillStyle = '#0a1929';
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
    ctx.strokeStyle = '#ffd86b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(W, GROUND_Y);
    ctx.stroke();
  }

  function drawPlayer() {
    const grad = ctx.createLinearGradient(player.x, player.y, player.x, player.y + player.h);
    grad.addColorStop(0, '#ffd86b');
    grad.addColorStop(1, '#ff9f43');
    ctx.fillStyle = grad;
    roundRect(player.x, player.y, player.w, player.h, 10);
    ctx.fill();
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(player.x + player.w - 14, player.y + 14, 6, 6);
  }

  function drawObstacles() {
    for (const o of obstacles) {
      const grad = ctx.createLinearGradient(o.x, o.y, o.x, o.y + o.h);
      grad.addColorStop(0, `hsl(${o.hue}, 80%, 65%)`);
      grad.addColorStop(1, `hsl(${o.hue}, 70%, 45%)`);
      ctx.fillStyle = grad;
      roundRect(o.x, o.y, o.w, o.h, 6);
      ctx.fill();
    }
  }

  function drawParticles() {
    for (const p of particles) {
      const a = p.life / p.maxLife;
      ctx.fillStyle = `rgba(255, 216, 107, ${a})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3 * a + 1, 0, Math.PI * 2);
      ctx.fill();
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

  function loop(t) {
    const dt = Math.min(0.033, (t - lastT) / 1000);
    lastT = t;

    ctx.clearRect(0, 0, W, H);
    drawBackground(dt);
    drawGround();

    if (running) update(dt);

    drawObstacles();
    drawParticles();
    drawPlayer();

    if (running) requestAnimationFrame(loop);
  }

  startBtn.addEventListener('click', start);
  window.addEventListener('keydown', e => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
      e.preventDefault();
      if (!running) start(); else jump();
    }
  });
  canvas.addEventListener('pointerdown', e => {
    e.preventDefault();
    jump();
  });

  reset();
  drawGround();
  drawPlayer();
})();
