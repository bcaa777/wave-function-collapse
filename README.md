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
- **Interactive Color Reference Guide** - Click any color swatch to select it for drawing
- **Real-time color mapping preview** with property indicators (walkable, dangerous, collectible, etc.)

### 🗡️ 3D Dungeon Crawler Game (Three.js)
- Transform generated images into playable 3D dungeon crawler games
- **Full 3D rendering with Three.js** - Real 3D geometry, lighting, and perspective
- **Custom 2D sprites** for all dynamic objects (enemies, treasures, keys, etc.)
- **480x320 base resolution** with 2x upscaling for crisp pixel art
- **Proper 3D walls and floors** with accurate collision detection
- Navigate through procedurally generated 3D dungeons
- Collect treasures and keys while avoiding enemies and dangers
- Multiple game elements based on colors:
  - **Black**: Walls (impassable 3D cubes)
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

### 🎨 Custom Sprites & Textures
- **32x32 pixel sprites** for all interactive elements (enemies, treasures, keys, etc.)
- **Wall textures** for different wall types
- **Floor and ceiling textures** for immersive environments
- **Transparent PNG format** for pixel-perfect retro styling

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

## Color Mapping Reference

During image editing, you'll see a **Color Reference Guide** on the right side with all available colors:

### Game Element Colors:
- **#000000** - Wall (impassable, blocked)
- **#FF0000** - Danger (walkable, dangerous)
- **#0000FF** - Water (walkable, slows movement)
- **#800080** - Enemy (walkable, dangerous, interactive)
- **#008000** - Grass (walkable, safe terrain)
- **#FFA500** - Fire (walkable, dangerous)
- **#006400** - Player Start (walkable)
- **#8B0000** - Player Finish/Exit (walkable, interactive)
- **#FFFF00** - Treasure (walkable, collectible)
- **#FFD700** - Key (walkable, collectible)
- **#8B4513** - Door (blocked, interactive, needs key)
- **#C0C0C0** - Stairs (walkable, interactive)
- **#FFFFFF** - Floor (walkable, default)

### Color Properties:
- 🟢 **Walkable** - Player can move through
- 🔴 **Blocked** - Wall/obstacle
- 🔥 **Dangerous** - Damages player
- 💰 **Collectible** - Can be picked up
- 🎯 **Interactive** - Player can interact with

**💡 Tip:** Click any color swatch in the reference guide to instantly select that color for drawing!

## Controls
- **WASD**: Move around
- **A/D or Left/Right Arrow Keys**: Turn left/right
- **Space**: Attack (when implemented)
- **E**: Interact with objects

## Asset Creation Guide

### 📁 File Structure:
```
public/
├── sprites/          # 32x32 pixel sprites ✅ (PLACEHOLDER ASSETS CREATED)
│   ├── enemy.png     # 🔴 Red enemy character
│   ├── danger.png    # 🟠 Orange danger zones
│   ├── finish.png    # 🟢 Green exit/goal
│   ├── treasure.png  # 🟡 Yellow collectibles
│   ├── key.png       # 🟨 Gold keys
│   ├── door.png      # 🟤 Brown locked doors
│   ├── stairs.png    # ⚪ Silver stairs
│   └── blade.png     # ⚫ Gray player weapon
└── textures/         # Wall/floor textures ✅ (PLACEHOLDER ASSETS CREATED)
    ├── wall_brick.png    # 🧱 Brick wall pattern
    ├── wall_stone.png    # 🪨 Stone wall blocks
    ├── floor_stone.png   # 🏠 Stone floor tiles
    ├── ceiling_stone.png # 🏠 Stone ceiling
    ├── water_texture.png # 💧 Blue water ripples
    ├── grass_texture.png # 🌱 Green grass terrain
    ├── danger_texture.png # 🔥 Red lava pattern
    ├── fire_texture.png  # 🟠 Orange flame pattern
    ├── wood_texture.png  # 🪵 Brown wood grain
    └── metal_texture.png # ⚪ Silver metallic sheen
```

### 🎨 Sprite Requirements:
- **Size**: 32x32 pixels
- **Format**: PNG with transparency
- **Style**: Pixelated/retro
- **Background**: Transparent
- **Rendering**: Automatic occlusion culling and depth sorting

### 🏗️ Texture Requirements:
- **Size**: 64x64 or 128x128 pixels (tileable)
- **Format**: PNG or JPG
- **Style**: Seamless/tileable

### 🔧 Three.js Rendering Engine:

**3D Geometry System:**
- **Cube-based Walls**: Real 3D cubes for all wall types with proper lighting
- **Textured Floors**: Multi-tile floor system with checkerboard patterns
- **Dynamic Lighting**: Ambient and directional lighting for depth
- **Material System**: Different materials for walls, floors, and interactive elements
- **Collision Detection**: Accurate 3D collision with wall geometry

**2D Sprite Integration:**
- **Canvas-based Sprites**: 32x32 pixel sprites rendered as 3D billboards
- **Dynamic Sprite Creation**: Procedural sprite generation from game elements
- **Proper Depth Sorting**: Sprites sorted by distance for correct rendering order
- **Transparency Support**: Alpha blending for sprite edges

**Performance Optimizations:**
- **Resolution Scaling**: 480x320 base with 2x upscaling for crisp visuals
- **Efficient Rendering**: WebGL acceleration with Three.js optimization
- **LOD System**: Distance-based detail reduction for performance
- **Memory Management**: Proper cleanup of 3D objects and textures

## 🚀 Ready to Play!

**Placeholder assets have been created automatically!** You can start using the dungeon crawler immediately with the generated placeholder sprites and textures:

- **Sprites**: Colored 32x32 squares for all interactive elements
- **Textures**: 10 different procedural patterns (brick, stone, water, grass, danger, fire, wood, metal)
- **Dynamic Floors**: Context-aware floor coloring based on nearby elements
- **Full functionality**: All systems work with the placeholder assets

### 🎮 Test It Now:
1. **Start the server:**
   ```bash
   npm run dev
   ```
   This builds and starts the server automatically.

2. **Open in browser:** `http://localhost:8000`

3. **Test the game:**
   - Create a pattern → Generate → Edit → Add start/finish points → Play!
   - You'll see **3D walls** with proper lighting and textures
   - Colored sprites for enemies, treasures, keys, etc.
   - **Real 3D perspective** - walk through actual 3D corridors
   - Sprites properly disappear behind walls
   - Dynamic floor colors that change based on nearby elements

### 🔧 Troubleshooting:

**If Three.js fails to load:**
- Check your internet connection
- Try refreshing the page
- Clear browser cache if needed
- The app will show an error message if Three.js can't load

**If you see "Address already in use":**
```bash
# Kill existing server
pkill -f "python3 -m http.server"
# Then restart
npm run dev
```

Replace the placeholder files with your custom art whenever you're ready! 🎨✨

## Install & Build
```bash
# Install dependencies (includes Three.js for 3D rendering)
npm install

# Build the project
npm run build

# Or compile directly with TypeScript
npx tsc
```

Then open `public/index.html` in your browser to play!

## Dependencies
- **Three.js r152 (CDN)**: 3D rendering engine for WebGL-accelerated graphics
- **SystemJS**: Module loader for dynamic imports
- **TypeScript**: Type-safe JavaScript compilation
- **Custom Sprite System**: Procedural 2D sprite generation for game objects

## Architecture
- **Wave Function Collapse**: Core WFC algorithm implementation
- **Color Mapping**: Converts image colors to game elements
- **3D Rendering**: Pseudo-3D raycasting for dungeon visualization
- **Game Engine**: Player movement, enemy AI, collision detection
- **UI System**: Tab-based interface for different modes
