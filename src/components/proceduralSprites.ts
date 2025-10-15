// Simple procedural icon generator for element sprites
// Produces 32x32 PNG data URLs with minimalist symbols and colors

export type ProceduralSpriteKind =
  | 'enemy'
  | 'danger'
  | 'finish'
  | 'treasure'
  | 'key'
  | 'door'
  | 'stairs'
  | 'blade'
  | 'fire'
  | 'water'
  | 'grass';

export function generateProceduralSprite(kind: ProceduralSpriteKind, size: number = 32): string {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Background transparent
  ctx.clearRect(0, 0, size, size);

  // Helper drawing utilities
  const center = { x: size / 2, y: size / 2 };

  const drawCircle = (x: number, y: number, r: number, fill: string) => {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
  };

  const drawRoundedRect = (x: number, y: number, w: number, h: number, r: number, fill: string) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  };

  const drawTriangle = (points: Array<{ x: number; y: number }>, fill: string) => {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  };

  const strokeSimple = (color: string, width: number = 2) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };

  // Symbol palettes
  const colors = {
    enemy: '#e74c3c',
    danger: '#ff5c33',
    finish: '#2ecc71',
    treasure: '#f1c40f',
    key: '#f1c40f',
    door: '#8e5a3c',
    stairs: '#bdc3c7',
    blade: '#95a5a6',
    fire: '#ff7a1a',
    water: '#4aa3ff',
    grass: '#2ecc71'
  } as const;

  // Draw per kind
  switch (kind) {
    case 'enemy': {
      // Simple skull icon
      drawCircle(center.x, center.y, size * 0.24, colors.enemy);
      strokeSimple('#ffffff');
      ctx.beginPath();
      ctx.moveTo(center.x - 4, center.y + 6);
      ctx.lineTo(center.x + 4, center.y + 6);
      ctx.stroke();
      drawCircle(center.x - 5, center.y - 2, 2, '#ffffff');
      drawCircle(center.x + 5, center.y - 2, 2, '#ffffff');
      break;
    }
    case 'danger': {
      // Warning triangle
      drawTriangle([
        { x: center.x, y: center.y - 10 },
        { x: center.x - 11, y: center.y + 9 },
        { x: center.x + 11, y: center.y + 9 }
      ], colors.danger);
      drawCircle(center.x, center.y + 6, 2, '#ffffff');
      drawRoundedRect(center.x - 1, center.y - 3, 2, 7, 1, '#ffffff');
      break;
    }
    case 'finish': {
      // Checkmark
      drawRoundedRect(4, 4, size - 8, size - 8, 6, colors.finish);
      strokeSimple('#ffffff', 3);
      ctx.beginPath();
      ctx.moveTo(9, center.y + 2);
      ctx.lineTo(center.x - 1, center.y + 8);
      ctx.lineTo(size - 9, 9);
      ctx.stroke();
      break;
    }
    case 'treasure': {
      // Coin
      drawCircle(center.x, center.y, 10, colors.treasure);
      strokeSimple('#ffffff', 2);
      ctx.beginPath();
      ctx.arc(center.x, center.y, 6, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case 'key': {
      // Key glyph
      drawCircle(center.x - 5, center.y - 2, 5, colors.key);
      drawRoundedRect(center.x - 1, center.y - 2, 12, 3, 1.5, colors.key);
      drawRoundedRect(center.x + 6, center.y - 4, 2, 2, 1, '#ffffff');
      drawRoundedRect(center.x + 8, center.y - 4, 2, 2, 1, '#ffffff');
      break;
    }
    case 'door': {
      // Door rectangle with knob
      drawRoundedRect(7, 5, size - 14, size - 8, 4, colors.door);
      drawCircle(size - 12, center.y, 2, '#f7e3a1');
      break;
    }
    case 'stairs': {
      // Stair steps
      drawRoundedRect(5, 20, 22, 4, 1, colors.stairs);
      drawRoundedRect(8, 15, 18, 4, 1, colors.stairs);
      drawRoundedRect(11, 10, 14, 4, 1, colors.stairs);
      break;
    }
    case 'blade': {
      // Simple sword
      drawRoundedRect(center.x - 1, 6, 2, 16, 1, colors.blade);
      drawRoundedRect(center.x - 5, 18, 10, 2, 1, '#c99a3b');
      drawTriangle([
        { x: center.x, y: 4 },
        { x: center.x - 3, y: 8 },
        { x: center.x + 3, y: 8 }
      ], colors.blade);
      break;
    }
    case 'fire': {
      // Flame blob
      drawCircle(center.x, center.y + 2, 8, colors.fire);
      drawTriangle([
        { x: center.x, y: center.y - 8 },
        { x: center.x - 6, y: center.y + 2 },
        { x: center.x + 6, y: center.y + 2 }
      ], colors.fire);
      drawCircle(center.x, center.y + 1, 4, '#ffd68a');
      break;
    }
    case 'water': {
      // Droplet
      drawTriangle([
        { x: center.x, y: 6 },
        { x: center.x - 7, y: 16 },
        { x: center.x + 7, y: 16 }
      ], colors.water);
      drawCircle(center.x, 16, 7, colors.water);
      drawCircle(center.x + 2, 12, 2, '#ffffff');
      break;
    }
    case 'grass': {
      // Two-tone dithered tuft
      const dark = '#1f8a4a';
      const light = '#4fd08a';
      drawRoundedRect(6, 24, size - 12, 2, 1, '#1e5c36');
      // base triangle
      drawTriangle([
        { x: center.x, y: 8 },
        { x: center.x - 10, y: 24 },
        { x: center.x + 10, y: 24 }
      ], dark);
      // light dither dots
      ctx.fillStyle = light;
      for (let y = 10; y <= 22; y += 2) {
        for (let x = 0; x < size; x += 2) {
          const px = x + ((y % 4) === 0 ? 1 : 0);
          const py = y;
          if (px > 6 && px < size - 6 && py < 24) {
            // within triangle bounds roughly
            const t = (py - 8) / (24 - 8);
            const half = 10 * (1 - t);
            if (px > center.x - half && px < center.x + half) ctx.fillRect(px, py, 1, 1);
          }
        }
      }
      // vein
      strokeSimple('#eaffea', 1);
      ctx.beginPath();
      ctx.moveTo(center.x, 12);
      ctx.quadraticCurveTo(center.x + 3, 18, center.x, 24);
      ctx.stroke();
      break;
    }
  }

  return canvas.toDataURL('image/png');
}


