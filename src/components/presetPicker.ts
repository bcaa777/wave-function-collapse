import getImageData from "../getImageData";
import { buildDomTree } from "../util";
import { IComponent } from "./component";
import { createSelectInput } from "./inputs";
import { inputGroup } from "./common";
import { presets, presetDefaults, getPresetPath } from "../presets";
import { IWfcOptions } from "../wfc/run";

interface IComponentPresetPicker extends IComponent {
  onPick?: (image: ImageData, options: Partial<IWfcOptions>) => void;
}

export function createPresetPicker(): IComponentPresetPicker {

  const presetPicker: IComponentPresetPicker = {
    domElement: Object.assign(document.createElement("div"), { className: "presetPickerComponent card" }),
  };

  const onPick = (image: ImageData, options: Partial<IWfcOptions>) => {
    if (presetPicker.onPick) {
      presetPicker.onPick(image, options);
    }
  };

  const previewImage = document.createElement("img");
  previewImage.className = "presetPreview";
  previewImage.style.display = "none";

  const imageInput = document.createElement("input");
  imageInput.type = "file";
  imageInput.accept = "image/*";

  const presetChoices = [];
  for (const preset of presets) {
    presetChoices.push({ label: preset.name || "", value: preset });
  }
  const presetSelect = createSelectInput("Preset", presetChoices);

  // HSL demo presets (programmatic)
  const hslDemoChoices = [
    { label: "HSL: Terraces + Stairs", value: "terraces" },
    { label: "HSL: Biomes + Heights", value: "biomes" },
    { label: "HSL: Ramp 0-100m", value: "ramp" },
  ];
  const hslSelect = createSelectInput("HSL Demo", hslDemoChoices);

  imageInput.onchange = () => {
    if (imageInput.files) {
      const path = URL.createObjectURL(imageInput.files[0]);
      getImageData(path).then((image) => onPick(image, {}));
      presetSelect.deselect();
      previewImage.src = path;
      previewImage.style.display = "";
    }
  };

  presetSelect.onInput = (value) => {
    imageInput.value = "";
    const preset = {...presetDefaults, ...value};
    const path = getPresetPath(preset.name);
    getImageData(path).then((image) => onPick(image, preset));
    previewImage.src = path;
    previewImage.style.display = "";
  };

  hslSelect.onInput = (kind) => {
    imageInput.value = "";
    const image = generateHslDemo(kind as string);
    onPick(image, {});
    previewImage.style.display = "none";
  };

  buildDomTree(presetPicker.domElement, [
    document.createElement("p"), [
      "Select a preset or upload a custom image. Custom images should be simple - e.g. less than 64x64 pixels, with only a handful of colors.",
    ],
    inputGroup(), [
      presetSelect.domElement,
    ],
    inputGroup(), [
      hslSelect.domElement,
    ],
    inputGroup(), [
      document.createElement("label"), [
        "Custom Bitmap ", imageInput,
      ],
    ],
    previewImage,
  ]);

  return presetPicker;
}

function generateHslDemo(kind: string): ImageData {
  const w = 48, h = 48;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

  function put(x: number, y: number, r: number, g: number, b: number) {
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(x, y, 1, 1);
  }

  // Helper fixed colors for start/finish and stairs
  const START = [0x00, 0x64, 0x00]; // #006400
  const FINISH = [0x8B, 0x00, 0x00]; // #8B0000
  const STAIRS = [0xC0, 0xC0, 0xC0]; // #C0C0C0
  const WALL = [0x00, 0x00, 0x00]; // #000000

  if (kind === 'ramp') {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const l = Math.round((x / (w - 1)) * 255); // 0..255
        // Use green hue for walkable floor, lightness encodes height
        put(x, y, l * 0.2, Math.min(255, l + 40), l * 0.2);
      }
    }
    // start and finish
    put(2, Math.floor(h / 2), START[0], START[1], START[2]);
    put(w - 3, Math.floor(h / 2), FINISH[0], FINISH[1], FINISH[2]);
    return (ctx.getImageData(0, 0, w, h));
  }

  if (kind === 'biomes') {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const band = Math.floor((y / h) * 4);
        const l = Math.round((x / (w - 1)) * 200 + 30);
        if (band === 0) { // water band (blue)
          put(x, y, 40, 80, Math.min(255, l));
        } else if (band === 1) { // grass band (green)
          put(x, y, 30, Math.min(255, l), 30);
        } else if (band === 2) { // danger band (red)
          put(x, y, Math.min(255, l), 30, 30);
        } else { // fire band (orange)
          put(x, y, Math.min(255, l), Math.round(l * 0.6), 20);
        }
      }
    }
    // walls strip on left/right
    for (let y = 0; y < h; y++) { put(0, y, WALL[0], WALL[1], WALL[2]); put(w - 1, y, WALL[0], WALL[1], WALL[2]); }
    // start and finish
    put(2, 2, START[0], START[1], START[2]);
    put(w - 3, h - 3, FINISH[0], FINISH[1], FINISH[2]);
    return ctx.getImageData(0, 0, w, h);
  }

  // terraces
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const tier = Math.floor((y / h) * 5); // 5 terraces
      const l = 40 + tier * 35; // step in lightness
      // neutral floor hue (greenish)
      put(x, y, 40, Math.min(255, l), 40);
    }
  }
  // draw horizontal stair lines between terraces using light gray
  for (let t = 1; t < 5; t++) {
    const yLine = Math.floor((t * h) / 5);
    for (let x = 4; x < w - 4; x++) put(x, yLine, STAIRS[0], STAIRS[1], STAIRS[2]);
  }
  // perimeter walls
  for (let y = 0; y < h; y++) { put(0, y, WALL[0], WALL[1], WALL[2]); put(w - 1, y, WALL[0], WALL[1], WALL[2]); }
  for (let x = 0; x < w; x++) { put(x, 0, WALL[0], WALL[1], WALL[2]); put(x, h - 1, WALL[0], WALL[1], WALL[2]); }
  // start/finish
  put(2, 2, START[0], START[1], START[2]);
  put(w - 3, h - 3, FINISH[0], FINISH[1], FINISH[2]);
  return ctx.getImageData(0, 0, w, h);
}
