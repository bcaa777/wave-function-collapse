# Dungeon Crawler Textures

Place your texture files here for walls, floors, and ceilings.

## Required Texture Files:

### Wall Textures:
- `wall_brick.png` - Brick wall texture
- `wall_stone.png` - Stone wall texture

### Floor/Ceiling Textures:
- `floor_stone.png` - Stone floor texture
- `ceiling_stone.png` - Stone ceiling texture

## Texture Guidelines:
- Size: Any size (will be tiled/repeated)
- Format: PNG or JPG
- Style: Seamless tileable textures
- Resolution: 64x64 or 128x128 pixels recommended
- Color: Should work with the distance fog effect

## How Textures Are Used:
- Wall textures are applied based on the wall type in the color mapping
- Floor and ceiling textures create the ground and sky effect
- Textures are tinted based on distance for fog effect

## Current Color Mapping:
- **Black (#000000)** → Walls (wall_brick.png or wall_stone.png)
- **Red (#FF0000)** → Danger zones (special red tint)
- **Blue (#0000FF)** → Water (blue tint)
- **Purple (#800080)** → Enemy areas
- **Green (#008000)** → Grass areas
- **Orange (#FFA500)** → Fire areas
- **Brown (#8B4513)** → Doors
- **Silver (#C0C0C0)** → Stairs

You can create specific textures for each color type by updating the `getWallTextureColor` method in `spriteManager.ts`.
