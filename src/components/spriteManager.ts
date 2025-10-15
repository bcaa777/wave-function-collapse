// Sprite and texture management system
import { generateProceduralSprite } from './proceduralSprites';
export interface Sprite {
  image: HTMLImageElement;
  width: number;
  height: number;
  loaded: boolean;
}

export interface Texture {
  image: HTMLImageElement;
  loaded: boolean;
}

export class SpriteManager {
  private sprites: Map<string, Sprite> = new Map();
  private textures: Map<string, Texture> = new Map();
  private basePath: string;

  constructor(basePath: string = 'sprites/') {
    this.basePath = basePath;
  }

  // Load a sprite
  async loadSprite(name: string, filename: string): Promise<Sprite> {
    const sprite: Sprite = {
      image: new Image(),
      width: 32,
      height: 32,
      loaded: false
    };

    return new Promise((resolve, reject) => {
      sprite.image.onload = () => {
        sprite.loaded = true;
        sprite.width = sprite.image.width;
        sprite.height = sprite.image.height;
        this.sprites.set(name, sprite);
        resolve(sprite);
      };

      sprite.image.onerror = () => {
        reject(new Error(`Failed to load sprite: ${filename}`));
      };

      // Support data URLs directly, otherwise load from basePath
      sprite.image.src = filename.startsWith('data:') ? filename : `${this.basePath}${filename}`;
    });
  }

  // Load a texture
  async loadTexture(name: string, filename: string): Promise<Texture> {
    const texture: Texture = {
      image: new Image(),
      loaded: false
    };

    return new Promise((resolve, reject) => {
      texture.image.onload = () => {
        texture.loaded = true;
        this.textures.set(name, texture);
        resolve(texture);
      };

      texture.image.onerror = () => {
        reject(new Error(`Failed to load texture: ${filename}`));
      };

      texture.image.src = `textures/${filename}`;
    });
  }

  // Get a loaded sprite
  getSprite(name: string): Sprite | undefined {
    return this.sprites.get(name);
  }

  // Get a loaded texture
  getTexture(name: string): Texture | undefined {
    return this.textures.get(name);
  }

  // Draw a sprite in 3D space
  drawSprite(
    ctx: CanvasRenderingContext2D,
    sprite: Sprite,
    worldX: number,
    worldY: number,
    playerX: number,
    playerY: number,
    playerAngle: number,
    canvasWidth: number,
    canvasHeight: number,
    fov: number
  ): void {
    if (!sprite.loaded) return;

    // Calculate sprite position relative to player
    const dx = worldX - playerX;
    const dy = worldY - playerY;

    // Calculate distance and angle to sprite
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < 0.1) return; // Too close to player

    const angle = Math.atan2(dy, dx);
    let relativeAngle = angle - playerAngle;

    // Normalize angle to [-PI, PI]
    while (relativeAngle < -Math.PI) relativeAngle += 2 * Math.PI;
    while (relativeAngle > Math.PI) relativeAngle -= 2 * Math.PI;

    // Check if sprite is in field of view
    if (Math.abs(relativeAngle) > fov / 2) return;

    // Calculate screen position
    const screenX = canvasWidth / 2 + (relativeAngle / (fov / 2)) * (canvasWidth / 2);
    const spriteHeight = Math.max(1, (sprite.height / distance) * 50); // Scale factor, minimum 1px
    const spriteWidth = Math.max(1, (sprite.width / distance) * 50);

    const screenY = canvasHeight / 2;

    // Check if sprite is within screen bounds (with some margin)
    const margin = 50;
    if (screenX + spriteWidth / 2 < -margin ||
        screenX - spriteWidth / 2 > canvasWidth + margin ||
        screenY + spriteHeight / 2 < -margin ||
        screenY - spriteHeight / 2 > canvasHeight + margin) {
      return; // Sprite is off-screen
    }

    // Ensure dimensions are valid
    if (spriteWidth <= 0 || spriteHeight <= 0 || !isFinite(spriteWidth) || !isFinite(spriteHeight)) {
      return;
    }

    // Draw sprite with error handling
    try {
      ctx.save();
      ctx.globalAlpha = Math.min(1, Math.max(0.1, 2 - distance / 10)); // Distance-based transparency
      ctx.drawImage(
        sprite.image,
        screenX - spriteWidth / 2,
        screenY - spriteHeight / 2,
        spriteWidth,
        spriteHeight
      );
      ctx.restore();
    } catch (error) {
      console.warn('Error drawing sprite:', error);
    }
  }

  // Get wall texture color based on element type and distance
  getWallTextureColor(elementType: string, distance: number): string {
    // Distance fog
    const fogFactor = Math.max(0, 1 - distance / 15);
    const brightness = Math.floor(255 * fogFactor);

    // Different base colors for different wall types with texture-inspired colors
    let baseColor: [number, number, number];
    switch (elementType.toLowerCase()) {
      case 'wall':
        // Stone wall color (grayish)
        baseColor = [Math.floor(brightness * 0.6), Math.floor(brightness * 0.6), Math.floor(brightness * 0.65)];
        break;
      case 'door':
        // Brown door color (wood-like)
        baseColor = [Math.floor(brightness * 0.45), Math.floor(brightness * 0.25), Math.floor(brightness * 0.15)];
        break;
      case 'danger':
        // Red danger color (lava-like)
        baseColor = [Math.floor(brightness * 0.9), Math.floor(brightness * 0.2), Math.floor(brightness * 0.1)];
        break;
      case 'fire':
        // Orange fire color (flame-like)
        baseColor = [Math.floor(brightness * 0.95), Math.floor(brightness * 0.4), Math.floor(brightness * 0.1)];
        break;
      case 'water':
        // Blue water color (ocean-like)
        baseColor = [Math.floor(brightness * 0.2), Math.floor(brightness * 0.3), Math.floor(brightness * 0.8)];
        break;
      case 'grass':
        // Green grass color (nature-like)
        baseColor = [Math.floor(brightness * 0.15), Math.floor(brightness * 0.5), Math.floor(brightness * 0.2)];
        break;
      case 'treasure':
        // Gold treasure color (metallic)
        baseColor = [Math.floor(brightness * 0.8), Math.floor(brightness * 0.7), Math.floor(brightness * 0.3)];
        break;
      case 'key':
        // Gold key color (brighter gold)
        baseColor = [Math.floor(brightness * 0.9), Math.floor(brightness * 0.8), Math.floor(brightness * 0.4)];
        break;
      case 'stairs':
        // Silver stairs color (metallic gray)
        baseColor = [Math.floor(brightness * 0.7), Math.floor(brightness * 0.7), Math.floor(brightness * 0.75)];
        break;
      case 'player_start':
        // Green start color
        baseColor = [Math.floor(brightness * 0.2), Math.floor(brightness * 0.8), Math.floor(brightness * 0.3)];
        break;
      case 'player_finish':
        // Blue finish color
        baseColor = [Math.floor(brightness * 0.2), Math.floor(brightness * 0.3), Math.floor(brightness * 0.9)];
        break;
      default:
        baseColor = [Math.floor(brightness * 0.5), Math.floor(brightness * 0.5), Math.floor(brightness * 0.5)];
    }

    return `rgb(${baseColor[0]}, ${baseColor[1]}, ${baseColor[2]})`;
  }

  // Get floor texture color based on element type and distance
  getFloorTextureColor(elementType: string, distance: number): string {
    // Distance fog
    const fogFactor = Math.max(0, 1 - distance / 20);
    const brightness = Math.floor(255 * fogFactor);

    switch (elementType.toLowerCase()) {
      case 'water':
        // Water floor color (darker blue)
        return `rgb(${Math.floor(brightness * 0.1)}, ${Math.floor(brightness * 0.15)}, ${Math.floor(brightness * 0.6)})`;
      case 'grass':
        // Grass floor color (darker green)
        return `rgb(${Math.floor(brightness * 0.1)}, ${Math.floor(brightness * 0.4)}, ${Math.floor(brightness * 0.15)})`;
      case 'danger':
        // Danger floor color (dark red)
        return `rgb(${Math.floor(brightness * 0.6)}, ${Math.floor(brightness * 0.1)}, ${Math.floor(brightness * 0.1)})`;
      case 'fire':
        // Fire floor color (dark orange)
        return `rgb(${Math.floor(brightness * 0.7)}, ${Math.floor(brightness * 0.2)}, ${Math.floor(brightness * 0.05)})`;
      default:
        // Stone floor color (dark gray)
        return `rgb(${Math.floor(brightness * 0.3)}, ${Math.floor(brightness * 0.3)}, ${Math.floor(brightness * 0.35)})`;
    }
  }

  // Initialize default sprites and textures
  async initializeDefaults(): Promise<void> {
    const loadPromises: Promise<any>[] = [];

    // Load sprites using procedural generator (replaces file-based placeholders)
    const spriteKinds = ['enemy','danger','finish','treasure','key','door','stairs','blade'] as const;
    for (const name of spriteKinds) {
      const dataUrl = generateProceduralSprite(name);
      loadPromises.push(this.loadSprite(name, dataUrl));
    }

    // Load textures for walls and floors
    const textureFiles = [
      { name: 'wall_brick', file: 'wall_brick.png' },
      { name: 'wall_stone', file: 'wall_stone.png' },
      { name: 'floor_stone', file: 'floor_stone.png' },
      { name: 'ceiling_stone', file: 'ceiling_stone.png' },
      { name: 'water_texture', file: 'water_texture.png' },
      { name: 'grass_texture', file: 'grass_texture.png' },
      { name: 'danger_texture', file: 'danger_texture.png' },
      { name: 'fire_texture', file: 'fire_texture.png' },
      { name: 'wood_texture', file: 'wood_texture.png' },
      { name: 'metal_texture', file: 'metal_texture.png' }
    ];

    for (const { name, file } of textureFiles) {
      loadPromises.push(this.loadTexture(name, file));
    }

    try {
      await Promise.all(loadPromises);
      console.log('All sprites and textures loaded successfully');
    } catch (error) {
      console.warn('Some sprites/textures failed to load:', error);
    }
  }
}
