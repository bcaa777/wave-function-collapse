import { buildDomTree } from "../util";
import { IComponent } from "./component";
import { GameElement, getElementProperties } from "../colorMapping";

// Use global THREE object loaded from CDN
declare const THREE: any;

export interface IComponentThreeJSDungeonCrawler extends IComponent {
  startGame(gameMap: GameElement[][], playerStart: { x: number; y: number }): Promise<void>;
  stopGame(): void;
  onGameComplete?: () => void;
  onGameOver?: () => void;
}

export interface Player {
  x: number;
  y: number;
  angle: number;
  health: number;
  maxHealth: number;
  keys: number;
  treasures: number;
}

export interface Enemy {
  x: number;
  y: number;
  health: number;
  type: string;
  lastMove: number;
  mesh?: THREE.Sprite;
}

export function createThreeJSDungeonCrawler(): IComponentThreeJSDungeonCrawler {
  const component: IComponentThreeJSDungeonCrawler = {
    domElement: Object.assign(document.createElement("div"), { className: "threeJSDungeonCrawlerComponent" }),
    startGame: async (gameMap: GameElement[][], playerStart: { x: number; y: number }) => {
      await initializeGame(gameMap, playerStart);
    },
    stopGame: () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
      if (renderer && component.domElement.contains(renderer.domElement)) {
        component.domElement.removeChild(renderer.domElement);
      }
    }
  };

  // Three.js components
  let scene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  let renderer: THREE.WebGLRenderer;
  let animationId: number;

  // Game state
  let currentGameMap: GameElement[][] = [];
  let enemies: Enemy[] = [];
  let gameRunning = false;

  // Player state
  const player: Player = {
    x: 0,
    y: 0,
    angle: 0,
    health: 100,
    maxHealth: 100,
    keys: 0,
    treasures: 0
  };

  // Game constants
  const BASE_WIDTH = 480;
  const BASE_HEIGHT = 320;
  const SCALE_FACTOR = 2; // Upscale to 960x640
  const WALL_HEIGHT = 2.0;
  const MOVE_SPEED = 0.05;
  const ROTATE_SPEED = 0.03;

  // Input state
  const keysPressed: Set<string> = new Set();

  async function initializeGame(gameMap: GameElement[][], playerStart: { x: number; y: number }): Promise<void> {
    currentGameMap = gameMap;
    player.x = playerStart.x + 0.5;
    player.y = playerStart.y + 0.5;
    player.angle = 0;
    player.health = player.maxHealth;
    player.keys = 0;
    player.treasures = 0;
    enemies = [];
    gameRunning = true;

    // Check if Three.js is available
    if (typeof THREE === 'undefined') {
      console.error('Three.js is not loaded. Make sure the CDN script is working.');
      const errorMsg = document.createElement('div');
      errorMsg.style.cssText = 'color: red; font-size: 18px; text-align: center; margin: 20px; padding: 20px; border: 2px solid red; border-radius: 10px; background: #ffe6e6;';
      errorMsg.innerHTML = `
        ❌ <strong>Three.js failed to load!</strong><br>
        Please check your internet connection and refresh the page.<br>
        <br>
        <small>If the problem persists, try:</small><br>
        <code>npm run dev</code> to restart the server
      `;
      component.domElement.appendChild(errorMsg);
      return;
    }

    // THREE is already declared globally

    // Initialize Three.js scene
    await setupThreeJS();

    // Create the dungeon geometry
    createDungeon();

    // Start the game loop
    gameLoop();
  }

  async function setupThreeJS(): Promise<void> {
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a1a2a); // Dark blue background

    // Create camera
    camera = new THREE.PerspectiveCamera(75, BASE_WIDTH / BASE_HEIGHT, 0.1, 1000);
    camera.position.set(player.x, 1, player.y);
    camera.lookAt(player.x + Math.cos(player.angle), 1, player.y + Math.sin(player.angle));

    // Create renderer with upscaling
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(BASE_WIDTH * SCALE_FACTOR, BASE_HEIGHT * SCALE_FACTOR);
    renderer.domElement.style.width = `${BASE_WIDTH * SCALE_FACTOR}px`;
    renderer.domElement.style.height = `${BASE_HEIGHT * SCALE_FACTOR}px`;
    renderer.domElement.style.imageRendering = 'pixelated';
    renderer.setPixelRatio(window.devicePixelRatio);

    // Add lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 5);
    scene.add(directionalLight);

    // Add renderer to DOM
    component.domElement.appendChild(renderer.domElement);
  }

  function createDungeon(): void {
    const mapWidth = currentGameMap[0].length;
    const mapHeight = currentGameMap.length;

    // Create floor
    createFloor(mapWidth, mapHeight);

    // Create walls
    createWalls(mapWidth, mapHeight);

    // Create sprites for interactive elements
    createSprites();
  }

  function createFloor(width: number, height: number): void {
    // Create floor geometry
    const floorGeometry = new THREE.PlaneGeometry(width, height);
    const floorMaterial = new THREE.MeshLambertMaterial({
      color: 0x444444,
      transparent: true,
      opacity: 0.9
    });

    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(width / 2 - 0.5, 0, height / 2 - 0.5);
    scene.add(floor);

    // Add floor texture pattern
    createFloorTexture(width, height);
  }

  function createFloorTexture(width: number, height: number): void {
    const tileSize = 1;
    const tilesX = Math.floor(width / tileSize);
    const tilesY = Math.floor(height / tileSize);

    for (let x = 0; x < tilesX; x++) {
      for (let y = 0; y < tilesY; y++) {
        const color = (x + y) % 2 === 0 ? 0x555555 : 0x333333;
        const tileGeometry = new THREE.PlaneGeometry(tileSize * 0.95, tileSize * 0.95);
        const tileMaterial = new THREE.MeshLambertMaterial({ color });

        const tile = new THREE.Mesh(tileGeometry, tileMaterial);
        tile.rotation.x = -Math.PI / 2;
        tile.position.set(x * tileSize, 0.01, y * tileSize);
        scene.add(tile);
      }
    }
  }

  function createWalls(width: number, height: number): void {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const element = currentGameMap[y][x];
        const properties = getElementProperties(element);

        if (!properties.walkable) {
          createWall(x, y, element);
        }
      }
    }
  }

  function createWall(x: number, y: number, element: GameElement): void {
    const wallGeometry = new THREE.BoxGeometry(1, WALL_HEIGHT, 1);
    const wallMaterial = new THREE.MeshLambertMaterial({
      color: getWallColor(element),
      transparent: false
    });

    const wall = new THREE.Mesh(wallGeometry, wallMaterial);
    wall.position.set(x, WALL_HEIGHT / 2, y);
    scene.add(wall);
  }

  function getWallColor(element: GameElement): number {
    switch (element) {
      case GameElement.WALL:
        return 0x666666; // Stone gray
      case GameElement.DOOR:
        return 0x8B4513; // Brown wood
      case GameElement.DANGER:
        return 0x8B0000; // Dark red
      case GameElement.FIRE:
        return 0xFF4500; // Orange red
      default:
        return 0x555555;
    }
  }

  function createSprites(): void {
    for (let y = 0; y < currentGameMap.length; y++) {
      for (let x = 0; x < currentGameMap[y].length; x++) {
        const element = currentGameMap[y][x];
        const properties = getElementProperties(element);

        if (properties.interactive || element === GameElement.ENEMY) {
          createSprite(x, y, element);
        }
      }
    }
  }

  function createSprite(x: number, y: number, element: GameElement): void {
    // Create a canvas for the sprite texture
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d')!;

    // Draw simple colored square based on element type
    ctx.fillStyle = getSpriteColor(element);
    ctx.fillRect(0, 0, 32, 32);

    // Add border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, 30, 30);

    // Create texture from canvas
    const texture = new THREE.CanvasTexture(canvas);

    // Create sprite material
    const spriteMaterial = new THREE.SpriteMaterial({
      map: texture,
      transparent: true
    });

    // Create sprite
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.position.set(x, 1, y);
    sprite.scale.set(0.8, 0.8, 0.8);

    scene.add(sprite);
  }

  function getSpriteColor(element: GameElement): string {
    switch (element) {
      case GameElement.ENEMY:
        return '#ff0000'; // Red
      case GameElement.DANGER:
        return '#ff6600'; // Orange
      case GameElement.PLAYER_FINISH:
        return '#00ff00'; // Green
      case GameElement.TREASURE:
        return '#ffff00'; // Yellow
      case GameElement.KEY:
        return '#ffd700'; // Gold
      case GameElement.DOOR:
        return '#8B4513'; // Brown
      case GameElement.STAIRS:
        return '#c0c0c0'; // Silver
      default:
        return '#888888';
    }
  }

  function updatePlayer(): void {
    let newX = player.x;
    let newY = player.y;

    // Handle movement
    if (keysPressed.has('keyw') || keysPressed.has('arrowup')) {
      newX += Math.cos(player.angle) * MOVE_SPEED;
      newY += Math.sin(player.angle) * MOVE_SPEED;
    }
    if (keysPressed.has('keys') || keysPressed.has('arrowdown')) {
      newX -= Math.cos(player.angle) * MOVE_SPEED;
      newY -= Math.sin(player.angle) * MOVE_SPEED;
    }
    if (keysPressed.has('keya') || keysPressed.has('arrowleft')) {
      newX += Math.cos(player.angle - Math.PI / 2) * MOVE_SPEED;
      newY += Math.sin(player.angle - Math.PI / 2) * MOVE_SPEED;
    }
    if (keysPressed.has('keyd') || keysPressed.has('arrowright')) {
      newX -= Math.cos(player.angle - Math.PI / 2) * MOVE_SPEED;
      newY -= Math.sin(player.angle - Math.PI / 2) * MOVE_SPEED;
    }

    // Handle rotation
    if (keysPressed.has('keyq')) {
      player.angle -= ROTATE_SPEED;
    }
    if (keysPressed.has('keye')) {
      player.angle += ROTATE_SPEED;
    }

    // Check collision and update position
    if (isValidPosition(newX, newY)) {
      player.x = newX;
      player.y = newY;
    }

    // Update camera position
    camera.position.set(player.x, 1, player.y);
    const lookX = player.x + Math.cos(player.angle) * 2;
    const lookZ = player.y + Math.sin(player.angle) * 2;
    camera.lookAt(lookX, 1, lookZ);
  }

  function isValidPosition(x: number, y: number): boolean {
    const tileX = Math.floor(x);
    const tileY = Math.floor(y);

    if (tileX < 0 || tileX >= currentGameMap[0].length ||
        tileY < 0 || tileY >= currentGameMap.length) {
      return false;
    }

    const element = currentGameMap[tileY][tileX];
    const properties = getElementProperties(element);

    return properties.walkable;
  }

  function gameLoop(): void {
    if (!gameRunning) return;

    updatePlayer();
    renderer.render(scene, camera);

    animationId = requestAnimationFrame(gameLoop);
  }

  // Input handling
  function handleKeyDown(e: KeyboardEvent) {
    keysPressed.add(e.code.toLowerCase());
  }

  function handleKeyUp(e: KeyboardEvent) {
    keysPressed.delete(e.code.toLowerCase());
  }

  // Event listeners
  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('keyup', handleKeyUp);

  return component;
}
