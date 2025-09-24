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

  // Postprocessing render targets and quad
  let postRenderTarget: any;
  let postScene: any;
  let postCamera: any;
  let postMaterial: any;
  let usePostprocessing = true;
  let postHud: HTMLDivElement | null = null;
  let postControls: HTMLDivElement | null = null;
  let paletteSelect: HTMLSelectElement | null = null;

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
  const BASE_WIDTH = 240;
  const BASE_HEIGHT = 160;
  const SCALE_FACTOR = 1; // Upscale to 960x640
  const DISPLAY_SCALE = 4; // final on-screen scale (crisp, nearest)
  const WALL_HEIGHT = 2.0;
  const MOVE_SPEED = 0.05;
  const ROTATE_SPEED = 0.03;
  const PLAYER_COLLISION_RADIUS = 0.18; // Reduced for smoother movement in tight corridors

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
  const glowSprites: THREE.Sprite[] = [];

  // Visibility/occlusion data
  const VISIBILITY_RADIUS = 10;
  let visibilityFrameCounter = 0;
  const VISIBILITY_UPDATE_INTERVAL = 2; // Update every 2 frames
  const wallMeshMap: Map<string, THREE.Mesh> = new Map();

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

    // Initialize Three.js scene
    await setupThreeJS();

    // Create the dungeon geometry
    createDungeon();

    // In case the spawn is blocked, relocate to nearest walkable tile
    ensureSpawnAccessible();

    // Setup input event listeners
    setupInputListeners();

    // Start the game loop
    gameLoop();
  }

  async function setupThreeJS(): Promise<void> {
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x202030);

    // Create camera
    camera = new THREE.PerspectiveCamera(75, BASE_WIDTH / BASE_HEIGHT, 0.1, 1000);
    camera.far = 21; // near the 20m fog distance to avoid popping
    camera.updateProjectionMatrix();
    camera.position.set(player.x, 1, player.y);
    camera.lookAt(player.x + Math.cos(player.angle), 1, player.y + Math.sin(player.angle));

    // Create renderer with upscaling
    renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    renderer.setSize(BASE_WIDTH, BASE_HEIGHT);
    renderer.domElement.style.width = `${BASE_WIDTH * DISPLAY_SCALE}px`;
    renderer.domElement.style.height = `${BASE_HEIGHT * DISPLAY_SCALE}px`;
    renderer.domElement.style.imageRendering = 'pixelated';
    (renderer.domElement.style as any)['imageRendering'] = 'pixelated';
    renderer.domElement.style.setProperty('image-rendering', 'pixelated');
    renderer.domElement.style.setProperty('image-rendering', 'crisp-edges');
    renderer.setPixelRatio(1);

    // Modern color and tone mapping
    if ((renderer as any).outputColorSpace !== undefined) {
      (renderer as any).outputColorSpace = THREE.SRGBColorSpace;
    } else if ((renderer as any).outputEncoding !== undefined) {
      (renderer as any).outputEncoding = THREE.sRGBEncoding;
    }
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.useLegacyLights = false;

    // Advanced lighting system
    setupLighting();

    // Enable shadows
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Add renderer to DOM
    component.domElement.appendChild(renderer.domElement);
    (component.domElement as HTMLElement).style.display = 'inline-block';
    (component.domElement as HTMLElement).style.lineHeight = '0';

    // Create low-res render target for pixel-art upscale
    postRenderTarget = new THREE.WebGLRenderTarget(BASE_WIDTH, BASE_HEIGHT, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: true,
      stencilBuffer: false
    });

    // Fullscreen quad and shader
    postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    postScene = new THREE.Scene();

    postMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: postRenderTarget.texture },
        resolution: { value: new THREE.Vector2(BASE_WIDTH, BASE_HEIGHT) },
        time: { value: 0 },
        saturation: { value: 1.25 },
        contrast: { value: 1.1 },
        vignette: { value: 0.2 },
        bloomStrength: { value: 0.6 },
        bloomThreshold: { value: 0.7 },
        ditherAmount: { value: 0.02 },
        paletteMode: { value: 0 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform sampler2D tDiffuse;
        uniform vec2 resolution;
        uniform float time;
        uniform float saturation;
        uniform float contrast;
        uniform float vignette;
        uniform float bloomStrength;
        uniform float bloomThreshold;
        uniform float ditherAmount;
        uniform int paletteMode; // 0 None, 1 GameBoy, 2 CRT, 3 Retro16

        // Bayer 4x4 matrix for ordered dithering
        float bayer(vec2 uv) {
          int x = int(mod(floor(uv.x), 4.0));
          int y = int(mod(floor(uv.y), 4.0));
          int index = x + y * 4;
          int mat[16];
          mat[0]=0; mat[1]=8; mat[2]=2; mat[3]=10;
          mat[4]=12; mat[5]=4; mat[6]=14; mat[7]=6;
          mat[8]=3; mat[9]=11; mat[10]=1; mat[11]=9;
          mat[12]=15; mat[13]=7; mat[14]=13; mat[15]=5;
          return float(mat[index]) / 16.0;
        }

        vec3 saturateColor(vec3 color, float s) {
          float l = dot(color, vec3(0.2126, 0.7152, 0.0722));
          return mix(vec3(l), color, s);
        }

        vec3 applyPalette(vec3 c) {
          if (paletteMode == 0) return c;
          if (paletteMode == 1) {
            // Game Boy 4-color palette
            vec3 p0 = vec3(0.055, 0.094, 0.071);
            vec3 p1 = vec3(0.214, 0.353, 0.235);
            vec3 p2 = vec3(0.494, 0.706, 0.400);
            vec3 p3 = vec3(0.800, 0.949, 0.565);
            float g = dot(c, vec3(0.299, 0.587, 0.114));
            if (g < 0.25) return p0; else if (g < 0.5) return p1; else if (g < 0.75) return p2; else return p3;
          }
          if (paletteMode == 2) {
            // CRT-ish: slight scanline and phosphor tint
            float scan = 0.08 * sin(vUv.y * resolution.y * 3.14159);
            c *= 1.0 - scan;
            c *= vec3(1.05, 1.0, 1.1);
            return clamp(c, 0.0, 1.0);
          }
          if (paletteMode == 3) {
            // 16-color retro quantization (simple)
            vec3 pal[16];
            pal[0]=vec3(0.0,0.0,0.0); pal[1]=vec3(0.2,0.2,0.2); pal[2]=vec3(0.4,0.4,0.4); pal[3]=vec3(0.6,0.6,0.6);
            pal[4]=vec3(0.8,0.8,0.8); pal[5]=vec3(1.0,1.0,1.0); pal[6]=vec3(1.0,0.0,0.0); pal[7]=vec3(0.0,1.0,0.0);
            pal[8]=vec3(0.0,0.0,1.0); pal[9]=vec3(1.0,1.0,0.0); pal[10]=vec3(1.0,0.0,1.0); pal[11]=vec3(0.0,1.0,1.0);
            pal[12]=vec3(1.0,0.5,0.0); pal[13]=vec3(0.5,0.0,1.0); pal[14]=vec3(0.2,0.9,0.9); pal[15]=vec3(0.9,0.2,0.6);
            float best = 1e9; int bi = 0;
            for (int i=0;i<16;i++) {
              float d = dot(c - pal[i], c - pal[i]);
              if (d < best) { best = d; bi = i; }
            }
            return pal[bi];
          }
          return c;
        }

        void main() {
          vec2 texel = 1.0 / resolution;
          // Snap UVs to texel grid for crisp pixels
          vec2 snappedUv = (floor(vUv * resolution) + 0.5) * texel;
          vec4 base = texture2D(tDiffuse, snappedUv);

          // Simple bright-pass and small-kernel bloom
          vec3 c = base.rgb;
          float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
          vec3 bright = max(c - bloomThreshold, 0.0);
          vec3 blur = (
            texture2D(tDiffuse, snappedUv + vec2(texel.x, 0.0)).rgb +
            texture2D(tDiffuse, snappedUv + vec2(-texel.x, 0.0)).rgb +
            texture2D(tDiffuse, snappedUv + vec2(0.0, texel.y)).rgb +
            texture2D(tDiffuse, snappedUv + vec2(0.0, -texel.y)).rgb
          ) * 0.25;
          vec3 bloom = bright * blur * bloomStrength;
          c += bloom;

          // Vibrancy
          c = saturateColor(c, saturation);
          c = (c - 0.5) * contrast + 0.5;

          // Palette
          c = applyPalette(c);

          // Vignette
          float dist = distance(vUv, vec2(0.5));
          float vig = 1.0 - smoothstep(0.6, 1.0, dist);
          c *= mix(1.0, vig, vignette);

          // Ordered dithering
          float d = bayer(vUv * resolution) - 0.5;
          c += ditherAmount * d;

          gl_FragColor = vec4(c, 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false
    });

    const postQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMaterial);
    postScene.add(postQuad);

    // Palette hotkeys: 1 None, 2 GameBoy, 3 CRT, 4 Retro16
    window.addEventListener('keydown', (ev: KeyboardEvent) => {
      const k = (ev.key || '').toLowerCase();
      if (k === '1' && postMaterial) postMaterial.uniforms.paletteMode.value = 0;
      if (k === '2' && postMaterial) postMaterial.uniforms.paletteMode.value = 1;
      if (k === '3' && postMaterial) postMaterial.uniforms.paletteMode.value = 2;
      if (k === '4' && postMaterial) postMaterial.uniforms.paletteMode.value = 3;
      if (k === 'p') usePostprocessing = !usePostprocessing;
      updatePostHud();
    });

    // HUD overlay to show post status and palette
    postHud = document.createElement('div');
    postHud.style.cssText = 'position:absolute; top:6px; right:8px; padding:4px 6px; background:rgba(0,0,0,0.5); color:#fff; font:12px monospace; border-radius:3px; z-index: 9999;';
    (component.domElement as HTMLElement).style.position = 'relative';
    component.domElement.appendChild(postHud);

    // On-screen controls (guaranteed toggles)
    postControls = document.createElement('div');
    postControls.style.cssText = 'position:absolute; top:6px; left:8px; display:flex; gap:6px; align-items:center; z-index: 10000; background:rgba(0,0,0,0.35); padding:4px 6px; border-radius:3px;';

    const toggleBtn = document.createElement('button');
    toggleBtn.textContent = 'Toggle Post';
    toggleBtn.style.cssText = 'font:12px monospace; cursor:pointer;';
    toggleBtn.onclick = (e) => { e.stopPropagation(); usePostprocessing = !usePostprocessing; updatePostHud(); };

    paletteSelect = document.createElement('select');
    paletteSelect.style.cssText = 'font:12px monospace;';
    ;['None','GameBoy','CRT','Retro16'].forEach((label, idx) => {
      const opt = document.createElement('option');
      opt.value = String(idx);
      opt.text = label;
      paletteSelect!.appendChild(opt);
    });
    paletteSelect.onchange = (e) => {
      const v = parseInt((e.target as HTMLSelectElement).value, 10) | 0;
      if (postMaterial) postMaterial.uniforms.paletteMode.value = v;
      updatePostHud();
    };

    postControls.appendChild(toggleBtn);
    postControls.appendChild(paletteSelect);
    component.domElement.appendChild(postControls);

    updatePostHud();
  }

  function setupLighting(): void {
    // Ambient and hemisphere fill for general visibility
    const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x404040, 0.6);
    scene.add(hemi);

    const ambient = new THREE.AmbientLight(0xffffff, 0.2);
    scene.add(ambient);

    // Player torch light (follows player)
    const playerTorch = new THREE.PointLight(0xffc866, 2.2, 18);
    playerTorch.position.set(player.x, 1.5, player.y);
    playerTorch.castShadow = true;

    // Enhanced shadow settings
    playerTorch.shadow.mapSize.width = 2048;
    playerTorch.shadow.mapSize.height = 2048;
    playerTorch.shadow.camera.near = 0.1;
    playerTorch.shadow.camera.far = 24;
    playerTorch.shadow.bias = -0.0002;

    scene.add(playerTorch);

    // Store reference to player torch for updates
    (scene as any).playerTorch = playerTorch;

    // Softer, farther fog so the scene is not too dark
    scene.fog = new THREE.Fog(0x202030, 8, 20);
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

    // Initial visibility update to prevent overdraw on first frames
    updateVisibility();
  }

  function createFloor(width: number, height: number): void {
    // Create floor geometry
    const floorGeometry = new THREE.PlaneGeometry(width, height);

    // Load floor texture
    const floorTexture = textureLoader.load('textures/floor_stone.png');
    floorTexture.wrapS = THREE.RepeatWrapping;
    floorTexture.wrapT = THREE.RepeatWrapping;
    floorTexture.repeat.set(width / 4, height / 4);
    // Improve texture quality and color accuracy
    if ((floorTexture as any).colorSpace !== undefined) {
      (floorTexture as any).colorSpace = THREE.SRGBColorSpace;
    } else if ((floorTexture as any).encoding !== undefined) {
      (floorTexture as any).encoding = THREE.sRGBEncoding;
    }
    if (renderer && renderer.capabilities && renderer.capabilities.getMaxAnisotropy) {
      floorTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    }

    const floorMaterial = new THREE.MeshStandardMaterial({
      map: floorTexture,
      roughness: 0.95,
      metalness: 0.0,
      emissive: new THREE.Color(0x1a1a1a),
      emissiveIntensity: 0.08
    });

    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(width / 2 - 0.5, 0, height / 2 - 0.5);
    floor.receiveShadow = true;
    floor.frustumCulled = false; // ensure floor remains visible with short far plane
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
    if ((ceilingTexture as any).colorSpace !== undefined) {
      (ceilingTexture as any).colorSpace = THREE.SRGBColorSpace;
    } else if ((ceilingTexture as any).encoding !== undefined) {
      (ceilingTexture as any).encoding = THREE.sRGBEncoding;
    }
    if (renderer && renderer.capabilities && renderer.capabilities.getMaxAnisotropy) {
      ceilingTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    }

    const ceilingMaterial = new THREE.MeshStandardMaterial({
      map: ceilingTexture,
      roughness: 0.98,
      metalness: 0.0,
      emissive: new THREE.Color(0x0e0e12),
      emissiveIntensity: 0.06
    });

    const ceiling = new THREE.Mesh(ceilingGeometry, ceilingMaterial);
    ceiling.rotation.x = Math.PI / 2; // Rotate to face down
    ceiling.position.set(width / 2 - 0.5, WALL_HEIGHT, height / 2 - 0.5);
    ceiling.receiveShadow = true;
    ceiling.frustumCulled = false; // ensure ceiling remains visible
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
    const baseMatParams = { map: wallTexture, roughness: 0.9, metalness: 0.0, emissive: new THREE.Color(0x121820), emissiveIntensity: 0.1 };
    const wallMaterial = [
      new THREE.MeshStandardMaterial(baseMatParams),
      new THREE.MeshStandardMaterial(baseMatParams),
      new THREE.MeshStandardMaterial(baseMatParams),
      new THREE.MeshStandardMaterial(baseMatParams),
      new THREE.MeshStandardMaterial(baseMatParams),
      new THREE.MeshStandardMaterial(baseMatParams)
    ];

    const wall = new THREE.Mesh(wallGeometry, wallMaterial);
    // Position wall at grid coordinates (x, y)
    wall.position.set(x, WALL_HEIGHT / 2, y);
    wall.castShadow = true;
    wall.receiveShadow = true;
    wall.rotation.y = 0;

    wall.name = `wall_${x}_${y}`;

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

    // Track wall for occlusion/visibility control
    wallMeshMap.set(`${x},${y}`, wall);

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
    // Improve color and sampling for readability
    if ((texture as any).colorSpace !== undefined) {
      (texture as any).colorSpace = THREE.SRGBColorSpace;
    } else if ((texture as any).encoding !== undefined) {
      (texture as any).encoding = THREE.sRGBEncoding;
    }
    texture.generateMipmaps = true;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    if (renderer && renderer.capabilities && renderer.capabilities.getMaxAnisotropy) {
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    }
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
        transparent: true,
        fog: true
      });
      const sprite = new THREE.Sprite(spriteMaterial);
      sprite.position.set(x, 1, y);
      sprite.scale.set(0.8, 0.8, 0.8);
      scene.add(sprite);

      // Add emissive glow for certain elements
      if (element === GameElement.FIRE || element === GameElement.TREASURE) {
        const glowColor = element === GameElement.FIRE ? 0xffa200 : 0xffee66;
        const glowTex = textureLoader.load('sprites/treasure.png');
        const glowMat = new THREE.SpriteMaterial({
          map: glowTex,
          color: glowColor,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          fog: true,
          opacity: 0.8
        });
        const glow = new THREE.Sprite(glowMat);
        glow.position.set(x, 1, y);
        glow.scale.set(1.1, 1.1, 1.1);
        (glow as any).pulse = true;
        scene.add(glow);
        glowSprites.push(glow);
      }
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
      side: THREE.DoubleSide,
      fog: true
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
          float computedSize = size * pixelRatio * (300.0 / max(0.1, -mvPosition.z));
          gl_PointSize = min(computedSize, 64.0);
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
        return null; // Disable particles at player start to avoid huge near-camera points
      default:
        return null;
    }
  }

  function createFireLight(x: number, y: number): void {
    const fireLight = new THREE.PointLight(0xffaa44, 0.7, 7);
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

    // Update player torch position and add subtle flicker
    if ((scene as any).playerTorch) {
      const torch = (scene as any).playerTorch as any;
      torch.position.set(player.x, 1.5, player.y);
      const t = Date.now() * 0.002;
      torch.intensity = 2.0 + Math.sin(t * 3.2) * 0.2 + Math.sin(t * 5.7) * 0.1;
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
          const tolerance = 0.02; // Relaxed tolerance so corridors don't block movement
          if (point.x > wallMinX + tolerance && point.x < wallMaxX - tolerance &&
              point.y > wallMinY + tolerance && point.y < wallMaxY - tolerance) {
            // Debug logging for collision detection
            if (debugMode) {
              console.log(`🔴 COLLISION: ${point.name} point (${point.x.toFixed(3)}, ${point.y.toFixed(3)}) inside wall at cell (${cell.x}, ${cell.y})`);
              console.log(`   Wall bounds: X[${wallMinX.toFixed(3)}, ${wallMaxX.toFixed(3)}] Y[${wallMinY.toFixed(3)}, ${wallMaxY.toFixed(3)}]`);
              console.log(`   Player position: (${player.x.toFixed(3)}, ${player.y.toFixed(3)})`);
              console.log(`   Distance from player: dx=${(point.x - player.x).toFixed(3)}, dy=${(point.y - player.y).toFixed(3)})`);
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

    if (usePostprocessing && postRenderTarget && postMaterial) {
      // Render to low-res target, then upscale with post shader
      renderer.setRenderTarget(postRenderTarget);
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);

      // Update shader time and ensure texture is current
      postMaterial.uniforms.time.value = Date.now() * 0.001;
      postMaterial.uniforms.tDiffuse.value = postRenderTarget.texture;

      renderer.render(postScene, postCamera);
    } else {
      // Fallback direct render
      renderer.render(scene, camera);
    }

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

    // Pulse glow sprites
    glowSprites.forEach((s, idx) => {
      const base = 1.0 + Math.sin(time * 4.0 + idx) * 0.1;
      s.scale.set(base, base, base);
      const mat = s.material as any;
      if (mat && mat.opacity !== undefined) {
        mat.opacity = 0.6 + Math.sin(time * 3.5 + idx) * 0.2;
      }
    });
  }

  function isOccludedByWalls(targetX: number, targetY: number): boolean {
    // DDA through grid from player to target center
    const startX = player.x;
    const startY = player.y;
    const endX = targetX + 0.0; // centers are integer already
    const endY = targetY + 0.0;

    const dx = endX - startX;
    const dy = endY - startY;
    const steps = Math.max(Math.abs(dx), Math.abs(dy)) * 6; // higher sampling density
    if (steps <= 0) return false;

    const stepX = dx / steps;
    const stepY = dy / steps;

    let x = startX;
    let y = startY;

    for (let i = 0; i < steps; i++) {
      x += stepX;
      y += stepY;

      const gridX = Math.floor(x);
      const gridY = Math.floor(y);

      if (gridX === targetX && gridY === targetY) {
        return false; // reached target cell without hitting another wall
      }

      if (gridX < 0 || gridY < 0 || gridY >= currentGameMap.length || gridX >= currentGameMap[0].length) {
        return true; // outside map considered blocked
      }

      const element = currentGameMap[gridY][gridX];
      const properties = getElementProperties(element);
      if (!properties.walkable) {
        // Hit a wall before reaching target
        return true;
      }
    }

    return false;
  }

  function updateVisibility(): void {
    // Disabled: rely on distance fog for fading at ~20m; no manual culling
    return;
  }

  function ensureSpawnAccessible(): void {
    if (isValidPosition(player.x, player.y)) return;

    // Search outward for first walkable tile
    const maxRadius = 5;
    for (let r = 1; r <= maxRadius; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const tx = Math.floor(player.x) + dx;
          const ty = Math.floor(player.y) + dy;
          if (ty >= 0 && ty < currentGameMap.length && tx >= 0 && tx < currentGameMap[0].length) {
            const properties = getElementProperties(currentGameMap[ty][tx]);
            if (properties.walkable) {
              const nx = tx + 0.5;
              const ny = ty + 0.5;
              if (isValidPosition(nx, ny)) {
                player.x = nx;
                player.y = ny;
                camera.position.set(player.x, 1, player.y);
                if ((scene as any).playerTorch) {
                  (scene as any).playerTorch.position.set(player.x, 1.5, player.y);
                }
                return;
              }
            }
          }
        }
      }
    }
  }

  // Input handling
  function handleKeyDown(e: KeyboardEvent) {
    keysPressed.add(e.code.toLowerCase());
    const k = (e.key || '').toLowerCase();
    switch (k) {
      case 'w': keysPressed.add('keyw'); break;
      case 'a': keysPressed.add('keya'); break;
      case 's': keysPressed.add('keys'); break;
      case 'd': keysPressed.add('keyd'); break;
      case 'arrowup': keysPressed.add('arrowup'); break;
      case 'arrowdown': keysPressed.add('arrowdown'); break;
      case 'arrowleft': keysPressed.add('arrowleft'); break;
      case 'arrowright': keysPressed.add('arrowright'); break;
      case 'q': keysPressed.add('keyq'); break;
      case 'e': keysPressed.add('keye'); break;
    }
  }

  function handleKeyUp(e: KeyboardEvent) {
    keysPressed.delete(e.code.toLowerCase());
    const k = (e.key || '').toLowerCase();
    switch (k) {
      case 'w': keysPressed.delete('keyw'); break;
      case 'a': keysPressed.delete('keya'); break;
      case 's': keysPressed.delete('keys'); break;
      case 'd': keysPressed.delete('keyd'); break;
      case 'arrowup': keysPressed.delete('arrowup'); break;
      case 'arrowdown': keysPressed.delete('arrowdown'); break;
      case 'arrowleft': keysPressed.delete('arrowleft'); break;
      case 'arrowright': keysPressed.delete('arrowright'); break;
      case 'q': keysPressed.delete('keyq'); break;
      case 'e': keysPressed.delete('keye'); break;
    }
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
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('pointerlockchange', handlePointerLockChange);
    renderer.domElement.addEventListener('click', handleClick);
  }

  function updatePostHud(): void {
    if (!postHud || !postMaterial) return;
    const mode = postMaterial.uniforms.paletteMode.value;
    const modeName = mode === 0 ? 'None' : mode === 1 ? 'GameBoy' : mode === 2 ? 'CRT' : 'Retro16';
    postHud.textContent = `Post: ${usePostprocessing ? 'ON' : 'OFF'} | Palette: ${modeName} (1-4) | Toggle Post: P`;
    if (paletteSelect) paletteSelect.value = String(mode);
  }

  return component;
}
