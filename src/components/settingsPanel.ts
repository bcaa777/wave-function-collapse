import { buildDomTree } from "../util";
import { IComponent } from "./component";
import { getSettings, setSetting, setSpriteOverride, setTextureOverride } from "../gameSettings";

export interface ISettingsPanel extends IComponent {}

export function createSettingsPanel(): ISettingsPanel {
  const el = Object.assign(document.createElement('div'), { className: 'settingsPanel' });
  const component: ISettingsPanel = { domElement: el };

  const s = getSettings();

  const lightInput = document.createElement('input');
  lightInput.type = 'range';
  lightInput.min = '0';
  lightInput.max = '10';
  lightInput.step = '0.1';
  lightInput.value = String(s.playerLightIntensity);
  lightInput.oninput = () => setSetting('playerLightIntensity', parseFloat(lightInput.value));

  const postToggle = document.createElement('input');
  postToggle.type = 'checkbox';
  postToggle.checked = s.postProcessingEnabled;
  postToggle.onchange = () => setSetting('postProcessingEnabled', postToggle.checked);

  const paletteSelect = document.createElement('select');
  ['None','GameBoy','CRT','Retro16'].forEach((label, i) => {
    const opt = document.createElement('option'); opt.value = String(i); opt.text = label; paletteSelect.appendChild(opt);
  });
  paletteSelect.value = String(s.paletteMode);
  paletteSelect.onchange = () => setSetting('paletteMode', parseInt(paletteSelect.value, 10) as 0|1|2|3);

  // Asset overrides moved to dedicated Assets page; keep settings panel minimal

  const row = document.createElement('div'); row.className = 'row g-2';
  const col = (child: HTMLElement, label: string) => {
    const c = document.createElement('div'); c.className = 'col-auto d-flex align-items-center gap-2';
    const l = document.createElement('span'); l.className = 'text-secondary small'; l.textContent = label;
    c.appendChild(l); c.appendChild(child); return c;
  };
  row.appendChild(col(lightInput, 'Player Light'));
  row.appendChild(col(postToggle, 'Post FX'));
  row.appendChild(col(paletteSelect, 'Palette'));
  // Height controls
  const modeSel = document.createElement('select');
  ['lightness','quantized','heightmap','procedural'].forEach((m) => { const o = document.createElement('option'); o.value = m; o.text = m; modeSel.appendChild(o); });
  modeSel.value = (s as any).heightMode || 'quantized';
  modeSel.onchange = () => setSetting('heightMode', modeSel.value as any);
  row.appendChild(col(modeSel, 'Height Mode'));

  const scaleInput = document.createElement('input'); scaleInput.type = 'range'; scaleInput.min = '1'; scaleInput.max = '50'; scaleInput.step = '1';
  scaleInput.value = String((s as any).heightScaleMeters ?? 6);
  scaleInput.oninput = () => setSetting('heightScaleMeters', parseFloat(scaleInput.value));
  row.appendChild(col(scaleInput, 'Height Scale (m)'));

  const levelsInput = document.createElement('input'); levelsInput.type = 'range'; levelsInput.min = '2'; levelsInput.max = '20'; levelsInput.step = '1';
  levelsInput.value = String((s as any).heightLevels ?? 6);
  levelsInput.oninput = () => setSetting('heightLevels', parseInt(levelsInput.value, 10));
  row.appendChild(col(levelsInput, 'Levels'));

  const baseInput = document.createElement('input'); baseInput.type = 'number'; baseInput.step = '0.5'; baseInput.value = String((s as any).heightBaseMeters ?? 0);
  baseInput.oninput = () => setSetting('heightBaseMeters', parseFloat(baseInput.value));
  row.appendChild(col(baseInput, 'Base (m)'));

  // Procedural params
  const smoothInput = document.createElement('input'); smoothInput.type = 'range'; smoothInput.min = '0'; smoothInput.max = '5'; smoothInput.step = '1';
  smoothInput.value = String((s as any).heightSmoothingPasses ?? 2);
  smoothInput.oninput = () => setSetting('heightSmoothingPasses', parseInt(smoothInput.value, 10));
  row.appendChild(col(smoothInput, 'Smooth Passes'));

  const blurInput = document.createElement('input'); blurInput.type = 'range'; blurInput.min = '0'; blurInput.max = '3'; blurInput.step = '1';
  blurInput.value = String((s as any).heightBlurRadius ?? 1);
  blurInput.oninput = () => setSetting('heightBlurRadius', parseInt(blurInput.value, 10));
  row.appendChild(col(blurInput, 'Blur Radius'));

  const blurType = document.createElement('select');
  ;['box','gaussian'].forEach((m) => { const o = document.createElement('option'); o.value = m; o.text = m; blurType.appendChild(o); });
  blurType.value = (s as any).heightBlurType ?? 'gaussian';
  blurType.onchange = () => setSetting('heightBlurType', blurType.value as any);
  row.appendChild(col(blurType, 'Blur Type'));

  const freqInput = document.createElement('input'); freqInput.type = 'range'; freqInput.min = '0.5'; freqInput.max = '6'; freqInput.step = '0.1';
  freqInput.value = String((s as any).heightNoiseFrequency ?? 1.2);
  freqInput.oninput = () => setSetting('heightNoiseFrequency', parseFloat(freqInput.value));
  row.appendChild(col(freqInput, 'Noise Freq'));

  const octInput = document.createElement('input'); octInput.type = 'range'; octInput.min = '1'; octInput.max = '6'; octInput.step = '1';
  octInput.value = String((s as any).heightNoiseOctaves ?? 4);
  octInput.oninput = () => setSetting('heightNoiseOctaves', parseInt(octInput.value, 10));
  row.appendChild(col(octInput, 'Octaves'));

  const seedInput = document.createElement('input'); seedInput.type = 'number'; seedInput.step = '1'; seedInput.value = String((s as any).heightSeed ?? 1337);
  seedInput.oninput = () => setSetting('heightSeed', parseInt(seedInput.value, 10));
  row.appendChild(col(seedInput, 'Seed'));

  const slopeInput = document.createElement('input'); slopeInput.type = 'range'; slopeInput.min = '0.05'; slopeInput.max = '1.0'; slopeInput.step = '0.05';
  slopeInput.value = String((s as any).heightMaxSlopePerTile ?? 0.25);
  slopeInput.oninput = () => setSetting('heightMaxSlopePerTile', parseFloat(slopeInput.value));
  row.appendChild(col(slopeInput, 'Max Slope m/tile'));

  const relaxInput = document.createElement('input'); relaxInput.type = 'range'; relaxInput.min = '0'; relaxInput.max = '4'; relaxInput.step = '1';
  relaxInput.value = String((s as any).heightRelaxPasses ?? 1);
  relaxInput.oninput = () => setSetting('heightRelaxPasses', parseInt(relaxInput.value, 10));
  row.appendChild(col(relaxInput, 'Relax Passes'));

  const subdivInput = document.createElement('input'); subdivInput.type = 'range'; subdivInput.min = '1'; subdivInput.max = '4'; subdivInput.step = '1';
  subdivInput.value = String((s as any).heightMeshSubdivision ?? 2);
  subdivInput.oninput = () => setSetting('heightMeshSubdivision', parseInt(subdivInput.value, 10));
  row.appendChild(col(subdivInput, 'Mesh Subdiv'));
  // Overrides available on the Assets page
  el.appendChild(row);

  return component;
}


