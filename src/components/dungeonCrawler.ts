import { buildDomTree } from "../util";
import { IComponent } from "./component";
import { GameElement, getElementProperties } from "../colorMapping";

export interface IComponentDungeonCrawler extends IComponent {
  startGame(gameMap: GameElement[][], playerStart: { x: number; y: number }): void;
  stopGame(): void;
  onGameComplete?: () => void;
  onGameOver?: () => void;
}

export interface Player {
  x: number;
  y: number;
  angle: number; // In radians
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
}

export function createDungeonCrawler(): IComponentDungeonCrawler {

  const component: IComponentDungeonCrawler = {
    domElement: Object.assign(document.createElement("div"), { className: "dungeonCrawlerComponent" }),
    startGame: (gameMap: GameElement[][], playerStart: { x: number; y: number }) => {
      currentGameMap = gameMap;
      player.x = playerStart.x + 0.5;
      player.y = playerStart.y + 0.5;
      player.angle = 0;
      player.health = player.maxHealth;
      player.keys = 0;
      player.treasures = 0;
      enemies = [];
      gameRunning = true;
      lastFrameTime = Date.now();
      gameLoop();
    },
    stopGame: () => {
      gameRunning = false;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    }
  };

  // Game state
  let currentGameMap: GameElement[][] = [];
  let gameRunning = false;
  let animationFrameId: number;
  let lastFrameTime = 0;

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

  // Enemy state
  let enemies: Enemy[] = [];

  // Game constants
  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 600;
  const FOV = Math.PI / 3; // 60 degrees field of view
  const WALL_HEIGHT = 2.0; // Made walls taller
  const PLAYER_HEIGHT = 0.5;
  const MOVE_SPEED = 0.05;
  const ROTATE_SPEED = 0.04; // Slightly faster rotation

  // Input state
  const keysPressed: Set<string> = new Set();

  // Create canvases
  const gameCanvas = document.createElement("canvas");
  gameCanvas.width = CANVAS_WIDTH;
  gameCanvas.height = CANVAS_HEIGHT;
  gameCanvas.className = "dungeonGameCanvas";
  gameCanvas.style.border = "1px solid #ccc";
  gameCanvas.style.backgroundColor = "#000";

  const ctx = gameCanvas.getContext("2d")!;

  // UI elements
  const healthBar = document.createElement("div");
  healthBar.className = "healthBar";
  healthBar.innerHTML = `
    <div class="healthLabel">Health:</div>
    <div class="healthValue">100/100</div>
  `;

  const inventory = document.createElement("div");
  inventory.className = "inventory";
  inventory.innerHTML = `
    <div class="inventoryItem">Keys: <span id="keyCount">0</span></div>
    <div class="inventoryItem">Treasures: <span id="treasureCount">0</span></div>
  `;

  const controls = document.createElement("div");
  controls.className = "controls";
  controls.innerHTML = `
    <h4>Controls:</h4>
    <p>WASD - Move</p>
    <p>A/D or Left/Right arrows - Turn</p>
    <p>Space - Attack</p>
    <p>E - Interact</p>
  `;

  // Input handling
  function handleKeyDown(e: KeyboardEvent) {
    keysPressed.add(e.code.toLowerCase());
  }

  function handleKeyUp(e: KeyboardEvent) {
    keysPressed.delete(e.code.toLowerCase());
  }

  function handleMouseMove(e: MouseEvent) {
    // Mouse movement disabled - using keyboard for turning
  }

  // Game logic
  function updatePlayer() {
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

    // Handle rotation - A/D or Left/Right arrows
    if (keysPressed.has('keya') || keysPressed.has('arrowleft')) {
      player.angle -= ROTATE_SPEED;
    }
    if (keysPressed.has('keyd') || keysPressed.has('arrowright')) {
      player.angle += ROTATE_SPEED;
    }

    // Check collision and update position
    if (isValidPosition(newX, newY)) {
      player.x = newX;
      player.y = newY;
    }

    // Check for interactions
    const playerTileX = Math.floor(player.x);
    const playerTileY = Math.floor(player.y);

    if (playerTileX >= 0 && playerTileX < currentGameMap[0].length &&
        playerTileY >= 0 && playerTileY < currentGameMap.length) {

      const element = currentGameMap[playerTileY][playerTileX];
      const properties = getElementProperties(element);

      // Handle dangerous tiles
      if (properties.dangerous && Math.random() < 0.01) { // 1% chance per frame
        player.health -= 5;
        if (player.health <= 0) {
          gameRunning = false;
          if (component.onGameOver) {
            component.onGameOver();
          }
        }
      }

      // Handle collectibles
      if (properties.collectible) {
        if (element === GameElement.TREASURE) {
          player.treasures++;
          currentGameMap[playerTileY][playerTileX] = GameElement.FLOOR;
        } else if (element === GameElement.KEY) {
          player.keys++;
          currentGameMap[playerTileY][playerTileX] = GameElement.FLOOR;
        }
      }

      // Handle finish condition
      if (element === GameElement.PLAYER_FINISH) {
        gameRunning = false;
        if (component.onGameComplete) {
          component.onGameComplete();
        }
      }
    }
  }

  function updateEnemies() {
    const currentTime = Date.now();
    enemies.forEach((enemy, index) => {
      if (currentTime - enemy.lastMove > 1000) { // Move every second
        // Simple AI: move towards player
        const dx = player.x - enemy.x;
        const dy = player.y - enemy.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 0) {
          const moveX = (dx / distance) * 0.1;
          const moveY = (dy / distance) * 0.1;

          const newX = enemy.x + moveX;
          const newY = enemy.y + moveY;

          if (isValidPosition(newX, newY)) {
            enemy.x = newX;
            enemy.y = newY;
          }
        }

        enemy.lastMove = currentTime;

        // Check if enemy is close enough to attack
        if (distance < 0.5) {
          player.health -= 10;
          if (player.health <= 0) {
            gameRunning = false;
            if (component.onGameOver) {
              component.onGameOver();
            }
          }
        }
      }
    });
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

  // Rendering
  function render() {
    // Clear canvas
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Draw ceiling (darker)
    ctx.fillStyle = "#2a2a2a";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT / 2);

    // Draw floor (lighter)
    ctx.fillStyle = "#4a4a4a";
    ctx.fillRect(0, CANVAS_HEIGHT / 2, CANVAS_WIDTH, CANVAS_HEIGHT / 2);

    // Raycasting
    const numRays = CANVAS_WIDTH;
    const angleStep = FOV / numRays;

    for (let i = 0; i < numRays; i++) {
      const rayAngle = player.angle - FOV / 2 + angleStep * i;
      const distance = castRay(rayAngle);

      // Calculate wall height
      const wallHeight = (WALL_HEIGHT / distance) * (CANVAS_HEIGHT / 2);
      const wallTop = (CANVAS_HEIGHT / 2) - wallHeight / 2;
      const wallBottom = (CANVAS_HEIGHT / 2) + wallHeight / 2;

      // Choose wall color based on distance and element
      const element = getWallElement(rayAngle, distance);
      const color = getWallColor(element, distance);

      ctx.fillStyle = color;
      ctx.fillRect(i, wallTop, 1, wallBottom - wallTop);
    }

    // Draw UI
    updateUI();
  }

  function castRay(angle: number): number {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);

    let x = player.x;
    let y = player.y;
    let distance = 0;

    while (distance < 20) { // Max view distance
      x += dx * 0.01;
      y += dy * 0.01;
      distance += 0.01;

      const tileX = Math.floor(x);
      const tileY = Math.floor(y);

      if (tileX < 0 || tileX >= currentGameMap[0].length ||
          tileY < 0 || tileY >= currentGameMap.length) {
        return distance;
      }

      const element = currentGameMap[tileY][tileX];
      const properties = getElementProperties(element);

      if (!properties.walkable) {
        return distance;
      }
    }

    return 20;
  }

  function getWallElement(angle: number, distance: number): GameElement {
    const x = player.x + Math.cos(angle) * distance;
    const y = player.y + Math.sin(angle) * distance;

    const tileX = Math.floor(x);
    const tileY = Math.floor(y);

    if (tileX < 0 || tileX >= currentGameMap[0].length ||
        tileY < 0 || tileY >= currentGameMap.length) {
      return GameElement.WALL;
    }

    return currentGameMap[tileY][tileX];
  }

  function getWallColor(element: GameElement, distance: number): string {
    // Distance fog
    const fogFactor = Math.max(0, 1 - distance / 10);
    const brightness = Math.floor(255 * fogFactor);

    switch (element) {
      case GameElement.WALL:
        return `rgb(${brightness}, ${brightness}, ${brightness})`;
      case GameElement.DOOR:
        return `rgb(${brightness}, ${brightness * 0.5}, 0)`;
      case GameElement.DANGER:
        return `rgb(${brightness}, ${brightness * 0.3}, ${brightness * 0.3})`;
      case GameElement.FIRE:
        return `rgb(${brightness}, ${brightness * 0.5}, 0)`;
      default:
        return `rgb(${brightness}, ${brightness}, ${brightness})`;
    }
  }

  function updateUI() {
    // Update health bar
    const healthValue = healthBar.querySelector('.healthValue') as HTMLElement;
    healthValue.textContent = `${Math.max(0, player.health)}/${player.maxHealth}`;

    // Update inventory
    const keyCount = inventory.querySelector('#keyCount') as HTMLElement;
    const treasureCount = inventory.querySelector('#treasureCount') as HTMLElement;
    keyCount.textContent = player.keys.toString();
    treasureCount.textContent = player.treasures.toString();
  }

  // Game loop
  function gameLoop() {
    if (!gameRunning) return;

    const currentTime = Date.now();
    const deltaTime = currentTime - lastFrameTime;
    lastFrameTime = currentTime;

    updatePlayer();
    updateEnemies();
    render();

    animationFrameId = requestAnimationFrame(gameLoop);
  }

  // Event listeners
  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('keyup', handleKeyUp);
  // Removed mouse movement listener - using keyboard for turning

  // Build DOM
  const gameUIContainer = document.createElement("div");
  gameUIContainer.className = "gameUI";
  gameUIContainer.appendChild(healthBar);
  gameUIContainer.appendChild(inventory);
  gameUIContainer.appendChild(controls);

  buildDomTree(component.domElement, [
    document.createElement("p"), [
      "Navigate through the dungeon! Avoid enemies and dangers, collect treasures and keys, and reach the finish."
    ],
    gameUIContainer,
    gameCanvas,
  ]);

  return component;
}
