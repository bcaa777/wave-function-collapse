# Wave Function Collapse Dungeon Generator

A Typescript implementation of [ExUtumno's](https://github.com/mxgmn) [WaveFunctionCollapse](https://github.com/mxgmn/WaveFunctionCollapse) with added **3D Dungeon Crawler Game** functionality!

Visit the app at https://jaxry.github.io/wave-function-collapse/

## Features

### 🎨 Wave Function Collapse Generation
- Generate procedural 2D patterns using the Wave Function Collapse algorithm
- Choose from preset images or draw custom patterns
- Adjustable generation parameters (N, symmetry, periodic options, etc.)
- Download generated images as PNG

### ✏️ Image Editor
- Edit generated images using the same drawing tools as the input creation
- Add player start/finish points and polish dungeon layouts
- Multiple drawing tools: pen, eraser, bucket fill, shapes, spray paint
- Adjustable brush size and zoom level

### 🗡️ 3D Dungeon Crawler Game
- Transform generated images into playable 3D dungeon crawler games
- **Pseudo-3D raycasting graphics** similar to classic games like Wolfenstein 3D
- Navigate through procedurally generated dungeons
- Collect treasures and keys while avoiding enemies and dangers
- Multiple game elements based on colors:
  - **Black**: Walls (impassable)
  - **Red**: Danger zones (damage over time)
  - **Blue**: Water (slows movement)
  - **Purple**: Enemies (attack on contact)
  - **Green**: Grass (safe terrain)
  - **Orange**: Fire (dangerous)
  - **Dark Green**: Player start position
  - **Dark Red**: Player finish/goal
  - **Yellow**: Treasure (collectible)
  - **Gold**: Keys (unlock doors)
  - **Brown**: Doors (locked, need keys)
  - **Silver**: Stairs (interactive elements)

### 🎮 Game Mechanics
- **Movement**: WASD keys for movement, mouse for looking around
- **Combat**: Automatic when enemies get close (melee with blade)
- **Health System**: Take damage from enemies and danger zones
- **Inventory**: Collect keys and treasures
- **Win/Lose Conditions**: Reach the finish or die trying!

## How to Use

1. **Create Input**: Choose a preset image or draw a custom pattern
2. **Generate**: Use Wave Function Collapse to create a procedural dungeon
3. **Edit**: Add player start (dark green) and finish (dark red) points, polish the layout
4. **Play**: Transform your creation into a 3D dungeon crawler game!

## Controls
- **WASD**: Move around
- **A/D or Left/Right Arrow Keys**: Turn left/right
- **Space**: Attack (when implemented)
- **E**: Interact with objects

## Install & Build
```bash
# Install dependencies
npm install

# Build the project
npm run build

# Or compile directly with TypeScript
npx tsc
```

Then open `public/index.html` in your browser to play!

## Architecture
- **Wave Function Collapse**: Core WFC algorithm implementation
- **Color Mapping**: Converts image colors to game elements
- **3D Rendering**: Pseudo-3D raycasting for dungeon visualization
- **Game Engine**: Player movement, enemy AI, collision detection
- **UI System**: Tab-based interface for different modes
