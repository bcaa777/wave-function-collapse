import { buildDomTree } from "../util";
import { IComponent } from "./component";
import { DEFAULT_COLOR_MAPPINGS, getElementProperties, GameElement } from "../colorMapping";

export interface IComponentColorReference extends IComponent {
  updateMappings(mappings?: typeof DEFAULT_COLOR_MAPPINGS): void;
  onColorSelect?: (color: string) => void;
}

export function createColorReference(): IComponentColorReference {
  const component: IComponentColorReference = {
    domElement: Object.assign(document.createElement("div"), { className: "colorReferenceComponent" }),
    updateMappings: (mappings = DEFAULT_COLOR_MAPPINGS) => {
      updateColorGrid(mappings);
    }
  };

  // Color mapping descriptions
  const colorDescriptions: { [key: string]: string } = {
    '#000000': 'Wall (impassable)',
    '#FF0000': 'Danger (damage over time)',
    '#0000FF': 'Water (slows movement)',
    '#800080': 'Enemy (attacks on contact)',
    '#008000': 'Grass (safe terrain)',
    '#FFA500': 'Fire (dangerous)',
    '#006400': 'Player Start',
    '#8B0000': 'Player Finish/Exit',
    '#FFFF00': 'Treasure (collectible)',
    '#FFD700': 'Key (unlocks doors)',
    '#8B4513': 'Door (locked, needs key)',
    '#C0C0C0': 'Stairs (interactive)',
    '#FFFFFF': 'Floor (default)'
  };

  function updateColorGrid(mappings: typeof DEFAULT_COLOR_MAPPINGS) {
    // Clear existing content
    (component.domElement as HTMLElement).innerHTML = '';

    const colorGrid = document.createElement("div");
    colorGrid.className = "colorGrid";

    const title = document.createElement("h4");
    title.textContent = "Color Reference Guide";
    title.style.marginBottom = "10px";

    colorGrid.appendChild(title);

    // Sort colors by their hex value for consistent display
    const sortedColors = Object.entries(mappings).sort(([a], [b]) => a.localeCompare(b));

    sortedColors.forEach(([hexColor, gameElement]) => {
      const colorItem = document.createElement("div");
      colorItem.className = "colorItem";

      const colorSwatch = document.createElement("div");
      colorSwatch.className = "colorSwatch";
      colorSwatch.style.backgroundColor = hexColor;
      colorSwatch.style.cursor = "pointer";

      // Add border for white color to make it visible
      if (hexColor === '#FFFFFF') {
        colorSwatch.style.border = "1px solid #ccc";
      }

      // Make swatch clickable
      colorSwatch.onclick = () => {
        if (component.onColorSelect) {
          component.onColorSelect(hexColor);
        }
      };

      // Add hover effect
      colorSwatch.onmouseenter = () => {
        colorSwatch.style.transform = "scale(1.1)";
        colorSwatch.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";
      };

      colorSwatch.onmouseleave = () => {
        colorSwatch.style.transform = "scale(1)";
        colorSwatch.style.boxShadow = "none";
      };

      const colorInfo = document.createElement("div");
      colorInfo.className = "colorInfo";

      const colorHex = document.createElement("div");
      colorHex.className = "colorHex";
      colorHex.textContent = hexColor.toUpperCase();

      const colorDesc = document.createElement("div");
      colorDesc.className = "colorDesc";
      colorDesc.textContent = colorDescriptions[hexColor] || `${gameElement.replace('_', ' ')}`;

      const elementProps = getElementProperties(gameElement);
      const colorProps = document.createElement("div");
      colorProps.className = "colorProps";

      // Add property indicators
      if (elementProps.walkable) {
        colorProps.innerHTML += '<span class="prop walkable">Walkable</span>';
      } else {
        colorProps.innerHTML += '<span class="prop blocked">Blocked</span>';
      }

      if (elementProps.dangerous) {
        colorProps.innerHTML += '<span class="prop dangerous">Danger</span>';
      }

      if (elementProps.collectible) {
        colorProps.innerHTML += '<span class="prop collectible">Collectible</span>';
      }

      if (elementProps.interactive) {
        colorProps.innerHTML += '<span class="prop interactive">Interactive</span>';
      }

      colorInfo.appendChild(colorHex);
      colorInfo.appendChild(colorDesc);
      colorInfo.appendChild(colorProps);

      colorItem.appendChild(colorSwatch);
      colorItem.appendChild(colorInfo);

      colorGrid.appendChild(colorItem);
    });

    component.domElement.appendChild(colorGrid);
  }

  // Initialize with default mappings
  component.updateMappings();

  return component;
}
