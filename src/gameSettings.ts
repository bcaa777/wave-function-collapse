export type SettingsListener = (key: keyof GameSettings, value: any) => void;

export interface GameSettings {
  playerLightIntensity: number;
  postProcessingEnabled: boolean;
  paletteMode: 0 | 1 | 2 | 3;
  useProceduralSprites: boolean;
  spriteOverrides: Map<string, string>; // name -> dataURL/objectURL
  textureOverrides: Map<string, string>; // name -> path/dataURL
}

const settings: GameSettings = {
  playerLightIntensity: 5.0,
  postProcessingEnabled: false,
  paletteMode: 0,
  useProceduralSprites: true,
  spriteOverrides: new Map(),
  textureOverrides: new Map()
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


