import React, { useRef, useEffect, useState, useCallback } from 'react';

// --- Custom Inline SVG Icons (Replacing lucide-react dependency) ---

const Icon = ({ children, className = "w-6 h-6", fill = "none" }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill={fill}
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {children}
  </svg>
);

const Trophy = (props) => (
  <Icon {...props}>
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>
    <path d="M4 22h16"></path>
    <path d="M10 14l2-2 2 2"></path>
    <path d="M12 14v8"></path>
    <path d="M4 9h16a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2z"></path>
    <path d="M12 18v-6"></path>
    <path d="M10 18h4"></path>
  </Icon>
);

const Heart = (props) => (
  <Icon {...props} fill="currentColor">
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"></path>
  </Icon>
);

const RefreshCw = (props) => (
  <Icon {...props}>
    <path d="M3 2v6h6"></path>
    <path d="M21 22v-6h-6"></path>
    <path d="M21 16a9 9 0 0 0-18 0"></path>
    <path d="M3 8a9 9 0 0 1 18 0"></path>
  </Icon>
);

const Play = (props) => (
  <Icon {...props} fill="currentColor">
    <polygon points="5 3 19 12 5 21 5 3"></polygon>
  </Icon>
);

const Square = (props) => (
  <Icon {...props}>
    <rect width="18" height="18" x="3" y="3" rx="2"></rect>
  </Icon>
);

const Rocket = (props) => (
  <Icon {...props}>
    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.75-.75 1.33-1.66 1.66-2.52M10 10l-4 4"></path>
    <path d="M19 3l10 10 3-3 10-10-3-3 10-10 3 3-10 10z"></path>
    <path d="m19 12-4-4"></path>
    <path d="m20 17 3 3"></path>
    <path d="m16 21 3 3"></path>
    <path d="M21 16v5a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2v-5"></path>
    <path d="M21 16a2 2 0 0 0-2-2H3a2 2 0 0 0-2 2"></path>
  </Icon>
);
// --------------------------------------------------------------------

// Game Constants
const STAR_LAYERS = [
  { count: 150, speedFactor: 0.5, color: '#444466', size: 1.0 },
  { count: 100, speedFactor: 1.0, color: '#8888AA', size: 1.5 },
  { count: 50, color: '#FFFFFF', size: 2.5 }
];
const BULLET_COLORS = ['#ff00ff', '#00ffff', '#ffff00', '#ff8800', '#00ff88'];
const POWERUP_TYPES = {
  SHIELD: 'SHIELD',
  TRIPLE_SHOT: 'TRIPLE_SHOT'
};
const TRIPLE_SHOT_DURATION = 300; // 5 seconds at 60 FPS
const MAX_LIVES = 5; // Maximum Life Cap

export default function App() {
  const canvasRef = useRef(null);
  const requestRef = useRef();
  const audioCtxRef = useRef(null);

  // React State for UI
  const [gameState, setGameState] = useState('START'); // START, PLAYING, GAMEOVER
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [highScore, setHighScore] = useState(0);
  const [userName, setUserName] = useState('');
  const [nameError, setNameError] = useState(false);
  const [tripleShotTimerDisplay, setTripleShotTimerDisplay] = useState(0);

  // Mutable Game State (for high-performance loop)
  const gameRef = useRef({
    player: {
      x: 0,
      y: 0,
      width: 40,
      height: 40,
      speed: 7,
      lastShot: 0,
      invincible: false,
      invincibleTimer: 0,
      isTripleShot: false,
      tripleShotTimer: 0,
    },
    keys: { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false, w: false, s: false, a: false, d: false, " ": false },
    touch: { active: false, x: 0, y: 0 },
    bullets: [],
    enemies: [],
    particles: [],
    powerups: [],
    stars: [],
    frameCount: 0,
    score: 0,
    lives: 3,
    lastTime: 0
  });

  // Collision Helper Function (Circle vs AABB Rectangle)
  const checkCircleRectCollision = (circle, rect) => {
    const closestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.width));
    const closestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.height));

    const distX = circle.x - closestX;
    const distY = circle.y - closestY;

    return (distX * distX) + (distY * distY) < (circle.radius * circle.radius);
  };

  // Initialize Audio System
  const initAudio = () => {
    if (!audioCtxRef.current) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioCtxRef.current = new AudioContext();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  };

  const playTone = (freq, type, duration, vol = 0.1) => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  };

  const playSound = (type) => {
    switch (type) {
      case 'shoot': playTone(880, 'square', 0.1, 0.05); break;
      case 'explosion': playTone(100, 'sawtooth', 0.3, 0.1); break;
      case 'hit': playTone(200, 'square', 0.1, 0.05); break;
      case 'powerup_collect_life': playTone(1200, 'sine', 0.1, 0.1); break;
      case 'powerup_collect_weapon':
        playTone(500, 'sawtooth', 0.05, 0.1);
        playTone(1000, 'sawtooth', 0.05, 0.1);
        break;
    }
  };

  // Central function to end the game
  const endGame = () => {
    if (gameRef.current.score > highScore) {
      setHighScore(gameRef.current.score);
    }

    // Reset inputs
    gameRef.current.keys = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false, w: false, s: false, a: false, d: false, " ": false };
    gameRef.current.touch.active = false;

    // Reset powerup state
    gameRef.current.player.isTripleShot = false;
    gameRef.current.player.tripleShotTimer = 0;
    setTripleShotTimerDisplay(0);

    setGameState('GAMEOVER');
  };

  // Game Logic Methods
  const createParticles = (x, y, color, count) => {
    for (let i = 0; i < count; i++) {
      gameRef.current.particles.push({
        x, y, color,
        size: Math.random() * 3 + 1,
        speedX: (Math.random() - 0.5) * 6,
        speedY: (Math.random() - 0.5) * 6,
        life: 100
      });
    }
  };

  const spawnEnemies = (canvas) => {
    const state = gameRef.current;
    // Tweak: Lowered initial spawn rate threshold to 30 for faster initial enemy appearance
    const spawnRate = Math.max(30, 60 - Math.floor(state.score / 500));

    if (state.frameCount % spawnRate === 0) {
      const diff = 1 + (state.score / 2000);
      const width = 30;
      state.enemies.push({
        x: Math.random() * (canvas.width - width),
        y: -50,
        width: width,
        height: 30,
        speedY: Math.random() * 2 + 1 + (diff * 0.2),
        speedX: (Math.random() - 0.5) * 2,
        color: Math.random() > 0.8 ? '#fb7185' : '#f472b6',
        type: Math.random() > 0.8 ? 'chaser' : 'diver',
        angle: 0
      });
    }
  };

  /**
   * Draws a highly stylized, 3D-looking spaceship using 2D Canvas methods.
   */
  const drawPlayer = (ctx, p) => {
    // Blink effect for invincibility
    if (p.invincible && Math.floor(Date.now() / 100) % 2 !== 0) return;

    const w = p.width;
    const h = p.height;
    const frameCount = gameRef.current.frameCount;

    ctx.save();
    ctx.translate(p.x + w / 2, p.y + h / 2);

    // --- 1. Dual Engine Exhaust/Flame (High Energy Pulse) ---
    const pulse = 1 + Math.sin(frameCount * 0.3) * 0.5;
    const flameLength = 25 + (pulse * 10);
    const engineOffset = w * 0.1;

    const drawExhaust = (xOffset) => {
      const gradient = ctx.createRadialGradient(xOffset, h * 0.6, 0, xOffset, h * 0.6, w * 0.15);
      gradient.addColorStop(0, `rgba(150, 255, 255, 0.9)`);
      gradient.addColorStop(0.5, `rgba(56, 189, 248, 0.7)`);
      gradient.addColorStop(1, `rgba(0, 0, 0, 0)`);

      ctx.beginPath();
      ctx.moveTo(xOffset - w * 0.1, h * 0.7);
      ctx.lineTo(xOffset, h * 0.7 + flameLength);
      ctx.lineTo(xOffset + w * 0.1, h * 0.7);
      ctx.closePath();

      ctx.fillStyle = gradient;
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 15;
      ctx.fill();
    };

    drawExhaust(engineOffset);
    drawExhaust(-engineOffset);
    ctx.shadowBlur = 0;

    // --- 2. Main Body (Dark, Stealthy Shape with Aggressive Sweep) ---
    const hullGradient = ctx.createLinearGradient(-w * 0.5, -h * 0.8, w * 0.5, h * 0.7);
    hullGradient.addColorStop(0, '#5b21b6');
    hullGradient.addColorStop(0.3, '#3730a3');
    hullGradient.addColorStop(1, '#1e1b4b');

    ctx.beginPath();
    ctx.moveTo(0, -h * 0.9);
    ctx.lineTo(w * 0.3, -h * 0.4);
    ctx.lineTo(w * 0.7, h * 0.4);
    ctx.lineTo(w * 0.3, h * 0.7);
    ctx.lineTo(w * 0.15, h * 0.75);
    ctx.lineTo(-w * 0.15, h * 0.75);
    ctx.lineTo(-w * 0.3, h * 0.7);
    ctx.lineTo(-w * 0.7, h * 0.4);
    ctx.lineTo(-w * 0.3, -h * 0.4);
    ctx.closePath();

    ctx.fillStyle = hullGradient;
    ctx.shadowColor = '#8b5cf6';
    ctx.shadowBlur = 8;
    ctx.fill();

    // --- 3. Cockpit and Weapon Details ---
    ctx.shadowBlur = 0;

    // Cockpit Canopy
    ctx.fillStyle = "#a5f3fc";
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.7);
    ctx.lineTo(w * 0.15, -h * 0.3);
    ctx.lineTo(-w * 0.15, -h * 0.3);
    ctx.closePath();
    ctx.fill();

    // Weapon Cannons
    const cannonLength = 8;
    const cannonWidth = 3;
    const cannonY = h * 0.5;

    ctx.fillStyle = p.isTripleShot ? "#facc15" : "#ec4899"; // Change color when powered up
    // Right Cannon 
    ctx.fillRect(engineOffset + w * 0.1 - cannonWidth / 2, cannonY, cannonWidth, cannonLength);
    // Left Cannon
    ctx.fillRect(-engineOffset - w * 0.1 - cannonWidth / 2, cannonY, cannonWidth, cannonLength);

    // Front Sensor/Detail
    ctx.fillStyle = "#facc15";
    ctx.beginPath();
    ctx.arc(0, -h * 0.8, 2, 0, Math.PI * 2);
    ctx.fill();


    ctx.restore();
  };

  /**
   * Draws a Power-Up entity, which is a rotating square.
   */
  const drawPowerup = (ctx, pu) => {
    ctx.save();
    ctx.translate(pu.x, pu.y);
    pu.angle += 0.05; // Rotation speed
    ctx.rotate(pu.angle);

    let color;
    if (pu.type === POWERUP_TYPES.SHIELD) {
      color = '#10b981'; // Emerald Green (for life)
    } else if (pu.type === POWERUP_TYPES.TRIPLE_SHOT) {
      color = '#f97316'; // Orange (for triple shot)
    }

    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;

    // Draw a rotating square background
    ctx.fillRect(-pu.width / 2, -pu.height / 2, pu.width, pu.height);

    // Draw internal icon
    ctx.fillStyle = '#fff';
    ctx.shadowBlur = 0;
    if (pu.type === POWERUP_TYPES.SHIELD) {
      // Draw + shape (Life)
      ctx.fillRect(-2, -8, 4, 16);
      ctx.fillRect(-8, -2, 16, 4);
    } else if (pu.type === POWERUP_TYPES.TRIPLE_SHOT) {
      // Draw three parallel lines
      ctx.fillRect(-7, -5, 14, 2);
      ctx.fillRect(-7, -1, 14, 2);
      ctx.fillRect(-7, 3, 14, 2);
    }

    ctx.restore();
  };

  const createBullet = (offsetX = 0) => {
    const p = gameRef.current.player;
    const randomColor = BULLET_COLORS[Math.floor(Math.random() * BULLET_COLORS.length)];
    // Change: Make circular plasma balls twice as likely to represent an upgrade
    const randomShape = Math.random() < 0.66 ? 'circle' : 'rect';

    let projectileProps = {
      y: p.y,
      speed: 10,
      color: randomColor,
      shape: randomShape,
    };

    if (randomShape === 'circle') {
      projectileProps.radius = 4 + Math.random() * 3;
      // Center X position for the circle's center
      projectileProps.x = p.x + p.width / 2 + offsetX;
    } else {
      projectileProps.width = 4 + Math.random() * 4;
      projectileProps.height = 10 + Math.random() * 10;
      // Center X position for the rectangle's top-left corner
      projectileProps.x = p.x + p.width / 2 - projectileProps.width / 2 + offsetX;
    }
    return projectileProps;
  };

  const updateGame = (canvas, ctx) => {
    const state = gameRef.current;
    const p = state.player;

    // Clear Canvas
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // --- Stars (Background Parallax) ---
    state.stars.forEach(star => {
      const speed = (gameState === 'PLAYING' ? 3 : 0.5) * star.speedFactor;
      star.y += speed;

      if (star.y > canvas.height) {
        star.y = 0;
        star.x = Math.random() * canvas.width;
      }

      ctx.fillStyle = star.color;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fill();
    });

    if (gameState !== 'PLAYING') return;

    // --- Player Movement ---
    const move = (key) => (state.keys[key] ? p.speed : 0);
    p.x += move('ArrowRight') - move('ArrowLeft') + move('d') - move('a');
    p.y += move('ArrowDown') - move('ArrowUp') + move('s') - move('w');

    // Touch Movement
    if (state.touch.active) {
      const targetX = state.touch.x - p.width / 2;
      const targetY = state.touch.y - p.height * 2;
      p.x += (targetX - p.x) * 0.2;
      p.y += (targetY - p.y) * 0.2;
    }

    // Safety Clamp:
    p.x = Math.max(0, Math.min(canvas.width - p.width, p.x));
    p.y = Math.max(0, Math.min(canvas.height - p.height, p.y));

    // --- Shooting ---
    if ((state.keys[" "] || state.touch.active) && state.frameCount - p.lastShot > 15) {

      if (p.isTripleShot) {
        // Fire three bullets
        state.bullets.push(createBullet(-15)); // Left
        state.bullets.push(createBullet(0));  // Center
        state.bullets.push(createBullet(15)); // Right
      } else {
        // Normal single shot
        state.bullets.push(createBullet(0));
      }

      p.lastShot = state.frameCount;
      playSound('shoot');
    }

    // --- Invincibility Timer ---
    if (p.invincible) {
      p.invincibleTimer--;
      if (p.invincibleTimer <= 0) p.invincible = false;
    }

    // --- Powerup Timer ---
    if (p.isTripleShot) {
      p.tripleShotTimer--;
      if (p.tripleShotTimer <= 0) {
        p.isTripleShot = false;
      }
    }
    // Sync powerup timer for display (only update React state if the value changes)
    const newDisplayTime = Math.ceil(p.tripleShotTimer / 60);
    if (newDisplayTime !== tripleShotTimerDisplay) {
      setTripleShotTimerDisplay(newDisplayTime);
    }

    // Draw Player
    drawPlayer(ctx, p);

    // --- Projectiles (Bullets) ---
    state.bullets = state.bullets.filter(b => b.y > -50);
    state.bullets.forEach(b => {
      b.y -= b.speed;
      ctx.fillStyle = b.color;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 10;

      if (b.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(b.x, b.y, b.width, b.height);
      }

      ctx.shadowBlur = 0;
    });

    // --- Enemies ---
    spawnEnemies(canvas);
    state.enemies = state.enemies.filter(e => e.y < canvas.height + 50);
    state.enemies.forEach((e) => {
      e.y += e.speedY;
      e.x += e.speedX;
      if (e.x <= 0 || e.x >= canvas.width - e.width) e.speedX *= -1;
      if (e.type === 'chaser') {
        if (e.x + e.width / 2 < p.x + p.width / 2) e.speedX += 0.05;
        else e.speedX -= 0.05;
      }

      const scaleFactor = 1 + (e.y / canvas.height) * 0.5;
      const currentWidth = e.width * scaleFactor;

      ctx.save();
      ctx.translate(e.x + e.width / 2, e.y + e.height / 2);
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.arc(0, 0, currentWidth / 2, 0, Math.PI * 2);
      ctx.shadowColor = e.color;
      ctx.shadowBlur = 15 * scaleFactor;
      ctx.fill();

      ctx.fillStyle = "#000";
      ctx.shadowBlur = 0;
      const eyeScale = currentWidth / 30 * 0.5;
      ctx.beginPath();
      ctx.arc(-6 * eyeScale, 2 * eyeScale, 3 * eyeScale, 0, Math.PI * 2);
      ctx.arc(6 * eyeScale, 2 * eyeScale, 3 * eyeScale, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // --- Powerups ---
    state.powerups = state.powerups.filter(pu => pu.y < canvas.height + 50);
    state.powerups.forEach(pu => {
      pu.y += 1.5; // Powerup speed
      drawPowerup(ctx, pu);
    });

    // --- Particles ---
    state.particles = state.particles.filter(p => p.life > 0);
    state.particles.forEach(pt => {
      pt.x += pt.speedX;
      pt.y += pt.speedY;
      pt.life -= 2;
      pt.size *= 0.95;
      ctx.globalAlpha = pt.life / 100;
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    // --- Collisions ---

    // 1. Projectile vs Enemy
    state.bullets.forEach((b, bi) => {
      state.enemies.forEach((e, ei) => {
        let isHit = false;

        if (b.shape === 'circle') {
          isHit = checkCircleRectCollision(
            { x: b.x, y: b.y, radius: b.radius },
            { x: e.x, y: e.y, width: e.width, height: e.height }
          );
        } else {
          isHit = (
            b.x < e.x + e.width && b.x + b.width > e.x &&
            b.y < e.y + e.height && b.y + e.height > e.y
          );
        }

        if (isHit) {
          state.bullets.splice(bi, 1);
          state.enemies.splice(ei, 1);
          state.score += 100;
          setScore(state.score);
          playSound('hit');
          createParticles(e.x + e.width / 2, e.y + e.height / 2, e.color, 10);

          // --- POWERUP SPAWN LOGIC ---
          if (Math.random() < 0.25) { // 25% chance to drop a power-up
            const type = Math.random() < 0.5 ? POWERUP_TYPES.SHIELD : POWERUP_TYPES.TRIPLE_SHOT;
            state.powerups.push({
              x: e.x + e.width / 2,
              y: e.y + e.height / 2,
              width: 20,
              height: 20,
              type: type,
              angle: 0,
            });
          }
          // --- END POWERUP SPAWN LOGIC ---
        }
      });
    });

    // 2. Player vs Powerup
    state.powerups.forEach((pu, pui) => {
      // AABB collision check (Player is p)
      if (
        p.x < pu.x + pu.width / 2 && p.x + p.width > pu.x - pu.width / 2 &&
        p.y < pu.y + pu.height / 2 && p.y + p.height > pu.y - pu.height / 2
      ) {
        // Powerup collected
        state.powerups.splice(pui, 1);

        switch (pu.type) {
          case POWERUP_TYPES.SHIELD:
            // FIX: Allow lives to increase up to MAX_LIVES (5)
            state.lives = Math.min(MAX_LIVES, state.lives + 1);
            setLives(state.lives);
            playSound('powerup_collect_life');
            break;
          case POWERUP_TYPES.TRIPLE_SHOT:
            p.isTripleShot = true;
            p.tripleShotTimer = TRIPLE_SHOT_DURATION;
            playSound('powerup_collect_weapon');
            break;
        }
      }
    });

    // 3. Enemy vs Player
    state.enemies.forEach((e, ei) => {
      const padding = 5;
      if (
        !p.invincible &&
        p.x + padding < e.x + e.width &&
        p.x + p.width - padding > e.x &&
        p.y + padding < e.y + e.height &&
        p.y + p.height - padding > e.y
      ) {
        state.enemies.splice(ei, 1);
        createParticles(e.x + e.width / 2, e.y + e.height / 2, e.color, 10);
        state.lives--;
        setLives(state.lives);
        playSound('explosion');

        if (state.lives <= 0) {
          endGame();
        } else {
          p.invincible = true;
          p.invincibleTimer = 120;
          p.x = canvas.width / 2 - p.width / 2;
          p.y = canvas.height - 100;
          state.touch.active = false;
        }
      }
    });

    // --- Cockpit Overlay (Grounding the 3D Perspective) ---
    const cockpitHeight = Math.min(120, canvas.height * 0.15);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
    ctx.fillRect(0, canvas.height - cockpitHeight, canvas.width, cockpitHeight);

    // Add a simple grid/line effect
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
    ctx.lineWidth = 2;
    // Central line
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, canvas.height - cockpitHeight);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();
    // Horizontal line
    ctx.beginPath();
    ctx.moveTo(0, canvas.height - cockpitHeight);
    ctx.lineTo(canvas.width, canvas.height - cockpitHeight);
    ctx.stroke();

    state.frameCount++;
  };

  // Main Loop
  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      // If canvas is null, try again on the next frame
      requestRef.current = requestAnimationFrame(animate);
      return;
    }
    const ctx = canvas.getContext('2d');

    updateGame(canvas, ctx);
    requestRef.current = requestAnimationFrame(animate);
  }, [tripleShotTimerDisplay, gameState]); // Added gameState dependency for robustness

  // Setup & Cleanup
  useEffect(() => {

    // Init Stars and Player Position once
    const canvas = canvasRef.current;
    if (canvas) {
      // Initialize Player position
      gameRef.current.player.x = canvas.width / 2 - gameRef.current.player.width / 2;
      gameRef.current.player.y = canvas.height - 100;

      // Init Stars (only if not already created)
      if (gameRef.current.stars.length === 0) {
        STAR_LAYERS.forEach(layer => {
          for (let i = 0; i < layer.count; i++) {
            gameRef.current.stars.push({
              x: Math.random() * canvas.width,
              y: Math.random() * canvas.height,
              size: Math.random() * layer.size + 0.5,
              color: layer.color,
              speedFactor: layer.speedFactor,
              alpha: Math.random()
            });
          }
        });
      }
    }

    // Start animation loop
    requestRef.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(requestRef.current);
  }, [animate]);

  // Handle Resize - Separated for clean initialization and updates
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
        // Keep player centered horizontally on resize
        gameRef.current.player.x = window.innerWidth / 2 - gameRef.current.player.width / 2;
        // Keep player vertically fixed near the bottom
        gameRef.current.player.y = window.innerHeight - 100;
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize(); // Initial call to set size and position
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle Inputs
  useEffect(() => {
    const handleKeyDown = (e) => { gameRef.current.keys[e.key] = true; };
    const handleKeyUp = (e) => { gameRef.current.keys[e.key] = false; };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const handleTouchStart = (e) => {
    e.preventDefault();
    gameRef.current.touch.active = true;
    gameRef.current.touch.x = e.touches[0].clientX;
    gameRef.current.touch.y = e.touches[0].clientY;
  };

  const handleTouchMove = (e) => {
    e.preventDefault();
    gameRef.current.touch.x = e.touches[0].clientX;
    gameRef.current.touch.y = e.touches[0].clientY;
  };

  const handleTouchEnd = (e) => {
    e.preventDefault();
    gameRef.current.touch.active = false;
  };

  // Game Control Functions
  const startGame = () => {
    if (!userName.trim()) {
      setNameError(true);
      return;
    }
    setNameError(false);
    initAudio();

    // Reset Game State
    gameRef.current.score = 0;
    gameRef.current.lives = 3;
    gameRef.current.enemies = [];
    gameRef.current.bullets = [];
    gameRef.current.particles = [];
    gameRef.current.powerups = []; // Reset powerups

    // Recalculate player start position in case of recent resize
    const canvas = canvasRef.current;
    if (canvas) {
      gameRef.current.player.x = canvas.width / 2 - gameRef.current.player.width / 2;
      gameRef.current.player.y = canvas.height - 100;
    }

    gameRef.current.player.invincible = false;
    gameRef.current.player.isTripleShot = false; // Reset powerup effects
    gameRef.current.player.tripleShotTimer = 0;

    setScore(0);
    setLives(3);
    setTripleShotTimerDisplay(0);
    setGameState('PLAYING');
  };

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden bg-slate-900 font-mono select-none touch-none">

      {/* Canvas Layer */}
      <canvas
        ref={canvasRef}
        className="block w-full h-full"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />

      {/* HUD Layer */}
      <div className="absolute top-0 left-0 w-full p-4 pointer-events-none z-10">

        {/* PILOT NAME (CENTERED) */}
        {gameState === 'PLAYING' && userName && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none">
            <span className="inline-block text-xl font-black text-sky-200 tracking-widest bg-slate-800/50 backdrop-blur-sm px-4 py-1 rounded-full border border-sky-500/50 shadow-xl drop-shadow-[0_0_10px_rgba(56,189,248,0.5)]">
              PILOT: {userName.toUpperCase()}
            </span>
          </div>
        )}

        {/* Score, Stop Button, Lives & Powerup Status */}
        <div className="max-w-4xl mx-auto flex justify-between items-start">

          {/* Left HUD: Stop button, Score, High Score */}
          <div className="flex flex-col gap-1 items-start text-sky-400 pointer-events-auto mt-4">
            {/* Stop/Pause Button (only visible during PLAYING) */}
            {gameState === 'PLAYING' && (
              <button
                onClick={endGame}
                className="p-2 rounded-full bg-rose-600/50 hover:bg-rose-500/80 text-white backdrop-blur-sm transition-all shadow-xl mb-2"
              >
                <Square className="w-5 h-5" />
              </button>
            )}
            <div className="flex items-center gap-2">
              <Trophy className="w-6 h-6" />
              <span className="text-2xl font-bold tracking-widest">{score}</span>
            </div>
            <span className="text-xs text-slate-400 ml-8">HI: {highScore}</span>
          </div>

          {/* Right HUD: Lives and Powerup Status */}
          <div className="flex flex-col items-end gap-2 mt-4 pointer-events-none">
            {/* Lives */}
            <div className="flex items-center gap-2 text-rose-400">
              <Heart className="w-6 h-6 fill-current" />
              <span className="text-2xl font-bold tracking-widest">x {lives}</span>
            </div>

            {/* Powerup Status: Triple Shot Timer */}
            {tripleShotTimerDisplay > 0 && (
              <div className="flex items-center gap-2 px-3 py-1 bg-fuchsia-800/70 backdrop-blur-sm rounded-full border border-fuchsia-600 text-white shadow-xl animate-pulse">
                <Rocket className="w-4 h-4" />
                <span className="text-sm font-semibold">TRIPLE SHOT</span>
                <span className="text-sm font-black text-yellow-300 ml-1">
                  {tripleShotTimerDisplay}s
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Start Screen */}
      {gameState === 'START' && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/90 backdrop-blur-sm px-4">
          <div className="text-center mb-8 animate-pulse">

            <Rocket className="w-20 h-20 text-sky-400 mx-auto mb-4 drop-shadow-[0_0_10px_rgba(56,189,248,0.5)]" />

            <h1 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-sky-300 to-sky-600 mb-2 drop-shadow-[0_0_15px_rgba(56,189,248,0.5)]">
              COSMIC<br />DEFENDER
            </h1>
            <p className="text-slate-400 text-lg">Defend the sector.</p>
          </div>

          <div className="space-y-6 text-center w-full max-w-sm">

            {/* Name Input */}
            <div>
              <input
                type="text"
                placeholder="Enter your pilot name"
                value={userName}
                onChange={(e) => {
                  setUserName(e.target.value);
                  setNameError(false);
                }}
                className={`w-full p-3 rounded-lg bg-slate-800 text-white placeholder-slate-500 border-2 ${nameError ? 'border-rose-500' : 'border-sky-500'} focus:ring-2 focus:ring-sky-300 focus:outline-none transition`}
                maxLength={15}
              />
              {nameError && (
                <p className="text-rose-400 text-sm mt-1">Pilot name is required for launch!</p>
              )}
            </div>

            <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
              <p className="text-sky-200 text-sm md:text-base font-bold mb-2">MISSION CONTROLS</p>
              <div className="grid grid-cols-2 gap-4 text-slate-400 text-xs md:text-sm">
                <div>
                  <span className="block text-white font-bold">DESKTOP</span>
                  ARROWS / WASD to Move<br />SPACE to Shoot
                </div>
                <div>
                  <span className="block text-white font-bold">MOBILE</span>
                  Touch & Drag to Pilot<br />Auto-Fire Active
                </div>
              </div>
            </div>

            <button
              onClick={startGame}
              className="group relative px-8 py-4 bg-sky-500 hover:bg-sky-400 text-white font-black text-xl rounded-full transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(56,189,248,0.5)] pointer-events-auto"
            >
              <span className="flex items-center gap-3">
                LAUNCH MISSION <Play className="w-5 h-5 fill-current" />
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Game Over Screen */}
      {gameState === 'GAMEOVER' && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/90 backdrop-blur-sm">
          <h2 className="text-6xl md:text-8xl font-black text-rose-500 mb-2 drop-shadow-[0_0_25px_rgba(244,63,94,0.6)]">
            MISSION ENDED
          </h2>

          <div className="text-center mb-8">
            <div className="text-xl font-bold text-sky-400 mb-2">Pilot: {userName || 'Unknown Pilot'}</div>
            <div className="text-slate-400 text-xl mb-2">FINAL SCORE</div>
            <div className="text-5xl font-bold text-white mb-6">{score}</div>
          </div>

          <button
            onClick={startGame}
            className="px-8 py-4 bg-white hover:bg-slate-200 text-slate-900 font-black text-xl rounded-full transition-all hover:scale-105 active:scale-95 shadow-lg flex items-center gap-3 pointer-events-auto"
          >
            <RefreshCw className="w-6 h-6" /> RETRY MISSION
          </button>
        </div>
      )}

      {/* Footer Attribution */}
      <div className="absolute bottom-4 left-0 w-full text-center z-50">
        <p className="text-xs text-slate-500">
          Built by Weizer. Visit{' '}
          <a
            href="https://dev.kibi.my"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sky-400 hover:text-sky-300 transition-colors pointer-events-auto font-semibold"
          >
            dev.kibi.my
          </a>
        </p>
      </div>
    </div>
  );
}