// Node.js script to generate app icons using canvas
// Run: node generate-icons.js
const { createCanvas } = require('canvas');
const fs = require('fs');

function generateIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#0a0a1a';
  ctx.fillRect(0, 0, size, size);

  const cx = size / 2, cy = size / 2, r = size * 0.38;

  // Outer glow ring
  const glowGrad = ctx.createRadialGradient(cx, cy, r * 0.8, cx, cy, r * 1.3);
  glowGrad.addColorStop(0, 'rgba(0,212,255,0.3)');
  glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glowGrad;
  ctx.fillRect(0, 0, size, size);

  // Main circle
  const grad = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.2, r * 0.1, cx, cy, r);
  grad.addColorStop(0, '#80e8ff');
  grad.addColorStop(0.5, '#00d4ff');
  grad.addColorStop(1, '#0060ff');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // Lightning bolt / strike symbol
  ctx.fillStyle = '#fff';
  ctx.shadowColor = '#ffffff';
  ctx.shadowBlur = size * 0.03;
  const s = size * 0.18;
  ctx.beginPath();
  ctx.moveTo(cx + s * 0.3, cy - s);
  ctx.lineTo(cx - s * 0.5, cy + s * 0.1);
  ctx.lineTo(cx + s * 0.1, cy + s * 0.1);
  ctx.lineTo(cx - s * 0.3, cy + s);
  ctx.lineTo(cx + s * 0.5, cy - s * 0.1);
  ctx.lineTo(cx - s * 0.1, cy - s * 0.1);
  ctx.closePath();
  ctx.fill();

  return canvas.toBuffer('image/png');
}

try {
  fs.mkdirSync('icons', { recursive: true });
  fs.writeFileSync('icons/icon-192.png', generateIcon(192));
  fs.writeFileSync('icons/icon-512.png', generateIcon(512));
  console.log('Icons generated successfully!');
} catch (e) {
  console.error('Icon generation failed (canvas npm package required):', e.message);
}
