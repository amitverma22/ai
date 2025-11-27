import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameState, Player, Obstacle, Missile, Star, Planet } from './types';
import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  PLAYER_SPEED_X,
  PLAYER_BASE_WIDTH,
  PLAYER_BASE_HEIGHT,
  MAX_TILT,
  TILT_SPEED,
  MISSILE_SPEED,
  MISSILE_WIDTH,
  MISSILE_HEIGHT,
  MISSILE_COOLDOWN,
  OBSTACLE_BASE_SPEED,
  OBSTACLE_SPAWN_RATE,
  OBSTACLE_MIN_SIZE,
  OBSTACLE_MAX_SIZE,
  COLORS,
  BASE_SCROLL_SPEED,
  MIN_SPEED_MULTIPLIER,
  MAX_SPEED_MULTIPLIER,
} from './constants';

const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [score, setScore] = useState(0);
  
  // Game State Refs (Mutable for performance loop)
  const playerRef = useRef<Player>({
    x: CANVAS_WIDTH / 2,
    y: CANVAS_HEIGHT - 100,
    width: PLAYER_BASE_WIDTH,
    height: PLAYER_BASE_HEIGHT,
    color: COLORS.PLAYER,
    vx: 0,
    vy: 0,
    tilt: 0,
    speedMultiplier: 1,
    cooldown: 0,
  });

  const obstaclesRef = useRef<Obstacle[]>([]);
  const missilesRef = useRef<Missile[]>([]);
  const starsRef = useRef<Star[]>([]);
  const planetsRef = useRef<Planet[]>([]);
  const keysPressed = useRef<Set<string>>(new Set());

  // --- Initialization Helpers ---

  const initStars = () => {
    const stars: Star[] = [];
    for (let i = 0; i < 100; i++) {
      stars.push({
        x: Math.random() * CANVAS_WIDTH,
        y: Math.random() * CANVAS_HEIGHT,
        size: Math.random() * 2 + 0.5,
        speed: Math.random() * 3 + 0.5,
        brightness: Math.random(),
      });
    }
    starsRef.current = stars;
  };

  const initPlanets = () => {
    // Just a couple of distant planets for ambience
    planetsRef.current = [
      {
        x: Math.random() * CANVAS_WIDTH,
        y: -100,
        radius: 40,
        color: '#ff6b6b',
        speed: 0.5,
        type: 'terrestrial',
      },
      {
        x: Math.random() * CANVAS_WIDTH,
        y: -500,
        radius: 80,
        color: '#ffd93d',
        speed: 0.2,
        type: 'gas',
      }
    ];
  };

  const resetGame = () => {
    playerRef.current = {
      x: CANVAS_WIDTH / 2,
      y: CANVAS_HEIGHT - 100,
      width: PLAYER_BASE_WIDTH,
      height: PLAYER_BASE_HEIGHT,
      color: COLORS.PLAYER,
      vx: 0,
      vy: 0,
      tilt: 0,
      speedMultiplier: 1,
      cooldown: 0,
    };
    obstaclesRef.current = [];
    missilesRef.current = [];
    setScore(0);
    initStars();
    initPlanets();
  };

  // --- Logic Helpers ---

  const spawnObstacle = (speedMult: number) => {
    const size = Math.random() * (OBSTACLE_MAX_SIZE - OBSTACLE_MIN_SIZE) + OBSTACLE_MIN_SIZE;
    const x = Math.random() * (CANVAS_WIDTH - size);
    
    // Create jagged vertices for asteroid look
    const vertices = [];
    const numPoints = 6 + Math.floor(Math.random() * 4);
    for (let i = 0; i < numPoints; i++) {
      const angle = (i / numPoints) * Math.PI * 2;
      const radiusVar = size / 2 * (0.8 + Math.random() * 0.4);
      vertices.push({
        x: Math.cos(angle) * radiusVar,
        y: Math.sin(angle) * radiusVar,
      });
    }

    obstaclesRef.current.push({
      id: Date.now() + Math.random(),
      x: x,
      y: -size - 100, // Spawn slightly offscreen
      width: size,
      height: size,
      vx: (Math.random() - 0.5) * 1, // Slight horizontal drift
      vy: OBSTACLE_BASE_SPEED + (speedMult * 2), // Speed depends on player speed
      color: COLORS.OBSTACLE_PRIMARY,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.1,
      vertices: vertices,
    });
  };

  // --- Main Game Loop ---

  const update = useCallback(() => {
    if (gameState !== GameState.PLAYING) return;

    const player = playerRef.current;
    
    // 1. Handle Input & Player Movement
    if (keysPressed.current.has('ArrowLeft')) {
      player.x -= PLAYER_SPEED_X;
      player.tilt = Math.max(player.tilt - TILT_SPEED, -MAX_TILT);
    } else if (keysPressed.current.has('ArrowRight')) {
      player.x += PLAYER_SPEED_X;
      player.tilt = Math.min(player.tilt + TILT_SPEED, MAX_TILT);
    } else {
      // Return tilt to 0
      if (player.tilt > 0) player.tilt = Math.max(0, player.tilt - TILT_SPEED);
      if (player.tilt < 0) player.tilt = Math.min(0, player.tilt + TILT_SPEED);
    }

    if (keysPressed.current.has('ArrowUp')) {
      player.speedMultiplier = Math.min(player.speedMultiplier + 0.05, MAX_SPEED_MULTIPLIER);
    } else if (keysPressed.current.has('ArrowDown')) {
      player.speedMultiplier = Math.max(player.speedMultiplier - 0.05, MIN_SPEED_MULTIPLIER);
    }

    // Clamp player to screen
    player.x = Math.max(player.width / 2, Math.min(CANVAS_WIDTH - player.width / 2, player.x));

    // Weapon Cooldown
    if (player.cooldown > 0) player.cooldown--;

    // Shoot
    if (keysPressed.current.has(' ') && player.cooldown <= 0) {
      missilesRef.current.push({
        id: Date.now(),
        x: player.x,
        y: player.y - player.height / 2,
        width: MISSILE_WIDTH,
        height: MISSILE_HEIGHT,
        color: COLORS.MISSILE,
        vx: 0,
        vy: -MISSILE_SPEED,
      });
      player.cooldown = MISSILE_COOLDOWN;
    }

    // 2. Update Background (Stars & Planets)
    starsRef.current.forEach(star => {
      star.y += star.speed * player.speedMultiplier;
      if (star.y > CANVAS_HEIGHT) {
        star.y = 0;
        star.x = Math.random() * CANVAS_WIDTH;
      }
    });

    planetsRef.current.forEach(planet => {
      planet.y += planet.speed * player.speedMultiplier;
      if (planet.y > CANVAS_HEIGHT + planet.radius + 200) {
        // Reset planet far above
        planet.y = -500 - Math.random() * 1000;
        planet.x = Math.random() * CANVAS_WIDTH;
      }
    });

    // 3. Update Missiles
    missilesRef.current.forEach(m => m.y += m.vy);
    // Remove off-screen missiles
    missilesRef.current = missilesRef.current.filter(m => m.y > -50);

    // 4. Update Obstacles & Spawning
    // Spawn chance increases slightly with score/difficulty (optional)
    if (Math.random() < OBSTACLE_SPAWN_RATE * player.speedMultiplier) {
      spawnObstacle(player.speedMultiplier);
    }

    obstaclesRef.current.forEach(obs => {
      obs.y += obs.vy; // Move down
      obs.x += obs.vx; // Drift
      obs.rotation += obs.rotationSpeed;
    });
    // Remove off-screen obstacles
    obstaclesRef.current = obstaclesRef.current.filter(obs => obs.y < CANVAS_HEIGHT + 100);

    // 5. Collision Detection

    // Missile vs Obstacle
    for (let i = missilesRef.current.length - 1; i >= 0; i--) {
      const missile = missilesRef.current[i];
      let missileHit = false;

      for (let j = obstaclesRef.current.length - 1; j >= 0; j--) {
        const obs = obstaclesRef.current[j];
        
        // Simple circle/box distance check
        const dx = missile.x - obs.x;
        const dy = missile.y - obs.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < (obs.width / 2) + (missile.width / 2)) {
          // Hit!
          obstaclesRef.current.splice(j, 1);
          missileHit = true;
          setScore(prev => prev + 10);
          break; // Missile destroys one obstacle
        }
      }
      if (missileHit) {
        missilesRef.current.splice(i, 1);
      }
    }

    // Player vs Obstacle
    for (const obs of obstaclesRef.current) {
        const dx = player.x - obs.x;
        const dy = player.y - obs.y;
        // Hitbox slightly smaller than visual size for fairness
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < (obs.width / 2) + (player.width / 3)) {
          setGameState(GameState.GAME_OVER);
        }
    }

  }, [gameState]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear Screen
    ctx.fillStyle = '#0b0d17'; // Deep space blue/black
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw Background Gradient Overlay for "Atmosphere" feel
    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    gradient.addColorStop(0, '#0b0d17');
    gradient.addColorStop(1, '#1a1f35');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw Planets
    planetsRef.current.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
      // Simple shading
      ctx.beginPath();
      ctx.arc(p.x - p.radius * 0.2, p.y - p.radius * 0.2, p.radius * 0.9, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fill();
    });

    // Draw Stars
    ctx.fillStyle = COLORS.STAR;
    starsRef.current.forEach(star => {
      ctx.globalAlpha = star.brightness;
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1.0;

    // Draw Missiles
    ctx.fillStyle = COLORS.MISSILE;
    missilesRef.current.forEach(m => {
      ctx.fillRect(m.x - m.width / 2, m.y, m.width, m.height);
      // Missile trail
      ctx.beginPath();
      ctx.moveTo(m.x, m.y + m.height);
      ctx.lineTo(m.x - 2, m.y + m.height + 5);
      ctx.lineTo(m.x + 2, m.y + m.height + 5);
      ctx.fillStyle = 'rgba(255, 100, 0, 0.7)';
      ctx.fill();
      ctx.fillStyle = COLORS.MISSILE; // Reset
    });

    // Draw Player
    const p = playerRef.current;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.tilt);

    // Jet Body (Triangle-ish)
    ctx.beginPath();
    ctx.moveTo(0, -p.height / 2);
    ctx.lineTo(p.width / 2, p.height / 2);
    ctx.lineTo(0, p.height / 2 - 10);
    ctx.lineTo(-p.width / 2, p.height / 2);
    ctx.closePath();
    ctx.fillStyle = COLORS.PLAYER;
    ctx.fill();
    
    // Cockpit
    ctx.beginPath();
    ctx.moveTo(0, -p.height / 4);
    ctx.lineTo(5, 0);
    ctx.lineTo(0, 10);
    ctx.lineTo(-5, 0);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    // Engine Flame
    ctx.beginPath();
    ctx.moveTo(-5, p.height / 2 - 5);
    ctx.lineTo(5, p.height / 2 - 5);
    // Flicker effect
    const flicker = Math.random() * 10 + (p.speedMultiplier * 10);
    ctx.lineTo(0, p.height / 2 + 10 + flicker);
    ctx.closePath();
    ctx.fillStyle = COLORS.PLAYER_ENGINE;
    ctx.fill();

    ctx.restore();

    // Draw Obstacles
    obstaclesRef.current.forEach(obs => {
      ctx.save();
      ctx.translate(obs.x, obs.y);
      ctx.rotate(obs.rotation);
      
      ctx.beginPath();
      if (obs.vertices.length > 0) {
        ctx.moveTo(obs.vertices[0].x, obs.vertices[0].y);
        for (let i = 1; i < obs.vertices.length; i++) {
          ctx.lineTo(obs.vertices[i].x, obs.vertices[i].y);
        }
      }
      ctx.closePath();
      
      // Gradient for rock look
      const rockGrad = ctx.createRadialGradient(0, 0, 5, 0, 0, obs.width/2);
      rockGrad.addColorStop(0, COLORS.OBSTACLE_HIGHLIGHT);
      rockGrad.addColorStop(1, COLORS.OBSTACLE_PRIMARY);
      ctx.fillStyle = rockGrad;
      ctx.fill();
      
      // Outline for definition
      ctx.strokeStyle = '#5d5347';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.restore();
    });

  }, []);

  const gameLoop = useCallback((time: number) => {
    update();
    draw();
    if (gameState === GameState.PLAYING) {
      requestRef.current = requestAnimationFrame(gameLoop);
    } else if (gameState === GameState.MENU || gameState === GameState.GAME_OVER) {
       // Keep drawing even if not updating physics, so we don't have a blank screen
       draw();
       // But don't request next frame aggressively if just static
       requestRef.current = requestAnimationFrame(gameLoop);
    }
  }, [gameState, update, draw]);

  // --- Effect Hooks ---

  useEffect(() => {
    requestRef.current = requestAnimationFrame(gameLoop);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [gameLoop]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressed.current.add(e.key);
      if (e.key === 'Enter' && gameState !== GameState.PLAYING) {
        setGameState(GameState.PLAYING);
        resetGame();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.key);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState]);

  // Initial Setup
  useEffect(() => {
    initStars();
    initPlanets();
    // Pre-render
    draw();
  }, [draw]);


  return (
    <div className="relative w-full h-screen bg-black flex items-center justify-center overflow-hidden">
      
      {/* Game Canvas */}
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        className="border-2 border-gray-800 shadow-2xl rounded-lg bg-black cursor-none"
        style={{ maxWidth: '100%', maxHeight: '100%' }}
      />

      {/* HUD - Playing */}
      {gameState === GameState.PLAYING && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex gap-8 text-white font-mono text-xl z-10 pointer-events-none">
          <div className="bg-gray-900/50 px-4 py-2 rounded border border-gray-700">
            SCORE: <span className="text-yellow-400">{score}</span>
          </div>
          <div className="bg-gray-900/50 px-4 py-2 rounded border border-gray-700">
             SPEED: <span className="text-cyan-400">{(playerRef.current.speedMultiplier * 100).toFixed(0)}%</span>
          </div>
        </div>
      )}

      {/* Main Menu Overlay */}
      {gameState === GameState.MENU && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm z-20">
          <div className="text-center p-8 border border-cyan-500/30 rounded-2xl bg-gray-900/90 shadow-[0_0_50px_rgba(0,210,255,0.2)]">
            <h1 className="text-5xl font-bold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">
              COSMIC JET FIGHTER
            </h1>
            <p className="text-gray-400 mb-8 tracking-widest text-sm uppercase">Defense of the Solar System</p>
            
            <div className="space-y-4 mb-8 text-left inline-block bg-black/40 p-6 rounded-lg border border-gray-700">
              <div className="flex items-center gap-4 text-gray-300">
                <span className="px-2 py-1 bg-gray-700 rounded text-xs font-mono">ARROW KEYS</span>
                <span>Move & Change Speed</span>
              </div>
              <div className="flex items-center gap-4 text-gray-300">
                <span className="px-2 py-1 bg-gray-700 rounded text-xs font-mono">SPACE</span>
                <span>Shoot Missiles</span>
              </div>
            </div>

            <div className="animate-pulse text-white text-xl font-mono mt-4">
              PRESS <span className="text-yellow-400 font-bold">[ENTER]</span> TO START
            </div>
          </div>
        </div>
      )}

      {/* Game Over Overlay */}
      {gameState === GameState.GAME_OVER && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-900/20 backdrop-blur-sm z-20">
          <div className="text-center p-10 border-2 border-red-500/50 rounded-2xl bg-black/90 shadow-[0_0_50px_rgba(220,38,38,0.4)]">
            <h2 className="text-6xl font-black text-red-500 mb-2 drop-shadow-lg">GAME OVER</h2>
            <div className="text-4xl text-white font-mono mb-8">
              FINAL SCORE: <span className="text-yellow-400">{score}</span>
            </div>
            <button 
              onClick={() => {
                setGameState(GameState.PLAYING);
                resetGame();
              }}
              className="px-8 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded transition-colors text-lg"
            >
              RETRY MISSION
            </button>
            <p className="mt-4 text-gray-500 text-sm">or press Enter to restart</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;