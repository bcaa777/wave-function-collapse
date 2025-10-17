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
  // Overrides available on the Assets page
  el.appendChild(row);

  return component;
}


