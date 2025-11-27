export interface Point {
  x: number;
  y: number;
}

export interface Entity extends Point {
  width: number;
  height: number;
  color: string;
  vx: number;
  vy: number;
}

export interface Player extends Entity {
  tilt: number; // Rotation in radians
  speedMultiplier: number; // 1 is base speed
  cooldown: number;
}

export interface Obstacle extends Entity {
  id: number;
  rotation: number;
  rotationSpeed: number;
  vertices: Point[]; // For jagged asteroid look
}

export interface Missile extends Entity {
  id: number;
}

export interface Star {
  x: number;
  y: number;
  size: number;
  speed: number;
  brightness: number;
}

export interface Planet {
  x: number;
  y: number;
  radius: number;
  color: string;
  speed: number;
  type: 'gas' | 'terrestrial' | 'ringed';
}

export enum GameState {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER',
}