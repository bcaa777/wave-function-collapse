
import { IWaveFunctionCollapse, createWaveFunctionCollapse } from "./wfc/run";
import { buildDomTree } from "./util";
import { createWfcOptions } from "./components/wfcOptions";
import { createSettingsPanel } from "./components/settingsPanel";
import { getSettings, onSettingsChange, setSetting } from "./gameSettings";
import { createPresetPicker } from "./components/presetPicker";
import { createDrawingCanvas } from "./components/drawingCanvas";
import { createImageEditor } from "./components/imageEditor";
import { createThreeJSDungeonCrawler } from "./components/threeJSDungeonCrawler";
import { createImageUploader } from "./components/imageUploader";
import { createAssetManager } from "./components/assetManager";
import { imageDataToGameMap, findPlayerStart, findPlayerFinish, GameElement, extractHslMaps } from "./colorMapping";
// duplicate import removed

let wfc: IWaveFunctionCollapse | undefined;

// Current application state
enum AppMode {
  INPUT = 'input',
  WFC_GENERATION = 'wfc_generation',
  IMAGE_EDITING = 'image_editing',
  DUNGEON_CRAWLER = 'dungeon_crawler'
}

let currentMode = AppMode.INPUT;
let generatedImageData: ImageData | undefined;
let gameMap: GameElement[][] = [];

const canvas = document.createElement("canvas");
canvas.className = "wfcOutput";
canvas.width = 0;
canvas.height = 0;

const wfcOptions = createWfcOptions();
let inputBitmap: ImageData | undefined;

// UI elements that need to be accessed across functions
let downloadButton: HTMLInputElement;
let editImageButton: HTMLInputElement;

const startWFC = () => {
  if (wfc) {
    wfc.stop();
  }

  if (!inputBitmap) {
    return;
  }

  // Disable download button while generating
  if (downloadButton) downloadButton.disabled = true;
  if (editImageButton) editImageButton.disabled = true;

  wfc = createWaveFunctionCollapse(inputBitmap, canvas, wfcOptions.options, () => {
    // Enable buttons when generation completes
    if (downloadButton) downloadButton.disabled = false;
    if (editImageButton) editImageButton.disabled = false;

    // Get the generated image data
    const ctx = canvas.getContext("2d");
    if (ctx) {
      generatedImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    }
  });
};

// Create mode tabs
const modeTabContainer = document.createElement("div");
modeTabContainer.className = "modeTabContainer";

const inputModeTab = document.createElement("button");
inputModeTab.textContent = "1. Create Input";
inputModeTab.className = "modeTab active";

const wfcModeTab = document.createElement("button");
wfcModeTab.textContent = "2. Generate";
wfcModeTab.className = "modeTab";

const editModeTab = document.createElement("button");
editModeTab.textContent = "3. Edit Image";
editModeTab.className = "modeTab";

const gameModeTab = document.createElement("button");
gameModeTab.textContent = "4. Play Game";
gameModeTab.className = "modeTab";

const contentContainer = document.createElement("div");
contentContainer.className = "contentContainer";

// Global settings panel
const settingsPanel = createSettingsPanel();

// Input mode content
const inputTabContainer = document.createElement("div");
inputTabContainer.className = "tabContainer";

const presetTab = document.createElement("button");
presetTab.textContent = "Preset Images";
presetTab.className = "tab active";

const drawTab = document.createElement("button");
drawTab.textContent = "Draw Custom";
drawTab.className = "tab";

const uploadTab = document.createElement("button");
uploadTab.textContent = "Upload Map";
uploadTab.className = "tab";

const inputContainer = document.createElement("div");
inputContainer.className = "inputContainer";

// Preset picker
const presetPicker = createPresetPicker();
presetPicker.onPick = (image, options) => {
  inputBitmap = image;
  wfcOptions.updateOptions(options);
  switchMode(AppMode.WFC_GENERATION);
  startWFC();
};

// Drawing canvas
const drawingCanvas = createDrawingCanvas();
drawingCanvas.onDrawComplete = (image) => {
  inputBitmap = image;
  wfcOptions.updateOptions({}); // Reset to defaults for custom drawings
  switchMode(AppMode.WFC_GENERATION);
  startWFC();
};

// Image uploader for direct map upload
const imageUploader = createImageUploader();
imageUploader.onUploadComplete = (image) => {
  // Store the uploaded image as generated image data
  generatedImageData = image;

  // Check if the uploaded map has required start/finish points
  const tempGameMap = imageDataToGameMap(image);
  const playerStart = findPlayerStart(tempGameMap);
  const playerFinish = findPlayerFinish(tempGameMap);

  if (!playerStart || !playerFinish) {
    // Missing start or finish points - go to image editor first
    const missingElements = [];
    if (!playerStart) missingElements.push("player start (dark green)");
    if (!playerFinish) missingElements.push("player finish (dark red)");

    alert(`Your uploaded map is missing required elements: ${missingElements.join(" and ")}. Please use the image editor to add them before playing.`);
    switchMode(AppMode.IMAGE_EDITING);
  } else {
    // Map is complete - go directly to dungeon crawler
    switchMode(AppMode.DUNGEON_CRAWLER);
    startDungeonCrawler();
  }
};

// Image editor
const imageEditor = createImageEditor();
imageEditor.domElement.classList.add('card');
imageEditor.onEditComplete = (image) => {
  generatedImageData = image;
  switchMode(AppMode.DUNGEON_CRAWLER);
  startDungeonCrawler();
};

// Three.js Dungeon crawler
const dungeonCrawler = createThreeJSDungeonCrawler();
dungeonCrawler.onGameComplete = () => {
  alert("Congratulations! You completed the dungeon!");
  switchMode(AppMode.INPUT);
};

dungeonCrawler.onGameOver = () => {
  alert("Game Over! You died in the dungeon.");
  switchMode(AppMode.INPUT);
};

// Tab switching logic for input tabs
function switchInputTab(activeTab: HTMLElement, inactiveTabs: HTMLElement[], showElement: Node) {
  // Remove active class from all tabs
  inactiveTabs.forEach(tab => tab.classList.remove("active"));
  activeTab.classList.add("active");

  // Clear and add the correct input method
  inputContainer.innerHTML = "";
  inputContainer.appendChild(showElement as Node);
}

presetTab.onclick = () => switchInputTab(presetTab, [drawTab, uploadTab], presetPicker.domElement);
drawTab.onclick = () => switchInputTab(drawTab, [presetTab, uploadTab], drawingCanvas.domElement);
uploadTab.onclick = () => switchInputTab(uploadTab, [presetTab, drawTab], imageUploader.domElement);

// Mode switching logic
function switchMode(newMode: AppMode) {
  // Remove active class from all mode tabs
  inputModeTab.classList.remove("active");
  wfcModeTab.classList.remove("active");
  editModeTab.classList.remove("active");
  gameModeTab.classList.remove("active");

  // Clear content container
  contentContainer.innerHTML = "";

  currentMode = newMode;

  switch (newMode) {
    case AppMode.INPUT:
      inputModeTab.classList.add("active");
      buildInputMode();
      break;

    case AppMode.WFC_GENERATION:
      wfcModeTab.classList.add("active");
      buildWFCGenerationMode();
      break;

    case AppMode.IMAGE_EDITING:
      editModeTab.classList.add("active");
      buildImageEditingMode();
      break;

    case AppMode.DUNGEON_CRAWLER:
      gameModeTab.classList.add("active");
      buildDungeonCrawlerMode();
      break;
  }
}

function buildInputMode() {
  const assetsBtn = document.createElement('button');
  assetsBtn.className = 'btn btn-secondary ms-2';
  assetsBtn.textContent = 'Assets';
  assetsBtn.onclick = () => {
    contentContainer.innerHTML = '';
    contentContainer.appendChild(settingsPanel.domElement);
    const assets = createAssetManager();
    contentContainer.appendChild(assets.domElement);
  };

  buildDomTree(contentContainer, [
    settingsPanel.domElement,
    inputTabContainer, [
      presetTab,
      drawTab,
      uploadTab,
      assetsBtn,
    ],
    inputContainer,
    wfcOptions.domElement,
  ]);

  // Initialize with preset picker
  inputContainer.appendChild(presetPicker.domElement);
}

function buildWFCGenerationMode() {
  const restartWfc = document.createElement("input");
  restartWfc.type = "button";
  restartWfc.value = "Restart Generation";
  restartWfc.onclick = startWFC;

  downloadButton = document.createElement("input");
  downloadButton.type = "button";
  downloadButton.value = "Download PNG";
  downloadButton.disabled = true;
  downloadButton.onclick = () => {
    // Create a link element to trigger download
    const link = document.createElement("a");
    link.download = `wfc-output-${Date.now()}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  editImageButton = document.createElement("input");
  editImageButton.type = "button";
  editImageButton.value = "Edit Generated Image";
  editImageButton.disabled = true;
  editImageButton.onclick = () => {
    switchMode(AppMode.IMAGE_EDITING);
  };

  const actions = document.createElement("div");
  actions.className = "toolbar";

  buildDomTree(contentContainer, [
    settingsPanel.domElement,
    actions, [
      restartWfc,
      downloadButton,
      editImageButton,
    ],
    canvas,
  ]);
}

function buildImageEditingMode() {
  if (generatedImageData) {
    imageEditor.loadImage(generatedImageData);
  }

  buildDomTree(contentContainer, [
    settingsPanel.domElement,
    document.createElement("p"), [
      "Use the drawing tools to add player start (dark green) and finish (dark red) points, polish routes, and adjust the dungeon layout."
    ],
    imageEditor.domElement,
  ]);
}

function buildDungeonCrawlerMode() {
  buildDomTree(contentContainer, [
    settingsPanel.domElement,
    dungeonCrawler.domElement,
  ]);
}

async function startDungeonCrawler() {
  if (!generatedImageData) return;

  // Convert image to game map
  gameMap = imageDataToGameMap(generatedImageData);
  // Derive height map in meters based on settings
  const s = getSettings();
  const payload = generatedImageData as ImageData & { __heightmap?: ImageData | null };
  const customHeight = payload.__heightmap;
  const { heights, lightnesses } = extractHslMaps(customHeight || generatedImageData);
  let heightOverride = heights;
  if (s.heightMode === 'procedural') {
    const h = generatedImageData.height; const w = generatedImageData.width;
    const freq = s.heightNoiseFrequency; const oct = s.heightNoiseOctaves;
    const scale = s.heightScaleMeters; const base = s.heightBaseMeters;
    const seed = s.heightSeed;
    const proc = generateProceduralHeightMap(w, h, { frequency: freq, octaves: oct, seed });
    // normalize 0..1 then scale
    let min = 1e9, max = -1e9;
    for (let y = 0; y < h; y++) { for (let x = 0; x < w; x++) { const v = proc[y][x]; if (v < min) min = v; if (v > max) max = v; } }
    const range = Math.max(1e-6, max - min);
    heightOverride = Array.from({ length: h }, (_, y) => new Array(w).fill(0));
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const n = (proc[y][x] - min) / range; // 0..1
        heightOverride[y][x] = base + n * scale;
      }
    }
    // Optional smoothing
    for (let p = 0; p < s.heightSmoothingPasses; p++) {
      heightOverride = s.heightBlurType === 'gaussian' ? gaussianBlurHeight(heightOverride, s.heightBlurRadius) : blurHeight(heightOverride, s.heightBlurRadius);
    }
    // Slope limiting and relaxation
    heightOverride = limitSlope(heightOverride, s.heightMaxSlopePerTile, s.heightRelaxPasses);
  } else if (customHeight) {
    // If a custom heightmap was provided, use its lightness with scale/base; optionally quantize
    const scale = s.heightScaleMeters;
    const base = s.heightBaseMeters;
    const h = customHeight.height;
    const w = customHeight.width;
    heightOverride = Array.from({ length: h }, (_, y) => new Array(w).fill(0));
    if (s.heightMode === 'quantized') {
      const levels = Math.max(2, Math.floor(s.heightLevels));
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const l = lightnesses[y][x];
          const idx = Math.round(l * (levels - 1));
          const q = idx / (levels - 1);
          heightOverride[y][x] = base + q * scale;
        }
      }
    } else {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const l = lightnesses[y][x];
          heightOverride[y][x] = base + l * scale;
        }
      }
    }
    // Smooth even with heightmap
    for (let p = 0; p < s.heightSmoothingPasses; p++) {
      heightOverride = s.heightBlurType === 'gaussian' ? gaussianBlurHeight(heightOverride, s.heightBlurRadius) : blurHeight(heightOverride, s.heightBlurRadius);
    }
    heightOverride = limitSlope(heightOverride, s.heightMaxSlopePerTile, s.heightRelaxPasses);
  } else if (s.heightMode === 'quantized') {
    const levels = Math.max(2, Math.floor(s.heightLevels));
    const scale = s.heightScaleMeters;
    const base = s.heightBaseMeters;
    const h = generatedImageData.height;
    const w = generatedImageData.width;
    heightOverride = Array.from({ length: h }, (_, y) => new Array(w).fill(0));
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const l = lightnesses[y][x]; // 0..1
        const idx = Math.round(l * (levels - 1));
        const q = idx / (levels - 1);
        heightOverride[y][x] = base + q * scale;
      }
    }
  } else if (s.heightMode === 'lightness') {
    const scale = s.heightScaleMeters;
    const base = s.heightBaseMeters;
    const h = generatedImageData.height;
    const w = generatedImageData.width;
    heightOverride = Array.from({ length: h }, (_, y) => new Array(w).fill(0));
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const l = lightnesses[y][x];
        heightOverride[y][x] = base + l * scale;
      }
    }
  }
  // Final smoothing for non-procedural modes
  if (s.heightMode !== 'procedural') {
    for (let p = 0; p < s.heightSmoothingPasses; p++) {
      heightOverride = s.heightBlurType === 'gaussian' ? gaussianBlurHeight(heightOverride, s.heightBlurRadius) : blurHeight(heightOverride, s.heightBlurRadius);
    }
    heightOverride = limitSlope(heightOverride, s.heightMaxSlopePerTile, s.heightRelaxPasses);
  }

  // Find player start position
  const playerStart = findPlayerStart(gameMap);
  if (!playerStart) {
    alert("No player start position found! Please add a dark green (#006400) pixel to mark the start.");
    switchMode(AppMode.IMAGE_EDITING);
    return;
  }

  // Find player finish position
  const playerFinish = findPlayerFinish(gameMap);
  if (!playerFinish) {
    alert("No player finish position found! Please add a dark red (#8B0000) pixel to mark the finish.");
    switchMode(AppMode.IMAGE_EDITING);
    return;
  }

  // Start the game
  try {
    await dungeonCrawler.startGame(gameMap, playerStart, heightOverride);
  } catch (error: any) {
    console.error('Failed to start game:', error);
  }
}

function generateProceduralHeightMap(width: number, height: number, opts: { frequency: number; octaves: number; seed: number }): number[][] {
  // Simple fractal noise using the same noise from terrain.ts style
  const { frequency, octaves, seed } = opts;
  const rnd = mulberry32(seed);
  const noise2 = valueNoise2D(seed);
  const map: number[][] = Array.from({ length: height }, () => new Array(width).fill(0));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let amp = 1.0; let freq = frequency; let val = 0; let norm = 0;
      for (let o = 0; o < octaves; o++) {
        val += noise2(x * 0.05 * freq, y * 0.05 * freq) * amp;
        norm += amp; amp *= 0.5; freq *= 2.0;
      }
      map[y][x] = val / Math.max(1e-6, norm);
    }
  }
  return map;
}

function valueNoise2D(seed: number) {
  const rand = mulberry32(seed);
  const grid = new Map<string, number>();
  function rnd(ix: number, iy: number) {
    const key = ix + ',' + iy;
    if (!grid.has(key)) grid.set(key, rand());
    return grid.get(key)!;
  }
  function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
  function smoothstep(t: number) { return t * t * (3 - 2 * t); }
  return (x: number, y: number) => {
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const tx = x - x0, ty = y - y0;
    const v00 = rnd(x0, y0);
    const v10 = rnd(x0 + 1, y0);
    const v01 = rnd(x0, y0 + 1);
    const v11 = rnd(x0 + 1, y0 + 1);
    const u = smoothstep(tx), v = smoothstep(ty);
    const a = lerp(v00, v10, u);
    const b = lerp(v01, v11, u);
    return lerp(a, b, v) * 2 - 1; // -1..1
  };
}

function mulberry32(a: number) {
  return function() {
    let t = a += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function blurHeight(hm: number[][], radius: number): number[][] {
  if (radius <= 0) return hm;
  const rows = hm.length, cols = hm[0].length;
  const out: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0));
  const r = Math.max(1, radius);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      let sum = 0, count = 0;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const nx = x + dx, ny = y + dy;
          if (ny >= 0 && ny < rows && nx >= 0 && nx < cols) { sum += hm[ny][nx]; count++; }
        }
      }
      out[y][x] = sum / Math.max(1, count);
    }
  }
  return out;
}

function gaussianKernel1D(radius: number): number[] {
  const r = Math.max(1, radius);
  const sigma = r / 1.5;
  const k = [] as number[];
  let sum = 0;
  for (let i = -r; i <= r; i++) {
    const v = Math.exp(-(i * i) / (2 * sigma * sigma));
    k.push(v); sum += v;
  }
  return k.map(v => v / sum);
}

function gaussianBlurHeight(hm: number[][], radius: number): number[][] {
  if (radius <= 0) return hm;
  const rows = hm.length, cols = hm[0].length;
  const kr = Math.max(1, radius);
  const kernel = gaussianKernel1D(kr);
  // horizontal pass
  const temp: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0));
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      let sum = 0;
      for (let i = -kr; i <= kr; i++) {
        const nx = Math.min(cols - 1, Math.max(0, x + i));
        sum += hm[y][nx] * kernel[i + kr];
      }
      temp[y][x] = sum;
    }
  }
  // vertical pass
  const out: number[][] = Array.from({ length: rows }, () => new Array(cols).fill(0));
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      let sum = 0;
      for (let i = -kr; i <= kr; i++) {
        const ny = Math.min(rows - 1, Math.max(0, y + i));
        sum += temp[ny][x] * kernel[i + kr];
      }
      out[y][x] = sum;
    }
  }
  return out;
}

function limitSlope(hm: number[][], maxSlopePerTile: number, relaxPasses: number): number[][] {
  if (maxSlopePerTile <= 0) return hm;
  const rows = hm.length, cols = hm[0].length;
  const out: number[][] = hm.map(row => row.slice());
  for (let p = 0; p < Math.max(0, relaxPasses); p++) {
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const h0 = out[y][x];
        let sum = h0, cnt = 1;
        // 4-neighborhood
        const nb = [[1,0],[-1,0],[0,1],[0,-1]] as Array<[number,number]>;
        for (const [dx, dy] of nb) {
          const nx = x + dx, ny = y + dy;
          if (ny < 0 || ny >= rows || nx < 0 || nx >= cols) continue;
          const hN = out[ny][nx];
          const diff = hN - h0;
          if (Math.abs(diff) > maxSlopePerTile) {
            const clamped = h0 + Math.sign(diff) * maxSlopePerTile;
            sum += clamped; cnt++;
          } else {
            sum += hN; cnt++;
          }
        }
        out[y][x] = sum / cnt;
      }
    }
  }
  return out;
}

// Mode tab event listeners
inputModeTab.onclick = () => switchMode(AppMode.INPUT);
wfcModeTab.onclick = () => switchMode(AppMode.WFC_GENERATION);
editModeTab.onclick = () => switchMode(AppMode.IMAGE_EDITING);
gameModeTab.onclick = () => switchMode(AppMode.DUNGEON_CRAWLER);

// Initialize the application
const mainElem = document.querySelector("main");
if (mainElem) {
  buildDomTree(
    mainElem, [
      modeTabContainer, [
        inputModeTab,
        wfcModeTab,
        editModeTab,
        gameModeTab,
      ],
      contentContainer,
    ],
  );

  // Start with input mode
  switchMode(AppMode.INPUT);
}
