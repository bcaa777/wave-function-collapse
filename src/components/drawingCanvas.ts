import { buildDomTree } from "../util";
import { IComponent } from "./component";
import { inputGroup } from "./common";
import { IWfcOptions } from "../wfc/run";
import { DEFAULT_COLOR_MAPPINGS, getElementProperties, GameElement } from "../colorMapping";

export type DrawingTool = 'pen' | 'eraser' | 'rectangle' | 'circle' | 'line' | 'spray' | 'bucket';

interface IComponentDrawingCanvas extends IComponent {
  onDrawComplete?: (image: ImageData) => void;
  getImageData(): ImageData | null;
  clear(): void;
}

export function createDrawingCanvas(): IComponentDrawingCanvas {

  const component: IComponentDrawingCanvas = {
    domElement: Object.assign(document.createElement("div"), { className: "drawingCanvasComponent" }),
    getImageData: () => {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      return imageData;
    },
    clear: () => {
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      saveCanvasState();
    }
  };

  // Drawing state
  let isDrawing = false;
  let lastX = 0;
  let lastY = 0;
  let currentTool: DrawingTool = 'pen';
  let currentColor = '#000000';
  let lineWidth = 2;
  let startX = 0;
  let startY = 0;
  let canvasSize = 32;
  let scaleFactor = 16; // Display scale - increased for better pixel visibility

  // Undo functionality
  let canvasHistory: ImageData[] = [];
  let historyIndex = -1;
  const maxHistory = 50; // Maximum undo steps

  // Action colors palette
  const actionColorsContainer = document.createElement("div");
  actionColorsContainer.className = "actionColorsContainer";
  actionColorsContainer.style.display = "flex";
  actionColorsContainer.style.flexWrap = "wrap";
  actionColorsContainer.style.gap = "4px";
  actionColorsContainer.style.marginBottom = "10px";
  actionColorsContainer.style.padding = "8px";
  actionColorsContainer.style.backgroundColor = "#f5f5f5";
  actionColorsContainer.style.borderRadius = "4px";

  const actionColorsTitle = document.createElement("div");
  actionColorsTitle.textContent = "Action Colors (click to select):";
  actionColorsTitle.style.fontSize = "12px";
  actionColorsTitle.style.fontWeight = "bold";
  actionColorsTitle.style.marginBottom = "6px";
  actionColorsTitle.style.width = "100%";

  actionColorsContainer.appendChild(actionColorsTitle);

  // Create color buttons for functional elements
  const actionColors = [
    { color: '#000000', element: GameElement.WALL, name: 'Wall' },
    { color: '#FF0000', element: GameElement.DANGER, name: 'Danger' },
    { color: '#0000FF', element: GameElement.WATER, name: 'Water' },
    { color: '#800080', element: GameElement.ENEMY, name: 'Enemy' },
    { color: '#008000', element: GameElement.GRASS, name: 'Grass' },
    { color: '#FFA500', element: GameElement.FIRE, name: 'Fire' },
    { color: '#006400', element: GameElement.PLAYER_START, name: 'Start' },
    { color: '#8B0000', element: GameElement.PLAYER_FINISH, name: 'Finish' },
    { color: '#FFFF00', element: GameElement.TREASURE, name: 'Treasure' },
    { color: '#FFD700', element: GameElement.KEY, name: 'Key' },
    { color: '#8B4513', element: GameElement.DOOR, name: 'Door' },
    { color: '#C0C0C0', element: GameElement.STAIRS, name: 'Stairs' },
    { color: '#FFFFFF', element: GameElement.FLOOR, name: 'Floor' },
  ];

  actionColors.forEach(({ color, element, name }) => {
    const colorButton = document.createElement("button");
    colorButton.className = "actionColorButton";
    colorButton.style.width = "60px";
    colorButton.style.height = "40px";
    colorButton.style.border = "2px solid #ccc";
    colorButton.style.borderRadius = "4px";
    colorButton.style.cursor = "pointer";
    colorButton.style.backgroundColor = color;
    colorButton.style.display = "flex";
    colorButton.style.flexDirection = "column";
    colorButton.style.alignItems = "center";
    colorButton.style.justifyContent = "center";
    colorButton.style.fontSize = "9px";
    colorButton.style.fontWeight = "bold";
    colorButton.style.color = getContrastColor(color);
    colorButton.style.textShadow = "0 0 2px rgba(255,255,255,0.8)";
    colorButton.style.position = "relative";

    // Add border for white color to make it visible
    if (color === '#FFFFFF') {
      colorButton.style.border = "2px solid #333";
      colorButton.style.boxShadow = "inset 0 0 0 1px #333";
    }

    // Add tooltip with full name
    colorButton.title = `${name} (${color})`;

    // Add element properties indicator
    const props = getElementProperties(element);
    const indicators = [];
    if (!props.walkable) indicators.push('🚫');
    if (props.dangerous) indicators.push('⚠️');
    if (props.collectible) indicators.push('💎');
    if (props.interactive) indicators.push('🎯');

    const indicatorText = indicators.join('');
    if (indicatorText) {
      const indicator = document.createElement("span");
      indicator.textContent = indicatorText;
      indicator.style.fontSize = "8px";
      indicator.style.position = "absolute";
      indicator.style.top = "2px";
      indicator.style.right = "2px";
      colorButton.appendChild(indicator);
    }

    // Shortened name for button
    const shortName = name.length > 6 ? name.substring(0, 6) : name;
    const nameSpan = document.createElement("span");
    nameSpan.textContent = shortName;
    colorButton.appendChild(nameSpan);

    // Click handler
    colorButton.onclick = () => {
      currentColor = color;
      colorInput.value = color;

      // Add visual feedback
      colorButton.style.transform = "scale(0.95)";
      setTimeout(() => {
        colorButton.style.transform = "scale(1)";
      }, 100);
    };

    // Hover effects
    colorButton.onmouseenter = () => {
      colorButton.style.transform = "scale(1.05)";
      colorButton.style.boxShadow = "0 2px 8px rgba(0,0,0,0.3)";
    };

    colorButton.onmouseleave = () => {
      colorButton.style.transform = "scale(1)";
      colorButton.style.boxShadow = "none";
    };

    actionColorsContainer.appendChild(colorButton);
  });

  // Helper function to get contrasting text color
  function getContrastColor(bgColor: string): string {
    // Simple contrast calculation - return white for dark colors, black for light
    const hex = bgColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness > 128 ? '#000000' : '#FFFFFF';
  }

  // Create canvas
  const canvas = document.createElement("canvas");
  canvas.width = canvasSize;
  canvas.height = canvasSize;
  canvas.className = "drawingCanvas";
  canvas.style.border = "1px solid #ccc";
  canvas.style.cursor = "crosshair";
  canvas.style.width = `${canvasSize * scaleFactor}px`;
  canvas.style.height = `${canvasSize * scaleFactor}px`;
  canvas.style.imageRendering = "pixelated";

  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Canvas size selection
  const sizeSelect = document.createElement("select");
  sizeSelect.innerHTML = `
    <option value="16">16x16</option>
    <option value="32">32x32</option>
    <option value="64">64x64</option>
  `;
  sizeSelect.value = canvasSize.toString();
  sizeSelect.onchange = () => {
    canvasSize = parseInt(sizeSelect.value);
    updateCanvasSize();
  };

  // Tool selection
  const toolSelect = document.createElement("select");
  toolSelect.innerHTML = `
    <option value="pen">Pen</option>
    <option value="eraser">Eraser</option>
    <option value="bucket">Paint Bucket</option>
    <option value="rectangle">Rectangle</option>
    <option value="circle">Circle</option>
    <option value="line">Line</option>
    <option value="spray">Spray</option>
  `;
  toolSelect.value = currentTool;
  toolSelect.onchange = () => {
    currentTool = toolSelect.value as DrawingTool;
    canvas.style.cursor = currentTool === 'eraser' ? 'not-allowed' :
                         currentTool === 'bucket' ? 'pointer' : 'crosshair';
  };

  // Color picker
  const colorInput = document.createElement("input");
  colorInput.type = "color";
  colorInput.value = currentColor;
  colorInput.onchange = () => {
    currentColor = colorInput.value;
  };

  // Line width slider
  const widthLabel = document.createElement("label");
  widthLabel.textContent = "Size: ";

  const widthInput = document.createElement("input");
  widthInput.type = "range";
  widthInput.min = "1";
  widthInput.max = "20";
  widthInput.value = lineWidth.toString();
  widthInput.oninput = () => {
    lineWidth = parseInt(widthInput.value);
  };

  // Clear button
  const clearButton = document.createElement("input");
  clearButton.type = "button";
  clearButton.value = "Clear Canvas";
  clearButton.onclick = () => {
    component.clear();
  };

  // Undo button
  const undoButton = document.createElement("input");
  undoButton.type = "button";
  undoButton.value = "Undo";
  undoButton.disabled = true;
  undoButton.onclick = () => {
    undo();
  };

  // Use drawing button
  const useDrawingButton = document.createElement("input");
  useDrawingButton.type = "button";
  useDrawingButton.value = "Use This Drawing";
  useDrawingButton.onclick = () => {
    const imageData = component.getImageData();
    if (imageData && component.onDrawComplete) {
      component.onDrawComplete(imageData);
    }
  };

  // Helper functions
  function updateCanvasSize() {
    canvasSize = parseInt(sizeSelect.value);
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    canvas.style.width = `${canvasSize * scaleFactor}px`;
    canvas.style.height = `${canvasSize * scaleFactor}px`;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    saveCanvasState(); // Save state after resize
  }

  function getCanvasCoordinates(e: MouseEvent) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  function saveCanvasState() {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Remove any history after current index (when user draws after undoing)
    canvasHistory = canvasHistory.slice(0, historyIndex + 1);

    // Add new state
    canvasHistory.push(imageData);

    // Keep only the last maxHistory states
    if (canvasHistory.length > maxHistory) {
      canvasHistory.shift();
    } else {
      historyIndex++;
    }

    // Enable undo button if we have history
    undoButton.disabled = historyIndex <= 0;
  }

  function undo() {
    if (historyIndex > 0) {
      historyIndex--;
      const previousState = canvasHistory[historyIndex];
      ctx.putImageData(previousState, 0, 0);
      undoButton.disabled = historyIndex <= 0;
    }
  }

  // Initialize canvas history with blank state
  saveCanvasState();

  // Drawing functions
  function startDrawing(e: MouseEvent) {
    isDrawing = true;
    const coords = getCanvasCoordinates(e);
    [lastX, lastY] = [coords.x, coords.y];
    [startX, startY] = [coords.x, coords.y];

    if ((currentTool === 'pen' || currentTool === 'eraser') && lineWidth === 1) {
      // For pixel-perfect pen with size 1, draw immediately on click
      ctx.fillStyle = currentTool === 'eraser' ? '#FFFFFF' : currentColor;
      ctx.fillRect(Math.floor(coords.x), Math.floor(coords.y), 1, 1);
    } else if (currentTool === 'pen' || currentTool === 'eraser') {
      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
    } else if (currentTool === 'bucket') {
      // For bucket tool, fill immediately on click
      floodFill(Math.floor(coords.x), Math.floor(coords.y), currentColor);
      saveCanvasState();
      isDrawing = false;
    }
  }

  function draw(e: MouseEvent) {
    if (!isDrawing) return;

    const coords = getCanvasCoordinates(e);
    const x = coords.x;
    const y = coords.y;

    ctx.strokeStyle = currentTool === 'eraser' ? '#FFFFFF' : currentColor;

    switch (currentTool) {
      case 'pen':
      case 'eraser':
        if (lineWidth === 1) {
          // Pixel-perfect drawing for size 1 - only draw if moved to a different pixel
          const currentPixelX = Math.floor(x);
          const currentPixelY = Math.floor(y);
          const lastPixelX = Math.floor(lastX);
          const lastPixelY = Math.floor(lastY);

          if (currentPixelX !== lastPixelX || currentPixelY !== lastPixelY) {
            ctx.fillStyle = currentTool === 'eraser' ? '#FFFFFF' : currentColor;
            ctx.fillRect(currentPixelX, currentPixelY, 1, 1);
          }
        } else {
          // Normal line drawing for larger sizes
          ctx.lineWidth = lineWidth;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.lineTo(x, y);
          ctx.stroke();
        }
        break;
      case 'spray':
        sprayPaint(x, y);
        break;
    }

    [lastX, lastY] = [x, y];
  }

  function stopDrawing(e: MouseEvent) {
    if (!isDrawing) return;
    isDrawing = false;

    const coords = getCanvasCoordinates(e);
    const x = coords.x;
    const y = coords.y;

    switch (currentTool) {
      case 'rectangle':
        drawRectangle(startX, startY, x, y);
        break;
      case 'circle':
        drawCircle(startX, startY, x, y);
        break;
      case 'line':
        drawLine(startX, startY, x, y);
        break;
    }

    // Save canvas state after drawing
    saveCanvasState();
  }

  function sprayPaint(x: number, y: number) {
    const density = 50;
    const radius = lineWidth * 2;

    for (let i = 0; i < density; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * radius;
      const sprayX = x + Math.cos(angle) * distance;
      const sprayY = y + Math.sin(angle) * distance;

      ctx.fillStyle = currentColor;
      ctx.beginPath();
      ctx.arc(sprayX, sprayY, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawRectangle(x1: number, y1: number, x2: number, y2: number) {
    const width = x2 - x1;
    const height = y2 - y1;

    ctx.strokeStyle = currentColor;
    ctx.lineWidth = lineWidth;
    ctx.strokeRect(x1, y1, width, height);
  }

  function drawCircle(x1: number, y1: number, x2: number, y2: number) {
    const radius = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);

    ctx.strokeStyle = currentColor;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.arc(x1, y1, radius, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawLine(x1: number, y1: number, x2: number, y2: number) {
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  function floodFill(startX: number, startY: number, fillColor: string) {
    // Get the image data
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Convert fill color to RGB
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.fillStyle = fillColor;
    tempCtx.fillRect(0, 0, 1, 1);
    const fillData = tempCtx.getImageData(0, 0, 1, 1).data;
    const fillR = fillData[0];
    const fillG = fillData[1];
    const fillB = fillData[2];

    // Get the color we're replacing
    const startIndex = (startY * canvas.width + startX) * 4;
    const targetR = data[startIndex];
    const targetG = data[startIndex + 1];
    const targetB = data[startIndex + 2];

    // Don't fill if the target color is the same as fill color
    if (targetR === fillR && targetG === fillG && targetB === fillB) {
      return;
    }

    // Flood fill using stack-based approach
    const stack: [number, number][] = [[startX, startY]];
    const visited = new Set<string>();

    while (stack.length > 0) {
      const [x, y] = stack.pop()!;
      const key = `${x},${y}`;

      if (visited.has(key) || x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) {
        continue;
      }

      const index = (y * canvas.width + x) * 4;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];

      // Check if this pixel matches the target color
      if (r === targetR && g === targetG && b === targetB) {
        // Fill the pixel
        data[index] = fillR;
        data[index + 1] = fillG;
        data[index + 2] = fillB;
        data[index + 3] = 255; // Alpha

        visited.add(key);

        // Add adjacent pixels to stack
        stack.push([x + 1, y]);
        stack.push([x - 1, y]);
        stack.push([x, y + 1]);
        stack.push([x, y - 1]);
      }
    }

    // Put the modified image data back
    ctx.putImageData(imageData, 0, 0);
  }

  // Event listeners
  canvas.addEventListener('mousedown', startDrawing);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', stopDrawing);
  canvas.addEventListener('mouseout', stopDrawing);

  // Build DOM
  buildDomTree(component.domElement, [
    document.createElement("p"), [
      "Create a custom image for wave function collapse. Draw simple patterns with distinct colors."
    ],
    actionColorsContainer,
    inputGroup(), [
      document.createElement("label"), ["Canvas Size: ", sizeSelect],
      document.createElement("label"), ["Tool: ", toolSelect],
      document.createElement("label"), ["Color: ", colorInput],
      widthLabel, widthInput,
    ],
    inputGroup(), [
      clearButton,
      undoButton,
      useDrawingButton,
    ],
    canvas,
  ]);

  return component;
}
