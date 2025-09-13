// Color mapping system for converting image colors to game elements
export enum GameElement {
  WALL = 'wall',
  DANGER = 'danger',
  WATER = 'water',
  ENEMY = 'enemy',
  GRASS = 'grass',
  FIRE = 'fire',
  PLAYER_START = 'player_start',
  PLAYER_FINISH = 'player_finish',
  FLOOR = 'floor',
  TREASURE = 'treasure',
  KEY = 'key',
  DOOR = 'door',
  STAIRS = 'stairs'
}

// Color to game element mapping
export interface ColorMapping {
  [color: string]: GameElement;
}

// Default color mappings based on user requirements
export const DEFAULT_COLOR_MAPPINGS: ColorMapping = {
  '#000000': GameElement.WALL,      // Black - wall
  '#FF0000': GameElement.DANGER,    // Red - danger
  '#0000FF': GameElement.WATER,     // Blue - water
  '#800080': GameElement.ENEMY,     // Purple - enemy
  '#008000': GameElement.GRASS,     // Green - grass
  '#FFA500': GameElement.FIRE,      // Orange - fire
  '#006400': GameElement.PLAYER_START,  // Dark green - player start
  '#8B0000': GameElement.PLAYER_FINISH, // Dark red - player finish

  // Additional mappings for more variety
  '#FFFF00': GameElement.TREASURE,  // Yellow - treasure
  '#FFD700': GameElement.KEY,       // Gold - key
  '#8B4513': GameElement.DOOR,      // Brown - door
  '#C0C0C0': GameElement.STAIRS,    // Silver - stairs
  '#FFFFFF': GameElement.FLOOR,     // White - floor (default)
};

export interface RGBColor {
  r: number;
  g: number;
  b: number;
}

export function hexToRgb(hex: string): RGBColor | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

export function rgbToHex(r: number, g: number, b: number): string {
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

export function colorDistance(color1: RGBColor, color2: RGBColor): number {
  return Math.sqrt(
    Math.pow(color1.r - color2.r, 2) +
    Math.pow(color1.g - color2.g, 2) +
    Math.pow(color1.b - color2.b, 2)
  );
}

// Find the closest matching color from the mapping
export function findClosestColor(r: number, g: number, b: number, mappings: ColorMapping): GameElement {
  const targetColor: RGBColor = { r, g, b };
  let closestElement = GameElement.FLOOR; // Default
  let minDistance = Infinity;

  for (const [hexColor, element] of Object.entries(mappings)) {
    const rgbColor = hexToRgb(hexColor);
    if (rgbColor) {
      const distance = colorDistance(targetColor, rgbColor);
      if (distance < minDistance) {
        minDistance = distance;
        closestElement = element;
      }
    }
  }

  return closestElement;
}

// Convert image data to game map
export function imageDataToGameMap(
  imageData: ImageData,
  mappings: ColorMapping = DEFAULT_COLOR_MAPPINGS
): GameElement[][] {
  const { data, width, height } = imageData;
  const gameMap: GameElement[][] = [];

  for (let y = 0; y < height; y++) {
    const row: GameElement[] = [];
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];

      const element = findClosestColor(r, g, b, mappings);
      row.push(element);
    }
    gameMap.push(row);
  }

  return gameMap;
}

// Find player start position
export function findPlayerStart(gameMap: GameElement[][]): { x: number; y: number } | null {
  for (let y = 0; y < gameMap.length; y++) {
    for (let x = 0; x < gameMap[y].length; x++) {
      if (gameMap[y][x] === GameElement.PLAYER_START) {
        return { x, y };
      }
    }
  }
  return null;
}

// Find player finish position
export function findPlayerFinish(gameMap: GameElement[][]): { x: number; y: number } | null {
  for (let y = 0; y < gameMap.length; y++) {
    for (let x = 0; x < gameMap[y].length; x++) {
      if (gameMap[y][x] === GameElement.PLAYER_FINISH) {
        return { x, y };
      }
    }
  }
  return null;
}

// Get all enemy positions
export function findEnemies(gameMap: GameElement[][]): { x: number; y: number }[] {
  const enemies: { x: number; y: number }[] = [];
  for (let y = 0; y < gameMap.length; y++) {
    for (let x = 0; x < gameMap[y].length; x++) {
      if (gameMap[y][x] === GameElement.ENEMY) {
        enemies.push({ x, y });
      }
    }
  }
  return enemies;
}

// Check if a position is walkable (not a wall)
export function isWalkable(gameMap: GameElement[][], x: number, y: number): boolean {
  if (y < 0 || y >= gameMap.length || x < 0 || x >= gameMap[y].length) {
    return false;
  }
  const element = gameMap[y][x];
  return element !== GameElement.WALL && element !== GameElement.DOOR;
}

// Get element properties for game logic
export interface ElementProperties {
  walkable: boolean;
  dangerous: boolean;
  collectible: boolean;
  interactive: boolean;
  description: string;
}

export function getElementProperties(element: GameElement): ElementProperties {
  switch (element) {
    case GameElement.WALL:
      return {
        walkable: false,
        dangerous: false,
        collectible: false,
        interactive: false,
        description: "A solid wall blocking your path."
      };

    case GameElement.DANGER:
      return {
        walkable: true,
        dangerous: true,
        collectible: false,
        interactive: false,
        description: "Dangerous terrain that damages you when stepped on."
      };

    case GameElement.WATER:
      return {
        walkable: true,
        dangerous: false,
        collectible: false,
        interactive: false,
        description: "Water that slows your movement."
      };

    case GameElement.ENEMY:
      return {
        walkable: true,
        dangerous: true,
        collectible: false,
        interactive: true,
        description: "An enemy that will attack you on sight."
      };

    case GameElement.GRASS:
      return {
        walkable: true,
        dangerous: false,
        collectible: false,
        interactive: false,
        description: "Soft grass that cushions your steps."
      };

    case GameElement.FIRE:
      return {
        walkable: true,
        dangerous: true,
        collectible: false,
        interactive: false,
        description: "Burning fire that damages you when stepped on."
      };

    case GameElement.PLAYER_START:
      return {
        walkable: true,
        dangerous: false,
        collectible: false,
        interactive: false,
        description: "Your starting position in the dungeon."
      };

    case GameElement.PLAYER_FINISH:
      return {
        walkable: true,
        dangerous: false,
        collectible: false,
        interactive: true,
        description: "The exit from the dungeon."
      };

    case GameElement.TREASURE:
      return {
        walkable: true,
        dangerous: false,
        collectible: true,
        interactive: false,
        description: "Valuable treasure waiting to be collected."
      };

    case GameElement.KEY:
      return {
        walkable: true,
        dangerous: false,
        collectible: true,
        interactive: false,
        description: "A key that can open locked doors."
      };

    case GameElement.DOOR:
      return {
        walkable: false,
        dangerous: false,
        collectible: false,
        interactive: true,
        description: "A locked door that requires a key to open."
      };

    case GameElement.STAIRS:
      return {
        walkable: true,
        dangerous: false,
        collectible: false,
        interactive: true,
        description: "Stairs leading to another level."
      };

    case GameElement.FLOOR:
    default:
      return {
        walkable: true,
        dangerous: false,
        collectible: false,
        interactive: false,
        description: "Regular dungeon floor."
      };
  }
}
