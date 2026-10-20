// Genera los íconos del panel instalable (public/icons/panel-*.png) desde el cubo del logo.
// Uso: node scripts/panel-icons.mjs  (los PNG quedan versionados; correrlo solo si cambia el diseño)
import sharp from "sharp";

const COLORS = ["#c0392b", "#f3e6c8", "#3f8a63", "#d9b23a", "#c0392b", "#2f5d8a", "#d9822b", "#3f8a63", "#f3e6c8"];

// Cubo centrado dentro de la zona segura de los íconos "maskable" (80 % central).
function svg(size) {
  const cube = size * 0.5;
  const gap = cube * 0.035;
  const pad = cube * 0.05;
  const cell = (cube - pad * 2 - gap * 2) / 3;
  const x0 = (size - cube) / 2;
  const stickers = COLORS.map((c, i) => {
    const x = x0 + pad + (i % 3) * (cell + gap);
    const y = x0 + pad + Math.floor(i / 3) * (cell + gap);
    return `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="${cell * 0.12}" fill="${c}"/>`;
  }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <rect width="${size}" height="${size}" fill="#f6efe3"/>
    <rect x="${x0}" y="${x0}" width="${cube}" height="${cube}" rx="${cube * 0.1}" fill="#2b2118"/>
    ${stickers}
  </svg>`;
}

for (const size of [192, 512]) {
  await sharp(Buffer.from(svg(size))).png().toFile(`public/icons/panel-${size}.png`);
  console.log(`public/icons/panel-${size}.png`);
}
