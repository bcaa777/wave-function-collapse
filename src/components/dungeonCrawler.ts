import { buildDomTree } from "../util";
import { IComponent } from "./component";
import { GameElement, getElementProperties } from "../colorMapping";
import { SpriteManager } from "./spriteManager";

export interface IComponentDungeonCrawler extends IComponent {
  startGame(gameMap: GameElement[][], playerStart: { x: number; y: number }): Promise<void>;
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
  startGame: async (gameMap: GameElement[][], playerStart: { x: number; y: number }) => {
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

    // Initialize sprites and textures
    try {
      await spriteManager.initializeDefaults();
    } catch (error) {
      console.warn('Failed to load some sprites/textures:', error);
    }

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

  // Sprite and texture management
  const spriteManager = new SpriteManager();

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

    // Draw ceiling (stone-like texture color)
    ctx.fillStyle = "#3a3a3a"; // Darker stone color for ceiling
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT / 2);

    // Draw floor with dynamic colors based on nearby elements
    drawDynamicFloor();

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

      // Debug: log wall colors occasionally (remove this in production)
      if (Math.random() < 0.005) {
        console.log('Wall element:', element, 'Color:', color, 'Distance:', distance.toFixed(2));
      }

      ctx.fillStyle = color;
      ctx.fillRect(i, wallTop, 1, wallBottom - wallTop);
    }

    // Draw sprites for interactive elements
    renderSprites();

    // Draw UI
    updateUI();
  }

  function drawDynamicFloor(): void {
    const floorY = CANVAS_HEIGHT / 2;
    const floorHeight = CANVAS_HEIGHT / 2;

    // Draw floor with proper perspective (doesn't rotate with player)
    ctx.fillStyle = "#4a4a4a"; // Base floor color
    ctx.fillRect(0, floorY, CANVAS_WIDTH, floorHeight);

    // Draw floor tiles with perspective
    drawFloorTiles();
  }

  function drawFloorTiles(): void {
    const floorY = CANVAS_HEIGHT / 2;
    const tileSize = 60;
    const numRows = 6;

    // Draw floor tiles with proper perspective
    for (let row = 0; row < numRows; row++) {
      const rowY = floorY + (row * tileSize * 0.4);
      const rowHeight = tileSize * 0.4;
      const rowWidth = CANVAS_WIDTH * (1 - row * 0.08);
      const rowX = (CANVAS_WIDTH - rowWidth) / 2;

      if (rowY > CANVAS_HEIGHT) break;

      // Alternate tile colors for checkerboard pattern
      const numCols = Math.floor(rowWidth / (tileSize * (1 - row * 0.03))) + 1;

      for (let col = 0; col < numCols; col++) {
        const colX = rowX + (col * rowWidth / numCols);
        const colWidth = rowWidth / numCols;

        // Create checkerboard pattern
        const isDarkTile = (row + col) % 2 === 0;

        // Draw tile with gradient for depth
        const gradient = ctx.createLinearGradient(colX, rowY, colX, rowY + rowHeight);
        if (isDarkTile) {
          gradient.addColorStop(0, `rgba(70, 70, 70, ${0.9 - row * 0.1})`);
          gradient.addColorStop(1, `rgba(50, 50, 50, ${0.8 - row * 0.1})`);
        } else {
          gradient.addColorStop(0, `rgba(80, 80, 80, ${0.9 - row * 0.1})`);
          gradient.addColorStop(1, `rgba(60, 60, 60, ${0.8 - row * 0.1})`);
        }

        ctx.fillStyle = gradient;
        ctx.fillRect(colX, rowY, colWidth, rowHeight);

        // Add subtle tile border
        ctx.strokeStyle = `rgba(120, 120, 120, ${0.3 - row * 0.03})`;
        ctx.lineWidth = 0.5;
        ctx.strokeRect(colX, rowY, colWidth, rowHeight);
      }
    }
  }

  function renderSprites(): void {
    // Collect all sprites with their positions and distances
    const visibleSprites: Array<{
      sprite: any;
      worldX: number;
      worldY: number;
      distance: number;
      angle: number;
    }> = [];

    // Check all map elements for sprites
    for (let y = 0; y < currentGameMap.length; y++) {
      for (let x = 0; x < currentGameMap[y].length; x++) {
        const element = currentGameMap[y][x];
        const properties = getElementProperties(element);

        // Only process sprites for interactive elements
        if (properties.interactive || element === GameElement.ENEMY) {
          let spriteName: string;
          switch (element) {
            case GameElement.ENEMY:
              spriteName = 'enemy';
              break;
            case GameElement.DANGER:
              spriteName = 'danger';
              break;
            case GameElement.PLAYER_FINISH:
              spriteName = 'finish';
              break;
            case GameElement.TREASURE:
              spriteName = 'treasure';
              break;
            case GameElement.KEY:
              spriteName = 'key';
              break;
            case GameElement.DOOR:
              spriteName = 'door';
              break;
            case GameElement.STAIRS:
              spriteName = 'stairs';
              break;
            default:
              continue; // Skip elements without sprites
          }

          const sprite = spriteManager.getSprite(spriteName);
          if (sprite) {
            const spriteX = x + 0.5;
            const spriteY = y + 0.5;

            // Calculate distance and angle to sprite
            const dx = spriteX - player.x;
            const dy = spriteY - player.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < 0.1) continue; // Too close to player

            const angle = Math.atan2(dy, dx);
            let relativeAngle = angle - player.angle;

            // Normalize angle to [-PI, PI]
            while (relativeAngle < -Math.PI) relativeAngle += 2 * Math.PI;
            while (relativeAngle > Math.PI) relativeAngle -= 2 * Math.PI;

            // Check if sprite is in field of view
            if (Math.abs(relativeAngle) > FOV / 2) continue;

            // Check if sprite is not behind a wall (robust occlusion test)
            if (!isSpriteVisible(spriteX, spriteY, distance)) continue;

            // Additional check: ensure sprite is actually in front of walls by comparing to raycast distance
            const spriteRayDistance = castRay(angle);
            if (spriteRayDistance < distance - 0.1) continue; // Wall is definitely closer

            visibleSprites.push({
              sprite,
              worldX: spriteX,
              worldY: spriteY,
              distance,
              angle: relativeAngle
            });
          }
        }
      }
    }

    // Add enemy sprites
    enemies.forEach((enemy) => {
      const sprite = spriteManager.getSprite('enemy');
      if (sprite) {
        const dx = enemy.x - player.x;
        const dy = enemy.y - player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 0.1) return; // Too close

        const angle = Math.atan2(dy, dx);
        let relativeAngle = angle - player.angle;

        while (relativeAngle < -Math.PI) relativeAngle += 2 * Math.PI;
        while (relativeAngle > Math.PI) relativeAngle -= 2 * Math.PI;

        if (Math.abs(relativeAngle) > FOV / 2) return;

        // Check occlusion for enemies too
        if (!isSpriteVisible(enemy.x, enemy.y, distance)) return;

        // Additional check: ensure enemy is actually in front of walls
        const enemyRayDistance = castRay(angle);
        if (enemyRayDistance < distance - 0.1) return; // Wall is definitely closer

        visibleSprites.push({
          sprite,
          worldX: enemy.x,
          worldY: enemy.y,
          distance,
          angle: relativeAngle
        });
      }
    });

    // Sort sprites by distance (far to near) for proper rendering order
    visibleSprites.sort((a, b) => b.distance - a.distance);

    // Render all visible sprites
    visibleSprites.forEach((spriteData) => {
      spriteManager.drawSprite(
        ctx,
        spriteData.sprite,
        spriteData.worldX,
        spriteData.worldY,
        player.x,
        player.y,
        player.angle,
        CANVAS_WIDTH,
        CANVAS_HEIGHT,
        FOV
      );
    });
  }

  // Check if a sprite is visible (not occluded by walls)
  function isSpriteVisible(spriteX: number, spriteY: number, spriteDistance: number): boolean {
    // Method 1: Use existing raycasting data for more accurate occlusion
    const dx = spriteX - player.x;
    const dy = spriteY - player.y;
    const angle = Math.atan2(dy, dx);

    // Normalize angle to match raycasting system
    let relativeAngle = angle - player.angle;
    while (relativeAngle < -Math.PI) relativeAngle += 2 * Math.PI;
    while (relativeAngle > Math.PI) relativeAngle -= 2 * Math.PI;

    // Convert angle to screen space (like the raycasting system)
    const screenX = Math.floor(CANVAS_WIDTH / 2 + (relativeAngle / (FOV / 2)) * (CANVAS_WIDTH / 2));

    // If sprite is outside screen bounds, it's not visible
    if (screenX < 0 || screenX >= CANVAS_WIDTH) {
      return false;
    }

    // Method 2: Cast a ray in the direction of the sprite and check wall distance
    const rayDistance = castRay(angle);

    // If the wall is closer than the sprite, the sprite is occluded
    if (rayDistance < spriteDistance - 0.3) { // 0.3 tolerance for sprite size
      return false;
    }

    // Method 3: Check immediate surroundings for wall occlusion
    const checkRadius = 1; // Check 1 tile radius around sprite
    for (let offsetY = -checkRadius; offsetY <= checkRadius; offsetY++) {
      for (let offsetX = -checkRadius; offsetX <= checkRadius; offsetX++) {
        const checkTileX = Math.floor(spriteX) + offsetX;
        const checkTileY = Math.floor(spriteY) + offsetY;

        if (checkTileX < 0 || checkTileX >= currentGameMap[0].length ||
            checkTileY < 0 || checkTileY >= currentGameMap.length) {
          continue;
        }

        const element = currentGameMap[checkTileY][checkTileX];
        const properties = getElementProperties(element);

        // If there's a wall near the sprite in the direction from the player
        if (!properties.walkable) {
          const wallDistance = Math.sqrt(
            Math.pow(checkTileX + 0.5 - player.x, 2) +
            Math.pow(checkTileY + 0.5 - player.y, 2)
          );

          // If wall is between player and sprite, check if it blocks the view
          if (wallDistance < spriteDistance) {
            // Simple angle check to see if wall is in the line of sight
            const wallAngle = Math.atan2(checkTileY + 0.5 - player.y, checkTileX + 0.5 - player.x);
            let wallRelativeAngle = wallAngle - player.angle;
            while (wallRelativeAngle < -Math.PI) wallRelativeAngle += 2 * Math.PI;
            while (wallRelativeAngle > Math.PI) wallRelativeAngle -= 2 * Math.PI;

            // If wall is within a narrow cone towards the sprite, it might occlude
            if (Math.abs(wallRelativeAngle - relativeAngle) < 0.3) { // ~17 degrees
              return false;
            }
          }
        }
      }
    }

    return true;
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
    // Use sprite manager for wall colors with fallback
    try {
      const color = spriteManager.getWallTextureColor(element.toLowerCase(), distance);
      // Ensure we return a valid color
      if (color && color.startsWith('#') || color.startsWith('rgb')) {
        return color;
      }
    } catch (error) {
      console.warn('Error getting wall texture color:', error);
    }

    // Fallback colors based on element type
    switch (element) {
      case GameElement.WALL:
        return `rgb(${Math.floor(120 - distance * 10)}, ${Math.floor(120 - distance * 10)}, ${Math.floor(130 - distance * 10)})`;
      case GameElement.DOOR:
        return `rgb(${Math.floor(100 - distance * 8)}, ${Math.floor(60 - distance * 5)}, ${Math.floor(30 - distance * 3)})`;
      case GameElement.DANGER:
        return `rgb(${Math.floor(180 - distance * 15)}, ${Math.floor(40 - distance * 3)}, ${Math.floor(20 - distance * 2)})`;
      case GameElement.FIRE:
        return `rgb(${Math.floor(200 - distance * 15)}, ${Math.floor(80 - distance * 6)}, ${Math.floor(10 - distance * 1)})`;
      default:
        return `rgb(${Math.floor(150 - distance * 12)}, ${Math.floor(150 - distance * 12)}, ${Math.floor(160 - distance * 12)})`;
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
