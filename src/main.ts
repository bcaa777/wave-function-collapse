
import { IWaveFunctionCollapse, createWaveFunctionCollapse } from "./wfc/run";
import { buildDomTree } from "./util";
import { createWfcOptions } from "./components/wfcOptions";
import { createPresetPicker } from "./components/presetPicker";
import { createDrawingCanvas } from "./components/drawingCanvas";

let wfc: IWaveFunctionCollapse | undefined;

const canvas = document.createElement("canvas");
canvas.className = "wfcOutput";
canvas.width = 0;
canvas.height = 0;

const wfcOptions = createWfcOptions();
let inputBitmap: ImageData | undefined;

const start = () => {
  if (wfc) {
    wfc.stop();
  }

  if (!inputBitmap) {
    return;
  }

  // Disable download button while generating
  downloadButton.disabled = true;

  wfc = createWaveFunctionCollapse(inputBitmap, canvas, wfcOptions.options, () => {
    // Enable download button when generation completes
    downloadButton.disabled = false;
  });
};

// Create input method tabs
const tabContainer = document.createElement("div");
tabContainer.className = "tabContainer";

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
  start();
};

// Drawing canvas
const drawingCanvas = createDrawingCanvas();
drawingCanvas.onDrawComplete = (image) => {
  inputBitmap = image;
  wfcOptions.updateOptions({}); // Reset to defaults for custom drawings
  start();
};

// Tab switching logic
function switchTab(activeTab: HTMLElement, inactiveTab: HTMLElement, showElement: Node) {
  activeTab.classList.add("active");
  inactiveTab.classList.remove("active");

  // Clear and add the correct input method
  inputContainer.innerHTML = "";
  inputContainer.appendChild(showElement);
}

presetTab.onclick = () => switchTab(presetTab, drawTab, presetPicker.domElement);
drawTab.onclick = () => switchTab(drawTab, presetTab, drawingCanvas.domElement);

// Initialize with preset picker
inputContainer.appendChild(presetPicker.domElement);

const restartWfc = document.createElement("input");
restartWfc.type = "button";
restartWfc.value = "Restart Generation";
restartWfc.onclick = start;

const downloadButton = document.createElement("input");
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

const mainElem = document.querySelector("main");
if (mainElem) {
  const content = buildDomTree(
    mainElem, [
      document.createElement("h2"), ["Input bitmap"],
      tabContainer, [
        presetTab,
        drawTab,
      ],
      inputContainer,
      document.createElement("h2"), ["Options"],
      wfcOptions.domElement,
      document.createElement("h2"), ["Output"],
      document.createElement("div"), [
        restartWfc,
        downloadButton,
      ],
      canvas,
    ],
  );
  mainElem.appendChild(content);
}
