export type SettingsListener = (key: keyof GameSettings, value: any) => void;

export interface GameSettings {
  playerLightIntensity: number;
  postProcessingEnabled: boolean;
  paletteMode: 0 | 1 | 2 | 3;
  useProceduralSprites: boolean;
  spriteOverrides: Map<string, string>; // name -> dataURL/objectURL
  textureOverrides: Map<string, string>; // name -> path/dataURL
  heightMode: 'lightness' | 'quantized' | 'heightmap' | 'procedural';
  heightScaleMeters: number; // meters per full lightness range
  heightLevels: number; // for quantized mode
  heightBaseMeters: number; // offset
  heightSmoothingPasses: number;
  heightBlurRadius: number;
  heightBlurType: 'box' | 'gaussian';
  heightNoiseFrequency: number;
  heightNoiseOctaves: number;
  heightSeed: number;
  heightMaxSlopePerTile: number; // meters per tile
  heightRelaxPasses: number;
  heightMeshSubdivision: number; // extra mesh resolution per tile (1..4)
}

const settings: GameSettings = {
  playerLightIntensity: 5.0,
  postProcessingEnabled: false,
  paletteMode: 0,
  useProceduralSprites: true,
  spriteOverrides: new Map(),
  textureOverrides: new Map(),
  heightMode: 'quantized',
  heightScaleMeters: 6.0,
  heightLevels: 6,
  heightBaseMeters: 0.0,
  heightSmoothingPasses: 2,
  heightBlurRadius: 1,
  heightBlurType: 'gaussian',
  heightNoiseFrequency: 1.2,
  heightNoiseOctaves: 4,
  heightSeed: 1337,
  heightMaxSlopePerTile: 0.25,
  heightRelaxPasses: 1,
  heightMeshSubdivision: 2
};

const listeners = new Set<SettingsListener>();

export function getSettings(): GameSettings {
  return settings;
}

export function setSetting<K extends keyof GameSettings>(key: K, value: GameSettings[K]): void {
  (settings as any)[key] = value as any;
  listeners.forEach(l => l(key, value));
}

export function onSettingsChange(listener: SettingsListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setSpriteOverride(name: string, url: string) {
  settings.spriteOverrides.set(name, url);
  listeners.forEach(l => l('spriteOverrides', settings.spriteOverrides));
}

export function setTextureOverride(name: string, url: string) {
  settings.textureOverrides.set(name, url);
  listeners.forEach(l => l('textureOverrides', settings.textureOverrides));
}


