import { buildDomTree } from "../util";
import { IComponent } from "./component";
import { GameElement, getElementProperties } from "../colorMapping";

// Use global THREE object loaded from CDN
declare const THREE: any;

// Extend window interface for debug tracking
declare global {
  interface Window {
    lastDebugPosition?: string | null;
  }
}

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
  const PLAYER_COLLISION_RADIUS = 0.25; // Player collision radius - increased for better spacing from wall textures

  // Input state
  const keysPressed: Set<string> = new Set();

  // Texture loader
  const textureLoader = new THREE.TextureLoader();

  // Mouse look variables
  let mouseX = 0;
  let mouseY = 0;
  let isPointerLocked = false;

  // Debug variables
  let debugMode = false;
  let debugSpheres: THREE.Mesh[] = [];

  // Particle system variables
  let particleSystems: Map<GameElement, THREE.Points[]> = new Map();
  let fireLights: THREE.PointLight[] = [];

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

    // Setup input event listeners
    setupInputListeners();

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

    // Advanced lighting system
    setupLighting();

    // Enable shadows
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Add renderer to DOM
    component.domElement.appendChild(renderer.domElement);
  }

  function setupLighting(): void {
    // Player torch light (follows player) - now the only light source
    const playerTorch = new THREE.PointLight(0xffaa44, 2.0, 12);
    playerTorch.position.set(player.x, 1.5, player.y);
    playerTorch.castShadow = true;

    // Enhanced shadow settings for hard shadows
    playerTorch.shadow.mapSize.width = 2048;
    playerTorch.shadow.mapSize.height = 2048;
    playerTorch.shadow.camera.near = 0.1;
    playerTorch.shadow.camera.far = 15;
    playerTorch.shadow.bias = -0.0001; // Reduces shadow acne

    scene.add(playerTorch);

    // Store reference to player torch for updates
    (scene as any).playerTorch = playerTorch;

    // Add atmospheric fog (darker since we have less light)
    scene.fog = new THREE.Fog(0x000000, 3, 20);
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

    // Create particle effects for atmospheric elements
    createParticleEffects();

    // Initialize debug visualization
    createDebugSpheres();
  }

  function createFloor(width: number, height: number): void {
    // Create floor geometry
    const floorGeometry = new THREE.PlaneGeometry(width, height);

    // Load floor texture
    const floorTexture = textureLoader.load('textures/floor_stone.png');
    floorTexture.wrapS = THREE.RepeatWrapping;
    floorTexture.wrapT = THREE.RepeatWrapping;
    floorTexture.repeat.set(width / 4, height / 4);

    const floorMaterial = new THREE.MeshLambertMaterial({
      map: floorTexture,
      transparent: true,
      opacity: 0.9
    });

    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(width / 2 - 0.5, 0, height / 2 - 0.5);
    floor.receiveShadow = true;
    scene.add(floor);

    // Create ceiling
    createCeiling(width, height);
  }

  function createCeiling(width: number, height: number): void {
    // Create ceiling geometry
    const ceilingGeometry = new THREE.PlaneGeometry(width, height);

    // Load ceiling texture
    const ceilingTexture = textureLoader.load('textures/ceiling_stone.png');
    ceilingTexture.wrapS = THREE.RepeatWrapping;
    ceilingTexture.wrapT = THREE.RepeatWrapping;
    ceilingTexture.repeat.set(width / 4, height / 4);

    const ceilingMaterial = new THREE.MeshLambertMaterial({
      map: ceilingTexture,
      transparent: true,
      opacity: 0.8
    });

    const ceiling = new THREE.Mesh(ceilingGeometry, ceilingMaterial);
    ceiling.rotation.x = Math.PI / 2; // Rotate to face down
    ceiling.position.set(width / 2 - 0.5, WALL_HEIGHT, height / 2 - 0.5);
    ceiling.receiveShadow = true;
    scene.add(ceiling);
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
    // Create wall geometry that exactly matches the collision detection expectations
    // Wall should be 1x1 units in X and Z, WALL_HEIGHT in Y
    const wallGeometry = new THREE.BoxGeometry(1, WALL_HEIGHT, 1);

    // Create material array for all 6 faces of the cube to ensure consistent texturing
    const wallTexture = getWallTexture(element);
    const wallMaterial = [
      new THREE.MeshLambertMaterial({ map: wallTexture.clone(), transparent: false }), // Right face (+X)
      new THREE.MeshLambertMaterial({ map: wallTexture.clone(), transparent: false }), // Left face (-X)
      new THREE.MeshLambertMaterial({ map: wallTexture.clone(), transparent: false }), // Top face (+Y)
      new THREE.MeshLambertMaterial({ map: wallTexture.clone(), transparent: false }), // Bottom face (-Y)
      new THREE.MeshLambertMaterial({ map: wallTexture.clone(), transparent: false }), // Front face (+Z)
      new THREE.MeshLambertMaterial({ map: wallTexture.clone(), transparent: false })  // Back face (-Z)
    ];

    const wall = new THREE.Mesh(wallGeometry, wallMaterial);
    // Position wall at grid coordinates (x, y) - this centers the wall at (x, WALL_HEIGHT/2, y)
    // The wall will occupy space from (x-0.5, 0, y-0.5) to (x+0.5, WALL_HEIGHT, y+0.5)
    wall.position.set(x, WALL_HEIGHT / 2, y);
    wall.castShadow = true;
    wall.receiveShadow = true;
    // Ensure consistent orientation
    wall.rotation.y = 0;

    // Add a name for debugging
    wall.name = `wall_${x}_${y}`;

    // DEBUG: Add wireframe to visualize wall boundaries
    if (debugMode) {
      const wireframeGeometry = new THREE.BoxGeometry(1, WALL_HEIGHT, 1);
      const wireframeMaterial = new THREE.MeshBasicMaterial({
        color: 0xff0000,
        wireframe: true,
        transparent: true,
        opacity: 0.3
      });
      const wireframe = new THREE.Mesh(wireframeGeometry, wireframeMaterial);
      wireframe.position.copy(wall.position);
      wireframe.name = `wireframe_${x}_${y}`;
      scene.add(wireframe);
    }

    scene.add(wall);

    // DEBUG: Log wall creation for debugging
    if (debugMode) {
      console.log(`Created wall at (${x}, ${y}) - occupies space: (${(x-0.5).toFixed(2)}, 0, ${(y-0.5).toFixed(2)}) to (${(x+0.5).toFixed(2)}, ${WALL_HEIGHT.toFixed(2)}, ${(y+0.5).toFixed(2)})`);
    }
  }

  function getWallTexture(element: GameElement): THREE.Texture {
    let texturePath: string;
    switch (element) {
      case GameElement.WALL:
        texturePath = 'textures/wall_stone.png';
        break;
      case GameElement.DOOR:
        texturePath = 'textures/wood_texture.png';
        break;
      case GameElement.DANGER:
        texturePath = 'textures/danger_texture.png';
        break;
      case GameElement.FIRE:
        texturePath = 'textures/fire_texture.png';
        break;
      default:
        texturePath = 'textures/wall_stone.png';
    }

    const texture = textureLoader.load(texturePath);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 1);
    // Ensure texture is properly oriented and doesn't have artifacts
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return texture;
  }

  function createSprites(): void {
    for (let y = 0; y < currentGameMap.length; y++) {
      for (let x = 0; x < currentGameMap[y].length; x++) {
        const element = currentGameMap[y][x];

        // Create sprites for ALL elements that have sprites, not just interactive ones
        // Skip WALL since walls are handled by createWalls()
        if (element !== GameElement.WALL && element !== GameElement.FLOOR) {
          createSprite(x, y, element);
        }
      }
    }
  }

  function createSprite(x: number, y: number, element: GameElement): void {
    const spritePath = getSpritePath(element);

    if (spritePath) {
      // Create sprite with texture
      const texture = textureLoader.load(spritePath);
      const spriteMaterial = new THREE.SpriteMaterial({
        map: texture,
        transparent: true
      });
      const sprite = new THREE.Sprite(spriteMaterial);
      sprite.position.set(x, 1, y);
      sprite.scale.set(0.8, 0.8, 0.8);
      scene.add(sprite);
    } else {
      // Create colored quad for elements without sprites
      createColoredQuad(x, y, element);
    }
  }

  function createColoredQuad(x: number, y: number, element: GameElement): void {
    // Create a simple colored plane for elements without sprites
    const geometry = new THREE.PlaneGeometry(0.8, 0.8);
    const material = new THREE.MeshBasicMaterial({
      color: getElementColor(element),
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide
    });

    const quad = new THREE.Mesh(geometry, material);
    quad.position.set(x, 0.1, y); // Slightly above ground
    quad.rotation.x = -Math.PI / 2; // Lay flat on ground

    // Add subtle animation for interactive elements
    if (getElementProperties(element).interactive) {
      quad.userData = { originalY: 0.1, element };
      (quad as any).animate = true;
    }

    scene.add(quad);
  }

  function createParticleEffects(): void {
    // Clear existing particle systems
    particleSystems.forEach(systems => {
      systems.forEach(system => scene.remove(system));
    });
    particleSystems.clear();

    // Clear existing fire lights
    fireLights.forEach(light => scene.remove(light));
    fireLights = [];

    // Create particle effects for each element type
    for (let y = 0; y < currentGameMap.length; y++) {
      for (let x = 0; x < currentGameMap[y].length; x++) {
        const element = currentGameMap[y][x];
        const properties = getElementProperties(element);

        // Only create particles for non-wall elements that need atmosphere
        if (element !== GameElement.WALL && element !== GameElement.FLOOR) {
          createParticlesForElement(x, y, element);
        }

        // Add fire lights
        if (element === GameElement.FIRE) {
          createFireLight(x, y);
        }
      }
    }
  }

  function createParticlesForElement(x: number, y: number, element: GameElement): void {
    const particleConfig = getParticleConfig(element);
    if (!particleConfig) return;

    const { count, color, size, speed, spread } = particleConfig;

    // Create particle geometry
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    // Initialize particles in a small area around the element
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;

      // Random position within spread area
      positions[i3] = x + (Math.random() - 0.5) * spread;
      positions[i3 + 1] = 0.5 + Math.random() * 0.5; // Above ground
      positions[i3 + 2] = y + (Math.random() - 0.5) * spread;

      // Set color
      colors[i3] = ((color >> 16) & 255) / 255;
      colors[i3 + 1] = ((color >> 8) & 255) / 255;
      colors[i3 + 2] = (color & 255) / 255;

      // Set size
      sizes[i] = size * (0.5 + Math.random() * 0.5);
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    // Create material for billboard particles
    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        pixelRatio: { value: window.devicePixelRatio }
      },
      vertexShader: `
        attribute float size;
        attribute vec3 color;
        varying vec3 vColor;
        varying float vSize;
        uniform float time;
        uniform float pixelRatio;

        void main() {
          vColor = color;
          vSize = size;

          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          gl_PointSize = size * pixelRatio * (300.0 / -mvPosition.z);
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vSize;

        void main() {
          float distance = length(gl_PointCoord - vec2(0.5));
          if (distance > 0.5) discard;

          // Soft circular particles
          float alpha = 1.0 - smoothstep(0.0, 0.5, distance);
          gl_FragColor = vec4(vColor, alpha * 0.6);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    const particleSystem = new THREE.Points(geometry, material);
    particleSystem.userData = { element, x, y, speed, originalPositions: positions.slice() };

    scene.add(particleSystem);

    // Add to particle systems map
    if (!particleSystems.has(element)) {
      particleSystems.set(element, []);
    }
    particleSystems.get(element)!.push(particleSystem);
  }

  function getParticleConfig(element: GameElement): { count: number; color: number; size: number; speed: number; spread: number } | null {
    switch (element) {
      case GameElement.WATER:
        return {
          count: 8,
          color: 0x4488ff, // Light blue
          size: 3,
          speed: 0.5,
          spread: 0.6
        };
      case GameElement.GRASS:
        return {
          count: 6,
          color: 0x22aa44, // Green
          size: 2,
          speed: 0.3,
          spread: 0.8
        };
      case GameElement.FIRE:
        return {
          count: 12,
          color: 0xff6600, // Orange
          size: 4,
          speed: 1.5,
          spread: 0.4
        };
      case GameElement.DANGER:
        return {
          count: 10,
          color: 0xff0044, // Red
          size: 3,
          speed: 1.0,
          spread: 0.7
        };
      case GameElement.PLAYER_START:
        return {
          count: 5,
          color: 0xffff88, // Light yellow
          size: 2,
          speed: 0.8,
          spread: 0.3
        };
      default:
        return null;
    }
  }

  function createFireLight(x: number, y: number): void {
    const fireLight = new THREE.PointLight(0xffaa44, 0.8, 6);
    fireLight.position.set(x, 0.8, y);
    fireLight.castShadow = false; // Don't cast shadows to avoid performance issues

    scene.add(fireLight);
    fireLights.push(fireLight);
  }

  function updateParticleEffects(): void {
    const time = Date.now() * 0.001;

    particleSystems.forEach((systems, element) => {
      systems.forEach(system => {
        const material = system.material as THREE.ShaderMaterial;
        material.uniforms.time.value = time;

        // Animate particles based on their type
        const positions = system.geometry.attributes.position.array as Float32Array;
        const originalPositions = system.userData.originalPositions;
        const speed = system.userData.speed;

        for (let i = 0; i < positions.length; i += 3) {
          // Gentle floating motion
          positions[i + 1] = originalPositions[i + 1] + Math.sin(time * speed + i * 0.1) * 0.1;

          // For fire particles, add more chaotic motion
          if (element === GameElement.FIRE) {
            positions[i] = originalPositions[i] + Math.sin(time * speed * 2 + i * 0.2) * 0.05;
            positions[i + 2] = originalPositions[i + 2] + Math.cos(time * speed * 1.5 + i * 0.15) * 0.05;
          }
        }

        system.geometry.attributes.position.needsUpdate = true;
      });
    });

    // Animate fire lights with flickering
    fireLights.forEach((light, index) => {
      const baseIntensity = 0.8;
      const flicker = Math.sin(time * 8 + index) * 0.2 + Math.sin(time * 12 + index * 2) * 0.1;
      light.intensity = baseIntensity + flicker;
    });
  }

  function getElementColor(element: GameElement): number {
    switch (element) {
      case GameElement.GRASS:
        return 0x008000; // Green
      case GameElement.WATER:
        return 0x0000FF; // Blue
      case GameElement.FIRE:
        return 0xFF4500; // Orange-Red
      case GameElement.PLAYER_START:
        return 0xFFFF00; // Yellow
      case GameElement.DANGER:
        return 0xFF0000; // Red
      default:
        return 0xFFFFFF; // White fallback
    }
  }

  function getSpritePath(element: GameElement): string | null {
    switch (element) {
      case GameElement.ENEMY:
        return 'sprites/enemy.png';
      case GameElement.DANGER:
        return 'sprites/danger.png';
      case GameElement.PLAYER_FINISH:
        return 'sprites/finish.png';
      case GameElement.TREASURE:
        return 'sprites/treasure.png';
      case GameElement.KEY:
        return 'sprites/key.png';
      case GameElement.DOOR:
        return 'sprites/door.png';
      case GameElement.STAIRS:
        return 'sprites/stairs.png';
      case GameElement.FIRE:
        return 'sprites/blade.png'; // Use blade sprite for fire
      case GameElement.GRASS:
        return null; // Will create colored quad instead
      case GameElement.WATER:
        return null; // Will create colored quad instead
      case GameElement.PLAYER_START:
        return null; // Will create colored quad instead
      default:
        return null;
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

    // Debug mode toggle
    if (keysPressed.has('keyg')) {
      debugMode = !debugMode;
      console.log(`${debugMode ? '🔧 DEBUG MODE ENABLED' : '🔧 DEBUG MODE DISABLED'}`);
      if (debugMode) {
        console.log('Debug features:');
        console.log('- Red wireframes show wall boundaries');
        console.log('- Colored spheres show collision points');
        console.log('- Console logs show collision detection details');
        console.log('- Press G again to disable debug mode');
        // Reset debug tracking
        window.lastDebugPosition = null;
        // Recreate debug visualization
        createDebugSpheres();
      } else {
        // Reset debug tracking
        window.lastDebugPosition = null;
        // Clear debug visualization
        createDebugSpheres();
      }
      // Remove debug mode key from pressed keys to prevent continuous toggling
      keysPressed.delete('keyg');
    }

    // Mouse look rotation (if pointer is locked)
    if (isPointerLocked) {
      player.angle += mouseX * 0.002;
      mouseX = 0; // Reset mouse movement
    }

    // Check collision and update position
    if (isValidPosition(newX, newY)) {
      player.x = newX;
      player.y = newY;
    } else {
      // Try to slide along walls if direct movement is blocked
      trySlideAlongWalls(newX, newY);
    }

    // Update camera position
    camera.position.set(player.x, 1, player.y);
    const lookX = player.x + Math.cos(player.angle) * 2;
    const lookZ = player.y + Math.sin(player.angle) * 2;
    camera.lookAt(lookX, 1, lookZ);

    // Update player torch position
    if ((scene as any).playerTorch) {
      (scene as any).playerTorch.position.set(player.x, 1.5, player.y);
    }
  }

  function isValidPosition(x: number, y: number): boolean {
    // Debug logging for collision detection calls (only for first call per frame to reduce spam)
    if (debugMode && (!window.lastDebugPosition || window.lastDebugPosition !== `${x.toFixed(3)},${y.toFixed(3)}`)) {
      console.log(`🔍 Checking position: (${x.toFixed(3)}, ${y.toFixed(3)})`);
      console.log(`   Player collision radius: ${PLAYER_COLLISION_RADIUS}`);
      window.lastDebugPosition = `${x.toFixed(3)},${y.toFixed(3)}`;
    }

    // Check bounds first with a small buffer
    const buffer = 0.05;
    if (x < buffer || x >= currentGameMap[0].length - buffer ||
        y < buffer || y >= currentGameMap.length - buffer) {
      if (debugMode) {
        console.log(`❌ OUT OF BOUNDS: Position (${x.toFixed(3)}, ${y.toFixed(3)}) outside map bounds`);
      }
      return false;
    }

    // Use comprehensive collision points for reliable wall detection
    // Points are arranged in a circle plus diagonals for better coverage
    const collisionPoints = [
      { x: x, y: y, name: 'Center' }, // Center
      { x: x + PLAYER_COLLISION_RADIUS * 0.7, y: y, name: 'Right' },
      { x: x - PLAYER_COLLISION_RADIUS * 0.7, y: y, name: 'Left' },
      { x: x, y: y + PLAYER_COLLISION_RADIUS * 0.7, name: 'Front' },
      { x: x, y: y - PLAYER_COLLISION_RADIUS * 0.7, name: 'Back' },
      { x: x + PLAYER_COLLISION_RADIUS * 0.5, y: y + PLAYER_COLLISION_RADIUS * 0.5, name: 'Front-Right' },
      { x: x - PLAYER_COLLISION_RADIUS * 0.5, y: y + PLAYER_COLLISION_RADIUS * 0.5, name: 'Front-Left' },
      { x: x + PLAYER_COLLISION_RADIUS * 0.5, y: y - PLAYER_COLLISION_RADIUS * 0.5, name: 'Back-Right' },
      { x: x - PLAYER_COLLISION_RADIUS * 0.5, y: y - PLAYER_COLLISION_RADIUS * 0.5, name: 'Back-Left' },
    ];

    // Debug: Log collision points
    if (debugMode && (!window.lastDebugPosition || window.lastDebugPosition !== `${x.toFixed(3)},${y.toFixed(3)}`)) {
      console.log('   Collision points:');
      collisionPoints.forEach((point, index) => {
        console.log(`     ${point.name}: (${point.x.toFixed(3)}, ${point.y.toFixed(3)})`);
      });
    }

    // Check all collision points
    for (const point of collisionPoints) {
      // Get the grid cell this point is in
      const gridX = Math.floor(point.x);
      const gridY = Math.floor(point.y);

      // Check the current cell and all 8 adjacent cells
      // This ensures we catch walls even when the player is near cell boundaries
      const cellsToCheck = [
        { x: gridX, y: gridY },           // Current cell
        { x: gridX + 1, y: gridY },       // Right
        { x: gridX - 1, y: gridY },       // Left
        { x: gridX, y: gridY + 1 },       // Front
        { x: gridX, y: gridY - 1 },       // Back
        { x: gridX + 1, y: gridY + 1 },   // Front-Right
        { x: gridX + 1, y: gridY - 1 },   // Back-Right
        { x: gridX - 1, y: gridY + 1 },   // Front-Left
        { x: gridX - 1, y: gridY - 1 },   // Back-Left
      ];

      // Filter to valid grid cells only
      const validCells = cellsToCheck.filter(cell =>
        cell.x >= 0 && cell.x < currentGameMap[0].length &&
        cell.y >= 0 && cell.y < currentGameMap.length
      );

      // Check each valid cell for walls
      for (const cell of validCells) {
        const element = currentGameMap[cell.y][cell.x];
        const properties = getElementProperties(element);

        if (!properties.walkable) {
          // Check if the collision point is within this wall's 3D bounding box
          // Wall occupies: [cell.x - 0.5, cell.x + 0.5] x [0, WALL_HEIGHT] x [cell.y - 0.5, cell.y + 0.5]
          const wallMinX = cell.x - 0.5;
          const wallMaxX = cell.x + 0.5;
          const wallMinY = cell.y - 0.5;
          const wallMaxY = cell.y + 0.5;

          // Use strict inequalities to avoid edge case issues
          // Allow a tiny tolerance for floating point precision
          const tolerance = 0.001;
          if (point.x > wallMinX + tolerance && point.x < wallMaxX - tolerance &&
              point.y > wallMinY + tolerance && point.y < wallMaxY - tolerance) {
            // Debug logging for collision detection
            if (debugMode) {
              console.log(`🔴 COLLISION: ${point.name} point (${point.x.toFixed(3)}, ${point.y.toFixed(3)}) inside wall at cell (${cell.x}, ${cell.y})`);
              console.log(`   Wall bounds: X[${wallMinX.toFixed(3)}, ${wallMaxX.toFixed(3)}] Y[${wallMinY.toFixed(3)}, ${wallMaxY.toFixed(3)}]`);
              console.log(`   Player position: (${player.x.toFixed(3)}, ${player.y.toFixed(3)})`);
              console.log(`   Distance from player: dx=${(point.x - player.x).toFixed(3)}, dy=${(point.y - player.y).toFixed(3)}`);
            }
            return false;
          }
        }
      }
    }

    // Debug logging for successful position validation
    if (debugMode) {
      console.log(`✅ POSITION VALID: (${x.toFixed(3)}, ${y.toFixed(3)})`);
    }

    return true;
  }

  function trySlideAlongWalls(targetX: number, targetY: number): void {
    const currentX = player.x;
    const currentY = player.y;

    // Calculate movement vector and normalize it
    const deltaX = targetX - currentX;
    const deltaY = targetY - currentY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    if (distance === 0) return; // No movement attempted

    const normalizedDeltaX = deltaX / distance;
    const normalizedDeltaY = deltaY / distance;

    // Maximum distance to attempt sliding
    const maxSlideDistance = PLAYER_COLLISION_RADIUS * 0.8;
    const slideStep = 0.03; // Smaller step for finer control

    if (debugMode) {
      console.log(`🎯 Attempting to slide from (${currentX.toFixed(3)}, ${currentY.toFixed(3)}) towards (${targetX.toFixed(3)}, ${targetY.toFixed(3)})`);
      console.log(`   Movement vector: (${deltaX.toFixed(3)}, ${deltaY.toFixed(3)}) distance: ${distance.toFixed(3)}`);
    }

    // Try sliding perpendicular to the movement direction
    // This creates a "sliding" effect along walls
    const perpendicularX = -normalizedDeltaY;
    const perpendicularY = normalizedDeltaX;

    // Try both directions perpendicular to movement
    const slideDirections = [
      { x: perpendicularX, y: perpendicularY, name: 'Perpendicular +' },
      { x: -perpendicularX, y: -perpendicularY, name: 'Perpendicular -' },
      { x: normalizedDeltaX * 0.5, y: normalizedDeltaY * 0.5, name: 'Forward Half' },
      { x: perpendicularX * 0.7, y: perpendicularY * 0.7, name: 'Perp 70%' },
      { x: -perpendicularX * 0.7, y: -perpendicularY * 0.7, name: 'Perp -70%' },
    ];

    // First try smaller slides for smoother movement
    for (let slideDist = slideStep; slideDist <= maxSlideDistance; slideDist += slideStep) {
      for (const dir of slideDirections) {
        const testX = currentX + dir.x * slideDist;
        const testY = currentY + dir.y * slideDist;

        if (isValidPosition(testX, testY)) {
          player.x = testX;
          player.y = testY;
          if (debugMode) {
            console.log(`✅ SLID ${dir.name}: distance ${slideDist.toFixed(3)} to (${testX.toFixed(3)}, ${testY.toFixed(3)})`);
          }
          return;
        }
      }
    }

    // If perpendicular sliding fails, try moving directly towards the target in smaller increments
    // This handles cases where we're trying to move into a corner or tight space
    const directSlideDirections = [
      { x: normalizedDeltaX, y: normalizedDeltaY, name: 'Direct' },
      { x: normalizedDeltaX * 0.3, y: normalizedDeltaY * 0.3, name: 'Direct 30%' },
      { x: normalizedDeltaX * 0.1, y: normalizedDeltaY * 0.1, name: 'Direct 10%' },
    ];

    for (let slideDist = slideStep; slideDist <= maxSlideDistance * 0.5; slideDist += slideStep) {
      for (const dir of directSlideDirections) {
        const testX = currentX + dir.x * slideDist;
        const testY = currentY + dir.y * slideDist;

        if (isValidPosition(testX, testY)) {
          player.x = testX;
          player.y = testY;
          if (debugMode) {
            console.log(`✅ SLID ${dir.name}: distance ${slideDist.toFixed(3)} to (${testX.toFixed(3)}, ${testY.toFixed(3)})`);
          }
          return;
        }
      }
    }

    // Last resort: try very small movements in cardinal directions
    const cardinalDirections = [
      { x: slideStep, y: 0, name: '→' },
      { x: -slideStep, y: 0, name: '←' },
      { x: 0, y: slideStep, name: '↑' },
      { x: 0, y: -slideStep, name: '↓' },
    ];

    for (const dir of cardinalDirections) {
      const testX = currentX + dir.x;
      const testY = currentY + dir.y;

      if (isValidPosition(testX, testY)) {
        player.x = testX;
        player.y = testY;
        if (debugMode) {
          console.log(`✅ MICRO-SLID ${dir.name}: to (${testX.toFixed(3)}, ${testY.toFixed(3)})`);
        }
        return;
      }
    }

    // If all sliding attempts fail, stay put
    if (debugMode) {
      console.log(`❌ CANNOT SLIDE: No valid positions found near (${currentX.toFixed(3)}, ${currentY.toFixed(3)})`);
      console.log(`   Target was: (${targetX.toFixed(3)}, ${targetY.toFixed(3)})`);
    }
  }

  function createDebugSpheres(): void {
    // Clear existing debug spheres
    debugSpheres.forEach(sphere => scene.remove(sphere));
    debugSpheres = [];

    // Clear existing wireframes when recreating debug spheres
    scene.children.forEach(child => {
      if (child.name && child.name.startsWith('wireframe_')) {
        scene.remove(child);
      }
    });

    // Create debug spheres for collision points (9 points now)
    const sphereGeometry = new THREE.SphereGeometry(0.03, 8, 8);

    for (let i = 0; i < 9; i++) {
      const sphereMaterial = new THREE.MeshBasicMaterial({
        color: i === 0 ? 0x00ff00 : i < 5 ? 0xff0000 : 0xffa500, // Green for center, red for cardinal, orange for diagonal
        transparent: true,
        opacity: 0.7
      });
      const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
      sphere.visible = false; // Hidden by default
      scene.add(sphere);
      debugSpheres.push(sphere);
    }

    // Recreate wireframes for all walls if in debug mode
    if (debugMode) {
      for (let y = 0; y < currentGameMap.length; y++) {
        for (let x = 0; x < currentGameMap[y].length; x++) {
          const element = currentGameMap[y][x];
          const properties = getElementProperties(element);

          if (!properties.walkable) {
            // Recreate wireframe for this wall
            const wireframeGeometry = new THREE.BoxGeometry(1, WALL_HEIGHT, 1);
            const wireframeMaterial = new THREE.MeshBasicMaterial({
              color: 0xff0000,
              wireframe: true,
              transparent: true,
              opacity: 0.3
            });
            const wireframe = new THREE.Mesh(wireframeGeometry, wireframeMaterial);
            wireframe.position.set(x, WALL_HEIGHT / 2, y);
            wireframe.name = `wireframe_${x}_${y}`;
            scene.add(wireframe);
          }
        }
      }
    }
  }

  function updateDebugVisualization(): void {
    if (!debugMode || debugSpheres.length === 0) {
      debugSpheres.forEach(sphere => sphere.visible = false);
      return;
    }

    // Show collision points around player (9 points)
    const collisionPoints = [
      { x: player.x, y: player.y }, // Center
      { x: player.x + PLAYER_COLLISION_RADIUS * 0.7, y: player.y }, // Right
      { x: player.x - PLAYER_COLLISION_RADIUS * 0.7, y: player.y }, // Left
      { x: player.x, y: player.y + PLAYER_COLLISION_RADIUS * 0.7 }, // Front
      { x: player.x, y: player.y - PLAYER_COLLISION_RADIUS * 0.7 }, // Back
      { x: player.x + PLAYER_COLLISION_RADIUS * 0.5, y: player.y + PLAYER_COLLISION_RADIUS * 0.5 }, // Front-Right
      { x: player.x - PLAYER_COLLISION_RADIUS * 0.5, y: player.y + PLAYER_COLLISION_RADIUS * 0.5 }, // Front-Left
      { x: player.x + PLAYER_COLLISION_RADIUS * 0.5, y: player.y - PLAYER_COLLISION_RADIUS * 0.5 }, // Back-Right
      { x: player.x - PLAYER_COLLISION_RADIUS * 0.5, y: player.y - PLAYER_COLLISION_RADIUS * 0.5 }, // Back-Left
    ];

    collisionPoints.forEach((point, index) => {
      if (debugSpheres[index]) {
        debugSpheres[index].position.set(point.x, 1.2, point.y);
        debugSpheres[index].visible = true;

        // Color based on collision status
        const tileX = Math.floor(point.x);
        const tileY = Math.floor(point.y);
        if (tileX >= 0 && tileX < currentGameMap[0].length &&
            tileY >= 0 && tileY < currentGameMap.length) {
          const element = currentGameMap[tileY][tileX];
          const properties = getElementProperties(element);
          const material = debugSpheres[index].material as THREE.MeshBasicMaterial;
          material.color.setHex(properties.walkable ? 0x00ff00 : 0xff0000);
        }
      }
    });
  }

  function gameLoop(): void {
    if (!gameRunning) return;

    updatePlayer();
    updateDebugVisualization();
    updateSpriteAnimations();
    updateParticleEffects();
    renderer.render(scene, camera);

    animationId = requestAnimationFrame(gameLoop);
  }

  function updateSpriteAnimations(): void {
    // Animate interactive elements with subtle floating motion
    const time = Date.now() * 0.001; // Convert to seconds

    scene.children.forEach(child => {
      if (child.userData && child.userData.originalY !== undefined && (child as any).animate) {
        const originalY = child.userData.originalY;
        const amplitude = 0.05; // Subtle floating amplitude
        const frequency = 2.0; // Floating speed

        child.position.y = originalY + Math.sin(time * frequency) * amplitude;
      }
    });
  }

  // Input handling
  function handleKeyDown(e: KeyboardEvent) {
    keysPressed.add(e.code.toLowerCase());
  }

  function handleKeyUp(e: KeyboardEvent) {
    keysPressed.delete(e.code.toLowerCase());
  }

  // Mouse event handlers
  function handleMouseMove(e: MouseEvent) {
    if (isPointerLocked) {
      mouseX += e.movementX;
    }
  }

  function handlePointerLockChange() {
    isPointerLocked = (document.pointerLockElement === renderer.domElement);
  }

  function handleClick() {
    if (!isPointerLocked) {
      renderer.domElement.requestPointerLock();
    }
  }

  function setupInputListeners(): void {
    // Event listeners
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('pointerlockchange', handlePointerLockChange);
    renderer.domElement.addEventListener('click', handleClick);
  }

  return component;
}
