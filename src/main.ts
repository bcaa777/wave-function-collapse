
import { IWaveFunctionCollapse, createWaveFunctionCollapse } from "./wfc/run";
import { buildDomTree } from "./util";
import { createWfcOptions } from "./components/wfcOptions";
import { createPresetPicker } from "./components/presetPicker";
import { createDrawingCanvas } from "./components/drawingCanvas";
import { createImageEditor } from "./components/imageEditor";
import { createThreeJSDungeonCrawler } from "./components/threeJSDungeonCrawler";
import { imageDataToGameMap, findPlayerStart, findPlayerFinish, GameElement } from "./colorMapping";

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

// Input mode content
const inputTabContainer = document.createElement("div");
inputTabContainer.className = "tabContainer";

const presetTab = document.createElement("button");
presetTab.textContent = "Preset Images";
presetTab.className = "tab active";

const drawTab = document.createElement("button");
drawTab.textContent = "Draw Custom";
drawTab.className = "tab";

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

// Image editor
const imageEditor = createImageEditor();
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
function switchInputTab(activeTab: HTMLElement, inactiveTab: HTMLElement, showElement: Node) {
  activeTab.classList.add("active");
  inactiveTab.classList.remove("active");

  // Clear and add the correct input method
  inputContainer.innerHTML = "";
  inputContainer.appendChild(showElement as Node);
}

presetTab.onclick = () => switchInputTab(presetTab, drawTab, presetPicker.domElement);
drawTab.onclick = () => switchInputTab(drawTab, presetTab, drawingCanvas.domElement);

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
  buildDomTree(contentContainer, [
    document.createElement("h2"), ["Input bitmap"],
    inputTabContainer, [
      presetTab,
      drawTab,
    ],
    inputContainer,
    document.createElement("h2"), ["Options"],
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

  buildDomTree(contentContainer, [
    document.createElement("h2"), ["Wave Function Collapse Generation"],
    document.createElement("div"), [
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
    document.createElement("h2"), ["Edit Generated Image"],
    document.createElement("p"), [
      "Use the drawing tools to add player start (dark green) and finish (dark red) points, polish routes, and adjust the dungeon layout."
    ],
    imageEditor.domElement,
  ]);
}

function buildDungeonCrawlerMode() {
  buildDomTree(contentContainer, [
    document.createElement("h2"), ["Dungeon Crawler Game"],
    dungeonCrawler.domElement,
  ]);
}

async function startDungeonCrawler() {
  if (!generatedImageData) return;

  // Convert image to game map
  gameMap = imageDataToGameMap(generatedImageData);

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
    await dungeonCrawler.startGame(gameMap, playerStart);
  } catch (error: any) {
    console.error('Failed to start game:', error);
  }
}

// Mode tab event listeners
inputModeTab.onclick = () => switchMode(AppMode.INPUT);
wfcModeTab.onclick = () => switchMode(AppMode.WFC_GENERATION);
editModeTab.onclick = () => switchMode(AppMode.IMAGE_EDITING);
gameModeTab.onclick = () => switchMode(AppMode.DUNGEON_CRAWLER);

// Initialize the application
const mainElem = document.querySelector("main");
if (mainElem) {
  const content = buildDomTree(
    mainElem, [
      document.createElement("h2"), ["Wave Function Collapse Dungeon Generator"],
      modeTabContainer, [
        inputModeTab,
        wfcModeTab,
        editModeTab,
        gameModeTab,
      ],
      contentContainer,
    ],
  );
  mainElem.appendChild(content);

  // Start with input mode
  switchMode(AppMode.INPUT);
}
