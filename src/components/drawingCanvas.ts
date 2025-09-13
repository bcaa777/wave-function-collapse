import { buildDomTree } from "../util";
import { IComponent } from "./component";
import { inputGroup } from "./common";
import { IWfcOptions } from "../wfc/run";

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
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    canvas.style.width = `${canvasSize * scaleFactor}px`;
    canvas.style.height = `${canvasSize * scaleFactor}px`;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
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
    inputGroup(), [
      document.createElement("label"), ["Canvas Size: ", sizeSelect],
      document.createElement("label"), ["Tool: ", toolSelect],
      document.createElement("label"), ["Color: ", colorInput],
      widthLabel, widthInput,
    ],
    inputGroup(), [
      clearButton,
      useDrawingButton,
    ],
    canvas,
  ]);

  return component;
}
