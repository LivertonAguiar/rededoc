const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function run() {
  const root = path.resolve(__dirname, '..');
  const svgPath = path.join(root, 'client', 'public', 'logo.svg');
  const svgBuffer = fs.readFileSync(svgPath);

  console.log('Gerando ícones PWA...');
  await sharp(svgBuffer).resize(192, 192).png().toFile(path.join(root, 'client', 'public', 'pwa-192x192.png'));
  await sharp(svgBuffer).resize(512, 512).png().toFile(path.join(root, 'client', 'public', 'pwa-512x512.png'));
  await sharp(svgBuffer).resize(512, 512).png().toFile(path.join(root, 'client', 'public', 'maskable-icon-512x512.png'));
  await sharp(svgBuffer).resize(180, 180).png().toFile(path.join(root, 'client', 'public', 'apple-touch-icon.png'));

  console.log('Gerando ícones nativos Android Mipmap...');
  const resDir = path.join(root, 'client', 'android', 'app', 'src', 'main', 'res');

  const densities = [
    { dir: 'mipmap-mdpi', size: 48, fgSize: 108 },
    { dir: 'mipmap-hdpi', size: 72, fgSize: 162 },
    { dir: 'mipmap-xhdpi', size: 96, fgSize: 216 },
    { dir: 'mipmap-xxhdpi', size: 144, fgSize: 324 },
    { dir: 'mipmap-xxxhdpi', size: 192, fgSize: 432 }
  ];

  for (const d of densities) {
    const targetDir = path.join(resDir, d.dir);
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    // ic_launcher.png
    await sharp(svgBuffer).resize(d.size, d.size).png().toFile(path.join(targetDir, 'ic_launcher.png'));
    // ic_launcher_round.png
    await sharp(svgBuffer).resize(d.size, d.size).png().toFile(path.join(targetDir, 'ic_launcher_round.png'));
    // ic_launcher_foreground.png (com padding seguro para adaptive icon)
    const padding = Math.round(d.fgSize * 0.15);
    const innerSize = d.fgSize - (padding * 2);
    const innerBuffer = await sharp(svgBuffer).resize(innerSize, innerSize).png().toBuffer();

    await sharp({
      create: {
        width: d.fgSize,
        height: d.fgSize,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    })
      .composite([{ input: innerBuffer, top: padding, left: padding }])
      .png()
      .toFile(path.join(targetDir, 'ic_launcher_foreground.png'));

    console.log(`Densidade ${d.dir} gerada com sucesso (${d.size}x${d.size} e foreground ${d.fgSize}x${d.fgSize}).`);
  }

  console.log('Todos os ícones foram gerados com sucesso!');
}

run().catch(err => {
  console.error('Erro na geração de ícones:', err);
  process.exit(1);
});

