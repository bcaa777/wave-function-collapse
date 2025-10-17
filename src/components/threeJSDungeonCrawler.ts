import { buildDomTree } from "../util";
import { IComponent } from "./component";
import { GameElement, getElementProperties } from "../colorMapping";
import { buildHeightMap, sampleHeightBilinear, isWaterEdge, buildCeilingMap, sampleCeilingBilinear } from './terrain';
import { getSettings, onSettingsChange } from '../gameSettings';
import { generateProceduralSprite } from './proceduralSprites';

// Use global THREE object loaded from CDN
declare const THREE: any;

// Extend window interface for debug tracking
declare global {
  interface Window {
    lastDebugPosition?: string | null;
  }
}

export interface IComponentThreeJSDungeonCrawler extends IComponent {
  startGame(gameMap: GameElement[][], playerStart: { x: number; y: number }, heightOverrideMeters?: number[][]): Promise<void>;
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
    startGame: async (gameMap: GameElement[][], playerStart: { x: number; y: number }, heightOverrideMeters?: number[][]) => {
      await initializeGame(gameMap, playerStart, heightOverrideMeters);
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
  // UI container for mounting the renderer (no HTML overlays)
  let uiContainer: HTMLDivElement;
  // HUD rendered inside the 3D scene
  let hudHealthCanvas: HTMLCanvasElement;
  let hudHealthCtx: CanvasRenderingContext2D | null;
  let hudHealthTexture: any; // THREE.CanvasTexture
  let hudHealthSprite: any;  // THREE.Sprite
  let hudMinimapCanvas: HTMLCanvasElement;
  let hudMinimapCtx: CanvasRenderingContext2D | null;
  let hudMinimapTexture: any; // THREE.CanvasTexture
  let hudMinimapSprite: any;  // THREE.Sprite
  // Fancy environment visuals
  let waterMaterials: any[] = []; // THREE.ShaderMaterial[]
  let foamMeshes: any[] = [];
  let grassSwaySprites: any[] = []; // THREE.Sprite[] with sway data
  let glintSprites: any[] = []; // collectible shimmer sprites
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
  let heightMap: number[][] = [];
  let ceilingMap: number[][] = [];
  let stairsGroup: THREE.Group | null = null;
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
  const DISABLE_WALLS = true; // temporarily remove walls (visuals + collisions)
  const MOVE_SPEED = 0.05;
  const ROTATE_SPEED = 0.03;
  // Vertical movement
  let playerVerticalVel = 0;
  const GRAVITY = -9.81 * 0.02; // tuned for frame scale
  const JUMP_VELOCITY = 0.22;
  const STEP_MAX = 0.28; // maximum step height
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

  // Particle systems removed for cleaner visuals and performance
  let fireLights: THREE.PointLight[] = [];

  // Visibility/occlusion data
  const VISIBILITY_RADIUS = 10;
  let visibilityFrameCounter = 0;
  const VISIBILITY_UPDATE_INTERVAL = 2; // Update every 2 frames
  const wallMeshMap: Map<string, THREE.Mesh> = new Map();

  async function initializeGame(gameMap: GameElement[][], playerStart: { x: number; y: number }, heightOverrideMeters?: number[][]): Promise<void> {
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
    heightMap = heightOverrideMeters && heightOverrideMeters.length ? heightOverrideMeters : buildHeightMap(currentGameMap);
    ceilingMap = buildCeilingMap(currentGameMap, heightMap);
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
    camera.far = 300; // expanded for large vertical ranges
    camera.updateProjectionMatrix();
    camera.position.set(player.x, 1, player.y);
    const groundH0 = (heightMap && heightMap.length > 0) ? sampleHeightBilinear(heightMap, player.x, player.y) : 0;
    camera.lookAt(player.x + Math.cos(player.angle), groundH0 + 1, player.y + Math.sin(player.angle));

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
    // Enable shadow mapping
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Modern color and tone mapping
    if ((renderer as any).outputColorSpace !== undefined) {
      (renderer as any).outputColorSpace = THREE.SRGBColorSpace;
    } else if ((renderer as any).outputEncoding !== undefined) {
      (renderer as any).outputEncoding = THREE.sRGBEncoding;
    }
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    // UI container
    uiContainer = document.createElement('div');
    uiContainer.style.position = 'relative';
    uiContainer.style.width = `${BASE_WIDTH * DISPLAY_SCALE}px`;
    uiContainer.style.height = `${BASE_HEIGHT * DISPLAY_SCALE}px`;

    // Mount renderer inside UI container
    uiContainer.appendChild(renderer.domElement);
    // component.domElement is typed as Node; cast to HTMLElement for DOM ops
    const hostEl = component.domElement as unknown as HTMLElement;
    hostEl.innerHTML = '';
    hostEl.appendChild(uiContainer);

    // Create HUD canvases (offscreen) and sprites attached to camera
    // Health bar canvas
    hudHealthCanvas = document.createElement('canvas');
    hudHealthCanvas.width = 128;
    hudHealthCanvas.height = 16;
    hudHealthCtx = hudHealthCanvas.getContext('2d');
    hudHealthTexture = new THREE.CanvasTexture(hudHealthCanvas);
    hudHealthTexture.magFilter = THREE.NearestFilter;
    hudHealthTexture.minFilter = THREE.NearestFilter;
    hudHealthTexture.generateMipmaps = false;
    const hbMat = new THREE.SpriteMaterial({ map: hudHealthTexture, transparent: true, depthWrite: false });
    hudHealthSprite = new THREE.Sprite(hbMat);
    hudHealthSprite.scale.set(0.9, 0.12, 1);
    hudHealthSprite.position.set(0, -0.68, -1.1);
    (hudHealthSprite as any).renderOrder = 9999;
    (hudHealthSprite.material as any).depthTest = false;
    (hudHealthSprite.material as any).depthWrite = false;
    camera.add(hudHealthSprite);
    scene.add(camera); // ensure camera is in scene for children rendering

    // Minimap canvas
    hudMinimapCanvas = document.createElement('canvas');
    hudMinimapCanvas.width = 128;
    hudMinimapCanvas.height = 128;
    hudMinimapCtx = hudMinimapCanvas.getContext('2d');
    hudMinimapTexture = new THREE.CanvasTexture(hudMinimapCanvas);
    hudMinimapTexture.magFilter = THREE.NearestFilter;
    hudMinimapTexture.minFilter = THREE.NearestFilter;
    hudMinimapTexture.generateMipmaps = false;
    const mmMat = new THREE.SpriteMaterial({ map: hudMinimapTexture, transparent: true, depthWrite: false });
    hudMinimapSprite = new THREE.Sprite(mmMat);
    hudMinimapSprite.scale.set(0.42, 0.42, 1);
    hudMinimapSprite.position.set(0.8, 0.55, -1.2);
    (hudMinimapSprite as any).renderOrder = 9999;
    (hudMinimapSprite.material as any).depthTest = false;
    (hudMinimapSprite.material as any).depthWrite = false;
    camera.add(hudMinimapSprite);

    // Blue overlay for underwater effect (hidden by default)
    const overlayCanvas = document.createElement('canvas');
    overlayCanvas.width = 64; overlayCanvas.height = 64; // tiny, pixelated
    const octx = overlayCanvas.getContext('2d');
    if (octx) {
      octx.fillStyle = 'rgba(0,0,0,0)';
      octx.fillRect(0,0,64,64);
    }
    const overlayTex = new THREE.CanvasTexture(overlayCanvas);
    overlayTex.magFilter = THREE.NearestFilter; overlayTex.minFilter = THREE.NearestFilter; overlayTex.generateMipmaps = false;
    const overlayMat = new THREE.SpriteMaterial({ map: overlayTex, transparent: true, depthTest: false, depthWrite: false });
    const overlaySprite = new THREE.Sprite(overlayMat);
    overlaySprite.scale.set(1.6, 0.9, 1);
    overlaySprite.position.set(0, 0, -0.9);
    (overlaySprite as any).renderOrder = 10000;
    camera.add(overlaySprite);
    // Store for updates
    (scene as any).waterOverlay = { canvas: overlayCanvas, ctx: octx, texture: overlayTex, sprite: overlaySprite };
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
    const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x404040, 0.9);
    scene.add(hemi);

    const ambient = new THREE.AmbientLight(0xffffff, 0.35);
    scene.add(ambient);

    // Player torch light (follows player)
    const s = getSettings();
    const playerTorch = new THREE.PointLight(0xffc866, s.playerLightIntensity, 16);
    playerTorch.position.set(player.x, 1.5, player.y);
    playerTorch.castShadow = true;

    // Enhanced shadow settings
    playerTorch.shadow.mapSize.width = 2048;
    playerTorch.shadow.mapSize.height = 2048;
    playerTorch.shadow.camera.near = 0.1;
    playerTorch.shadow.camera.far = 120;
    playerTorch.shadow.bias = -0.0002;

    scene.add(playerTorch);

    // Store reference to player torch for updates
    (scene as any).playerTorch = playerTorch;

    // Softer, farther fog so the scene is not too dark
    scene.fog = new THREE.Fog(0x202030, 18, 80);

    // React to runtime settings changes (light intensity and post)
    onSettingsChange((key) => {
      if (key === 'playerLightIntensity') {
        (scene as any).playerTorch.intensity = getSettings().playerLightIntensity;
      }
    });
  }

  function createDungeon(): void {
    const mapWidth = currentGameMap[0].length;
    const mapHeight = currentGameMap.length;

    // Create floor
    createFloor(mapWidth, mapHeight);

    // Create walls (disabled for now)
    createWalls(mapWidth, mapHeight);

    // Create stairs bridging height gaps between adjacent walkable tiles
    createStairs(mapWidth, mapHeight);

    // Create sprites for interactive elements
    createSprites();

    // Setup fire lights for flame tiles (particles removed)
    createFireLightsForMap();

    // Initialize debug visualization
    createDebugSpheres();

    // Initial visibility update to prevent overdraw on first frames
    updateVisibility();
  }

  function createFloor(width: number, height: number): void {
    // Create a height-aware floor; allow extra subdivisions for smoothness
    const subdiv = Math.max(1, Math.min(4, (getSettings() as any).heightMeshSubdivision || 1));
    const floorGeometry = new THREE.PlaneGeometry(width, height, width * subdiv, height * subdiv);

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

    // Apply per-vertex heights from heightMap
    const pos = floorGeometry.attributes.position;
    const vprFloor = width * subdiv + 1; // vertices per row
    for (let y = 0; y <= height * subdiv; y++) {
      for (let x = 0; x <= width * subdiv; x++) {
        const idx = (y * vprFloor + x) * 3;
        // PlaneGeometry is centered; offset to grid space
        const gx = x / subdiv - 0.5;
        const gy = y / subdiv - 0.5;
        const h = sampleHeightBilinear(heightMap, gx, gy);
        // Before rotation, z becomes world Y after we rotate floor by -PI/2
        pos.array[idx + 2] = h;
      }
    }
    pos.needsUpdate = true;

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
    // Create ceiling geometry with per-vertex heights from ceilingMap
    const subdiv = Math.max(1, Math.min(4, (getSettings() as any).heightMeshSubdivision || 1));
    const ceilingGeometry = new THREE.PlaneGeometry(width, height, width * subdiv, height * subdiv);

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

    // Height displacements: encode gap by moving vertices down locally
    const pos = ceilingGeometry.attributes.position;
    const vprCeil = width * subdiv + 1;
    for (let y = 0; y <= height * subdiv; y++) {
      for (let x = 0; x <= width * subdiv; x++) {
        const idx = (y * vprCeil + x) * 3;
        const gx = x / subdiv - 0.5;
        const gy = y / subdiv - 0.5;
        const cH = sampleCeilingBilinear(ceilingMap, gx, gy);
        pos.array[idx + 2] = cH; // will rotate to face down
      }
    }
    pos.needsUpdate = true;

    const ceiling = new THREE.Mesh(ceilingGeometry, ceilingMaterial);
    ceiling.rotation.x = Math.PI / 2; // Rotate to face down
    ceiling.position.set(width / 2 - 0.5, 0, height / 2 - 0.5);
    ceiling.receiveShadow = true;
    ceiling.frustumCulled = false; // ensure ceiling remains visible
    scene.add(ceiling);
  }


  function createWalls(width: number, height: number): void {
    if (DISABLE_WALLS) return; // skip visual walls entirely
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const element = currentGameMap[y][x];
        const properties = getElementProperties(element);

        if (!properties.walkable) {
          createWallFaces(x, y, element);
        }
      }
    }
  }

  function createWallFaces(x: number, y: number, element: GameElement): void {
    const wallTexture = getWallTexture(element);
    const mat = new THREE.MeshStandardMaterial({ map: wallTexture, roughness: 0.9, metalness: 0.0, emissive: new THREE.Color(0x121820), emissiveIntensity: 0.08, side: THREE.FrontSide });

    // For each of 4 edges, if neighbor is walkable or out of bounds, create a vertical face conforming to ground
    const edges = [
      { dx: 1, dy: 0 }, // east
      { dx: -1, dy: 0 }, // west
      { dx: 0, dy: 1 }, // south
      { dx: 0, dy: -1 } // north
    ];

    for (const e of edges) {
      const nx = x + e.dx;
      const ny = y + e.dy;
      const neighborWalkable = (ny < 0 || ny >= currentGameMap.length || nx < 0 || nx >= currentGameMap[0].length)
        ? true
        : getElementProperties(currentGameMap[ny][nx]).walkable;
      if (!neighborWalkable) continue;

      // Edge endpoints in world (XZ plane), with vertical Y from heightMap
      let p0x = x, p0z = y, p1x = x, p1z = y;
      if (e.dx === 1 && e.dy === 0) { // east edge: x+0.5, y-0.5 -> y+0.5
        p0x = x + 0.5; p0z = y - 0.5; p1x = x + 0.5; p1z = y + 0.5;
      } else if (e.dx === -1 && e.dy === 0) { // west edge: x-0.5, y+0.5 -> y-0.5
        p0x = x - 0.5; p0z = y + 0.5; p1x = x - 0.5; p1z = y - 0.5;
      } else if (e.dx === 0 && e.dy === 1) { // south edge: x+0.5, y+0.5 -> x-0.5, y+0.5
        p0x = x + 0.5; p0z = y + 0.5; p1x = x - 0.5; p1z = y + 0.5;
      } else if (e.dx === 0 && e.dy === -1) { // north edge: x-0.5, y-0.5 -> x+0.5, y-0.5
        p0x = x - 0.5; p0z = y - 0.5; p1x = x + 0.5; p1z = y - 0.5;
      }

      const b0y = sampleHeightBilinear(heightMap, p0x, p0z);
      const b1y = sampleHeightBilinear(heightMap, p1x, p1z);
      const t0y = b0y + WALL_HEIGHT;
      const t1y = b1y + WALL_HEIGHT;

      // Build a quad (two triangles) with vertices ordered to face outward toward the neighbor
      const vertices: number[] = [
        p0x, b0y, p0z,
        p1x, b1y, p1z,
        p1x, t1y, p1z,

        p0x, b0y, p0z,
        p1x, t1y, p1z,
        p0x, t0y, p0z,
      ];
      const uvs: number[] = [
        0, 0,
        1, 0,
        1, 1,
        0, 0,
        1, 1,
        0, 1,
      ];
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geometry.computeVertexNormals();
      const mesh = new THREE.Mesh(geometry, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
    }
  }

  function createStairs(width: number, height: number): void {
    if (stairsGroup) {
      scene.remove(stairsGroup);
      stairsGroup = null;
    }
    const group = new THREE.Group();
    stairsGroup = group;
    const MAX_STEPS = 12;
    const MIN_DH = 0.12; // minimum height difference to bother with stairs
    const MAX_DH = 3.5;  // maximum supported difference for auto stairs
    const STEP_RUN = 0.18;  // horizontal depth per step
    const MAX_SPAN = 0.9;   // do not extend beyond tile bounds
    const material = new THREE.MeshStandardMaterial({ color: 0xcfd3d6, roughness: 0.95, metalness: 0.0 });

    const dirs = [
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 },
    ];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const el = currentGameMap[y][x];
        const props = getElementProperties(el);
        if (!props.walkable) continue;
        const h0 = sampleHeightBilinear(heightMap, x + 0.5, y + 0.5);

        for (const d of dirs) {
          const nx = x + d.dx;
          const ny = y + d.dy;
          if (ny < 0 || ny >= height || nx < 0 || nx >= width) continue;
          const elN = currentGameMap[ny][nx];
          const pN = getElementProperties(elN);
          if (!pN.walkable) continue;
          const h1 = sampleHeightBilinear(heightMap, nx + 0.5, ny + 0.5);
          const dh = h1 - h0;
          const absDh = Math.abs(dh);
          // Only build stairs when at least one tile is explicitly a STAIRS tile
          if (!(currentGameMap[y][x] === GameElement.STAIRS || currentGameMap[ny][nx] === GameElement.STAIRS)) continue;
          if (absDh < MIN_DH || absDh > MAX_DH) continue;

          // Build a ramp of steps from lower to higher tile along the direction
          const steps = Math.min(MAX_STEPS, Math.max(1, Math.ceil(absDh / 0.22)));
          const actualRise = dh / steps; // signed per-step rise
          const run = Math.min(MAX_SPAN, steps * STEP_RUN);
          const stepDepth = run / steps;

          for (let s = 0; s < steps; s++) {
            const t0 = (s / steps) * run;
            const t1 = ((s + 1) / steps) * run;
            const w = 0.8; // width of stairs slab
            const slabH = 0.03; // thickness of each step slab

            const geo = new THREE.BoxGeometry(
              d.dy === 0 ? stepDepth : w,
              slabH,
              d.dx === 0 ? stepDepth : w
            );

            const mesh = new THREE.Mesh(geo, material);
            // Center start within the tile, extend towards neighbor
            const cx = x + 0.5 + (d.dx * (t0 + stepDepth * 0.5));
            const cy = y + 0.5 + (d.dy * (t0 + stepDepth * 0.5));
            // Vertical placement interpolates along steps
            const baseH = h0 + actualRise * (s + 1); // top surface height for this step
            mesh.position.set(cx, baseH + slabH * 0.5 + 0.005, cy);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            group.add(mesh);
          }
        }
      }
    }

    scene.add(group);
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
          // Add collectible glint shimmer for treasures and keys
          if (element === GameElement.TREASURE || element === GameElement.KEY) {
            const tex = new THREE.TextureLoader().load(generateProceduralSprite('treasure'));
            tex.minFilter = THREE.NearestFilter; tex.magFilter = THREE.NearestFilter; tex.generateMipmaps = false;
            const mat = new THREE.SpriteMaterial({ map: tex, color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.7 });
            const s = new THREE.Sprite(mat);
            const h = sampleHeightBilinear(heightMap, x, y);
            s.position.set(x, h + 0.9, y);
            s.scale.set(0.5, 0.5, 1);
            (s as any).glint = true;
            (s as any).phase = Math.random() * Math.PI * 2;
            scene.add(s);
            glintSprites.push(s);
          }
        }
      }
    }
  }

  function createSprite(x: number, y: number, element: GameElement): void {
    const spritePath = getSpritePath(element);

    if (spritePath) {
      // Create sprite with texture
      // Support data URLs returned by generator
      const texture = spritePath.startsWith('data:') ? new THREE.TextureLoader().load(spritePath) : textureLoader.load(spritePath);
      // Make pixel art crisp and avoid blurry squares
      if (texture) {
        if ((texture as any).colorSpace !== undefined) {
          (texture as any).colorSpace = THREE.SRGBColorSpace;
        } else if ((texture as any).encoding !== undefined) {
          (texture as any).encoding = THREE.sRGBEncoding;
        }
        texture.minFilter = THREE.NearestFilter;
        texture.magFilter = THREE.NearestFilter;
        texture.generateMipmaps = false;
        texture.needsUpdate = true;
      }
      const spriteMaterial = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        fog: true,
        depthWrite: false,
        alphaTest: 0.05
      });
      const sprite = new THREE.Sprite(spriteMaterial);
      const gh = sampleHeightBilinear(heightMap, x, y);
      sprite.position.set(x, gh + 0.9, y);
      sprite.scale.set(0.6, 0.6, 0.6);
      scene.add(sprite);

      // Add emissive glow for certain elements
      if (false && (element === GameElement.FIRE || element === GameElement.TREASURE)) {
        const glowColor = element === GameElement.FIRE ? 0xffa200 : 0xffee66;
        const glowTex = new THREE.TextureLoader().load(generateProceduralSprite(element === GameElement.FIRE ? 'fire' : 'treasure'));
        const glowMat = new THREE.SpriteMaterial({
          map: glowTex,
          color: glowColor,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          fog: true,
          opacity: element === GameElement.FIRE ? 0.5 : 0.65
        });
        const glow = new THREE.Sprite(glowMat);
        glow.position.set(x, 0.95, y);
        glow.scale.set(0.9, 0.9, 0.9);
        (glow as any).pulse = true;
        scene.add(glow);
        // glow disabled
      }
      // For environment tiles, prefer custom ground visuals only (no hovering icons)
      if (element === GameElement.GRASS || element === GameElement.WATER || element === GameElement.DANGER || element === GameElement.FIRE) {
        // Remove the sprite we just created and use ground visuals instead
        scene.remove(sprite);
        if (element === GameElement.FIRE || element === GameElement.DANGER) {
          // Keep only ground tile; no glow sprite for now
          createColoredQuad(x, y, element);
        } else {
          createColoredQuad(x, y, element);
        }
        return;
      }
    } else {
      // Create colored quad for elements without sprites
      createColoredQuad(x, y, element);
    }
  }

  function createColoredQuad(x: number, y: number, element: GameElement): void {
    // Conforming ground tiles subdivided to enhance continuity between tiles
    const size = 1.0;
    const segments = 2; // break one tile into 4 subtiles
    const geom = new THREE.PlaneGeometry(size, size, segments, segments);
    const pos = geom.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const lx = pos.getX(i); // local -0.5..0.5
      const ly = pos.getY(i);
      const wx = x + lx;
      const wy = y + ly;
      const h = sampleHeightBilinear(heightMap, wx, wy);
      pos.setZ(i, h);
    }
    pos.needsUpdate = true;
    geom.computeVertexNormals();

    const color = getElementColor(element);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.93, metalness: 0.0, transparent: true, opacity: 0.92, side: THREE.DoubleSide, fog: true });
    const tile = new THREE.Mesh(geom, mat);
    tile.rotation.x = -Math.PI / 2;
    tile.position.set(x, 0.0, y);
    tile.receiveShadow = true;
    scene.add(tile);

    if (element === GameElement.GRASS) {
      // Add 3 swaying grass blades as sprites
      for (let i = 0; i < 3; i++) {
        const tex = new THREE.TextureLoader().load(generateProceduralSprite('grass'));
        tex.minFilter = THREE.NearestFilter; tex.magFilter = THREE.NearestFilter; tex.generateMipmaps = false;
        const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: true, alphaTest: 0.05 });
        const s = new THREE.Sprite(mat);
        const gh = sampleHeightBilinear(heightMap, x, y);
        s.position.set(x + (Math.random() - 0.5) * 0.5, gh + 0.12, y + (Math.random() - 0.5) * 0.5);
        s.scale.set(0.35, 0.35, 1);
        (s as any).swayPhase = Math.random() * Math.PI * 2;
        (s as any).castShadow = true;
        scene.add(s);
        grassSwaySprites.push(s);
      }
    } else if (element === GameElement.WATER) {
      // Water surface that conforms loosely to terrain with slight offset
      const waterGeo = new THREE.PlaneGeometry(size, size, 4, 4);
      const wp = waterGeo.attributes.position;
      for (let i = 0; i < wp.count; i++) {
        const lx = wp.getX(i); const ly = wp.getY(i);
        const wx = x + lx; const wy = y + ly;
        const h = sampleHeightBilinear(heightMap, wx, wy) + 0.03;
        wp.setZ(i, h);
      }
      wp.needsUpdate = true;
      waterGeo.computeVertexNormals();

      const waterMat = new THREE.ShaderMaterial({
        uniforms: { time: { value: 0 }, baseColor: { value: new THREE.Color(0x4aa3ff) } },
        vertexShader: `
          uniform float time;
          void main() {
            vec3 p = position;
            p.z += sin((position.x + position.y) * 6.0 + time * 2.0) * 0.015;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 baseColor;
          void main(){
            gl_FragColor = vec4(baseColor, 0.85);
          }
        `,
        transparent: true,
        depthWrite: false
      });
      const water = new THREE.Mesh(waterGeo, waterMat);
      water.rotation.x = -Math.PI / 2;
      water.position.set(x, 0.0, y);
      water.receiveShadow = true; // catch soft caustic shadows from scene lights
      scene.add(water);
      waterMaterials.push(waterMat);

      // Foam ring for water edges
      if (isWaterEdge(currentGameMap, Math.floor(x), Math.floor(y))) {
        const foam = new THREE.Mesh(new THREE.RingGeometry(0.45, 0.48, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, side: THREE.DoubleSide }));
        foam.rotation.x = -Math.PI / 2;
        const gh = sampleHeightBilinear(heightMap, x, y);
        foam.position.set(x, gh + 0.035, y);
        foam.renderOrder = 3;
        scene.add(foam);
        foamMeshes.push(foam);
      }
    }
  }

  function createFireLightsForMap(): void {
    // Clear existing fire lights
    fireLights.forEach(light => scene.remove(light));
    fireLights = [];

    for (let y = 0; y < currentGameMap.length; y++) {
      for (let x = 0; x < currentGameMap[y].length; x++) {
        const element = currentGameMap[y][x];
        if (element === GameElement.FIRE) {
          createFireLight(x, y);
        }
      }
    }
  }

  // Particles removed

  // No particle config needed

  function createFireLight(x: number, y: number): void {
    const fireLight = new THREE.PointLight(0xffaa44, 1.1, 8);
    const gh = sampleHeightBilinear(heightMap, x, y);
    fireLight.position.set(x, gh + 0.8, y);
    fireLight.castShadow = false; // Don't cast shadows to avoid performance issues

    scene.add(fireLight);
    fireLights.push(fireLight);
  }

  // Update fire light flicker and animated materials
  function updateSceneEffects(): void {
    const time = Date.now() * 0.001;

    fireLights.forEach((light, index) => {
      const baseIntensity = 0.8;
      const flicker = Math.sin(time * 8 + index) * 0.2 + Math.sin(time * 12 + index * 2) * 0.1;
      light.intensity = baseIntensity + flicker;
    });

    waterMaterials.forEach((mat: any) => {
      if (mat.uniforms && mat.uniforms.time) {
        mat.uniforms.time.value = time;
      }
    });

    grassSwaySprites.forEach((s: any, idx: number) => {
      const phase = s.swayPhase || 0;
      s.rotation.z = Math.sin(time * 2.0 + phase) * 0.08;
    });

    foamMeshes.forEach((m: any, idx: number) => {
      const mat = m.material as any;
      if (mat && mat.opacity !== undefined) {
        mat.opacity = 0.45 + Math.sin(time * 2.5 + idx) * 0.1;
      }
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
        return generateProceduralSprite('enemy');
      case GameElement.DANGER:
        return generateProceduralSprite('danger');
      case GameElement.PLAYER_FINISH:
        return generateProceduralSprite('finish');
      case GameElement.TREASURE:
        return generateProceduralSprite('treasure');
      case GameElement.KEY:
        return generateProceduralSprite('key');
      case GameElement.DOOR:
        return generateProceduralSprite('door');
      case GameElement.STAIRS:
        return generateProceduralSprite('stairs');
      case GameElement.FIRE:
        return generateProceduralSprite('fire');
      case GameElement.GRASS:
        return generateProceduralSprite('grass');
      case GameElement.WATER:
        return generateProceduralSprite('water');
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

    // Jump input
    if (keysPressed.has('space')) {
      // Only allow jump if near ground level (not already in air)
      if (Math.abs(playerVerticalVel) < 0.001) {
        playerVerticalVel = JUMP_VELOCITY;
      }
      keysPressed.delete('space');
    }

    // Water slow and swimming bobbing
    const tileX = Math.floor(newX);
    const tileY = Math.floor(newY);
    const inBounds = tileY >= 0 && tileY < currentGameMap.length && tileX >= 0 && tileX < currentGameMap[0].length;
    const inWater = inBounds && currentGameMap[tileY][tileX] === GameElement.WATER;
    const speedMultiplier = inWater ? 0.55 : 1.0;
    const groundH = sampleHeightBilinear(heightMap, newX, newY);
    const waterDepth = inWater ? Math.max(0, (0.0 - groundH) + 0.35) : 0;

    // Check collision and update position with speed multiplier
    const prevX = player.x;
    const prevY = player.y;
    if (isValidPosition(newX, newY)) {
      player.x += (newX - player.x) * speedMultiplier;
      player.y += (newY - player.y) * speedMultiplier;
    } else {
      // Try to slide along walls if direct movement is blocked
      trySlideAlongWalls(newX, newY);
    }

    // Update camera position with swim bob and terrain height
    // Vertical physics
    let baseEye = 1 + groundH; // baseline eye height following terrain
    if (inWater) {
      // Buoyancy counteracts gravity
      const buoyancyForce = Math.min(0.015, waterDepth * 0.02);
      playerVerticalVel += buoyancyForce;
      playerVerticalVel *= 0.96; // water drag
    } else {
      playerVerticalVel += GRAVITY;
    }

    // Simulate vertical position of the camera relative to baseEye
    baseEye += playerVerticalVel;
    // Prevent sinking below terrain more than STEP_MAX unless in water
    if (!inWater && baseEye < 1 + groundH - STEP_MAX) {
      baseEye = 1 + groundH - STEP_MAX;
      playerVerticalVel = 0;
    }
    const swimBob = inWater ? (Math.sin(Date.now() * 0.006) * 0.08) : 0;
    camera.position.set(player.x, baseEye + swimBob, player.y);
    const lookX = player.x + Math.cos(player.angle) * 2;
    const lookZ = player.y + Math.sin(player.angle) * 2;
    camera.lookAt(lookX, groundH + 1, lookZ);

    // Update player torch position and add subtle flicker
    if ((scene as any).playerTorch) {
      const torch = (scene as any).playerTorch as any;
      torch.position.set(player.x, 1.5, player.y);
      const t = Date.now() * 0.002;
      torch.intensity = 2.0 + Math.sin(t * 3.2) * 0.2 + Math.sin(t * 5.7) * 0.1;
    }

    // Particle-based splashes and dust removed
  }

  // Particle splash removed

  // Dust puff removed

  // Simple WebAudio splash synth
  function playSplashSound() {
    try {
      const ctx = (window as any).audioCtx || new (window.AudioContext || (window as any).webkitAudioContext)();
      (window as any).audioCtx = ctx;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(600, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.25);
      g.gain.setValueAtTime(0.15, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
      o.connect(g).connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.4);
    } catch {}
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

    // If walls are disabled, only enforce bounds
    if (DISABLE_WALLS) {
      return true;
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

  // Exposed hook to trigger enemy hit sparks (call externally when an enemy is damaged)
  (window as any).spawnHitSparks = function(worldX: number, worldY: number) { /* particles removed */ };

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
    applyTileEffects();
    updateUI();
    drawMinimap();
    updateDebugVisualization();
    updateSpriteAnimations();
    updateSceneEffects();

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

  function applyTileEffects(): void {
    const tileX = Math.floor(player.x);
    const tileY = Math.floor(player.y);
    if (tileX < 0 || tileY < 0 || tileY >= currentGameMap.length || tileX >= currentGameMap[0].length) return;
    const element = currentGameMap[tileY][tileX];

    // Fire and danger damage
    if (element === GameElement.FIRE || element === GameElement.DANGER) {
      changeHealth(-0.25); // damage per frame at ~60fps ~15 hp/s
    }
  }

  function updateUI(): void {
    // Draw pixelated health bar to HUD canvas
    if (!hudHealthCtx) return;
    const ctx = hudHealthCtx;
    const w = hudHealthCanvas.width;
    const h = hudHealthCanvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = false;
    // Frame
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, w - 2, h - 2);
    // Bar
    const pct = Math.max(0, Math.min(1, player.health / player.maxHealth));
    const barW = Math.floor((w - 6) * pct);
    const grad = ctx.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, '#ff3b3b');
    grad.addColorStop(1, '#ff7a3b');
    ctx.fillStyle = grad;
    ctx.fillRect(3, 3, barW, h - 6);
    // Upload to texture
    hudHealthTexture.needsUpdate = true;

    // Water overlay update (underwater tint when in water tile)
    const tileX = Math.floor(player.x);
    const tileY = Math.floor(player.y);
    const inBounds = tileY >= 0 && tileY < currentGameMap.length && tileX >= 0 && tileX < currentGameMap[0].length;
    const inWater = inBounds && currentGameMap[tileY][tileX] === GameElement.WATER;
    const overlay = (scene as any).waterOverlay;
    if (overlay && overlay.ctx) {
      const c = overlay.canvas as HTMLCanvasElement;
      const octx = overlay.ctx as CanvasRenderingContext2D;
      octx.clearRect(0, 0, c.width, c.height);
      if (inWater) {
        octx.fillStyle = 'rgba(50,120,220,0.28)';
        octx.fillRect(0, 0, c.width, c.height);
      }
      overlay.texture.needsUpdate = true;
      overlay.sprite.visible = inWater;
    }
  }

  function drawMinimap(): void {
    if (!hudMinimapCtx) return;
    const ctx = hudMinimapCtx;
    const w = hudMinimapCanvas.width;
    const h = hudMinimapCanvas.height;
    ctx.clearRect(0, 0, w, h);
    if (!currentGameMap.length) return;

    const cols = currentGameMap[0].length;
    const rows = currentGameMap.length;
    const cell = Math.min(Math.floor(w / cols), Math.floor(h / rows));
    const offsetX = Math.floor((w - cols * cell) / 2);
    const offsetY = Math.floor((h - rows * cell) / 2);

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const el = currentGameMap[y][x];
        let color = '#2d2f3a';
        switch (el) {
          case GameElement.WALL: color = '#555a66'; break;
          case GameElement.WATER: color = '#3a7bd9'; break;
          case GameElement.GRASS: color = '#3bbf6a'; break;
          case GameElement.FIRE: color = '#ff7a1a'; break;
          case GameElement.DANGER: color = '#ff3366'; break;
          case GameElement.DOOR: color = '#8e5a3c'; break;
          case GameElement.STAIRS: color = '#cfd3d6'; break;
          default: color = '#2d2f3a';
        }
        ctx.fillStyle = color;
        ctx.fillRect(offsetX + x * cell, offsetY + y * cell, cell, cell);
      }
    }

    // Player
    ctx.fillStyle = '#ffffff';
    const px = offsetX + player.x * cell;
    const py = offsetY + player.y * cell;
    ctx.beginPath();
    ctx.arc(px, py, Math.max(2, cell * 0.18), 0, Math.PI * 2);
    ctx.fill();
    // Facing indicator
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(1, Math.floor(cell * 0.08));
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + Math.cos(player.angle) * cell * 0.5, py + Math.sin(player.angle) * cell * 0.5);
    ctx.stroke();

    // Enemies
    ctx.fillStyle = '#ff3366';
    enemies.forEach(e => {
      ctx.fillRect(offsetX + e.x * cell - 2, offsetY + e.y * cell - 2, 4, 4);
    });

    // Upload to texture
    hudMinimapTexture.needsUpdate = true;
  }

  function changeHealth(delta: number): void {
    player.health = Math.max(0, Math.min(player.maxHealth, player.health + delta));
    if (player.health <= 0) {
      onGameOver();
    }
  }

  function onGameOver(): void {
    gameRunning = false;
    const overlay = document.createElement('div');
    overlay.style.position = 'absolute';
    overlay.style.left = '0';
    overlay.style.top = '0';
    overlay.style.right = '0';
    overlay.style.bottom = '0';
    overlay.style.background = 'rgba(0,0,0,0.6)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.color = '#fff';
    overlay.style.fontFamily = 'sans-serif';
    overlay.style.fontSize = '28px';
    overlay.textContent = 'Game Over';
    uiContainer.appendChild(overlay);
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

    // Glow sprites removed

    // Glint shimmer
    glintSprites.forEach((s: any, idx: number) => {
      const base = 0.8 + Math.sin(time * 3.0 + s.phase) * 0.2;
      s.scale.set(base, base, 1);
      const mat = s.material as any;
      if (mat) mat.opacity = 0.55 + Math.sin(time * 4.0 + s.phase) * 0.25;
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
      case ' ': keysPressed.add('space'); break;
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
      case ' ': keysPressed.delete('space'); break;
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
