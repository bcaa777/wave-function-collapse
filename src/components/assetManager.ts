import { buildDomTree } from "../util";
import { IComponent } from "./component";
import { getSettings, setSpriteOverride, setTextureOverride } from "../gameSettings";

export interface IAssetManager extends IComponent {}

const SPRITES = ['enemy','danger','finish','treasure','key','door','stairs','blade','fire','water','grass'];
const TEXTURES = ['wall_brick','wall_stone','floor_stone','ceiling_stone','water_texture','grass_texture','danger_texture','fire_texture','wood_texture','metal_texture'];

export function createAssetManager(): IAssetManager {
  const el = Object.assign(document.createElement('div'), { className: 'assetManager card' });
  const title = document.createElement('h5'); title.textContent = 'Assets'; title.className = 'mb-3';
  el.appendChild(title);

  const grid = document.createElement('div'); grid.className = 'row row-cols-1 row-cols-sm-2 row-cols-lg-3 g-3';
  el.appendChild(grid);

  function addUploader(name: string, kind: 'sprite'|'texture') {
    const col = document.createElement('div'); col.className = 'col';
    const card = document.createElement('div'); card.className = 'p-3 rounded-3 bg-dark border border-secondary';
    const label = document.createElement('div'); label.className = 'text-secondary small mb-2'; label.textContent = `${kind.toUpperCase()}: ${name}`;
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.className = 'form-control form-control-sm';
    input.onchange = () => {
      const f = input.files && input.files[0]; if (!f) return;
      const url = URL.createObjectURL(f);
      if (kind === 'sprite') setSpriteOverride(name, url); else setTextureOverride(name, url);
      const preview = card.querySelector('img') as HTMLImageElement; if (preview) preview.src = url;
    };
    const preview = document.createElement('img'); preview.className = 'img-fluid rounded mt-2'; preview.style.maxHeight = '80px';
    card.appendChild(label); card.appendChild(input); card.appendChild(preview);
    col.appendChild(card); grid.appendChild(col);
  }

  SPRITES.forEach(n => addUploader(n,'sprite'));
  TEXTURES.forEach(n => addUploader(n,'texture'));

  const save = document.createElement('button'); save.textContent = 'Save to Browser'; save.className = 'btn btn-success mt-3';
  save.onclick = () => {
    const s = getSettings();
    const serialized = {
      sprites: Array.from(s.spriteOverrides.entries()),
      textures: Array.from(s.textureOverrides.entries())
    };
    localStorage.setItem('wfc-assets', JSON.stringify(serialized));
    save.textContent = 'Saved ✓'; setTimeout(() => save.textContent = 'Save to Browser', 1200);
  };
  el.appendChild(save);

  const load = document.createElement('button'); load.textContent = 'Load from Browser'; load.className = 'btn btn-secondary mt-3 ms-2';
  load.onclick = () => {
    const raw = localStorage.getItem('wfc-assets'); if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed.sprites) parsed.sprites.forEach(([k,v]: [string,string]) => setSpriteOverride(k,v));
    if (parsed.textures) parsed.textures.forEach(([k,v]: [string,string]) => setTextureOverride(k,v));
  };
  el.appendChild(load);

  return { domElement: el };
}


