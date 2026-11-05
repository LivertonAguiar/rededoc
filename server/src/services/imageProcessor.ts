import sharp from 'sharp';

export interface ProcessImageOptions {
  removeBackground?: boolean;
  maxWidth?: number;
  maxHeight?: number;
  tolerance?: number;
}

/**
 * Distância euclidiana entre duas cores no espaço RGB.
 */
function colorDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
}

/**
 * Remove o fundo de forma inteligente e adaptativa:
 * - Detecta a cor real do fundo (seja claro, branco de estúdio, cinza ou escuro/gradiente);
 * - Preserva integralmente imagens que já possuem canal alfa / transparência natural;
 * - Respeita o contorno do equipamento com barreira estrita de gradiente;
 * - Preserva texturas, cores originais, antenas e detalhes de equipamentos brancos ou pretos.
 */
export async function removeAdaptiveBackground(
  inputBuffer: Buffer,
  tolerance = 38
): Promise<Buffer> {
  const image = sharp(inputBuffer).ensureAlpha();
  const meta = await image.metadata();
  const width = meta.width || 0;
  const height = meta.height || 0;
  if (!width || !height) return inputBuffer;

  const { data } = await image.raw().toBuffer({ resolveWithObject: true });
  const totalPixels = width * height;

  // 1. Verifica se a imagem já possui fundo transparente pré-existente
  let transparentBorderCount = 0;
  const borderTotal = (width * 2) + (height * 2);

  for (let x = 0; x < width; x += 4) {
    if (data[x * 4 + 3] < 50) transparentBorderCount++;
    if (data[((height - 1) * width + x) * 4 + 3] < 50) transparentBorderCount++;
  }
  for (let y = 0; y < height; y += 4) {
    if (data[(y * width) * 4 + 3] < 50) transparentBorderCount++;
    if (data[(y * width + (width - 1)) * 4 + 3] < 50) transparentBorderCount++;
  }

  // Se a borda já tem mais de 25% de transparência, a imagem já é um PNG transparente limpo
  if (transparentBorderCount / (borderTotal / 4) > 0.25) {
    return await sharp(inputBuffer).trim({ threshold: 4 }).png().toBuffer();
  }

  // 2. Amostragem inteligente das 4 bordas para capturar o perfil de cores do fundo
  const borderSamples: [number, number, number][] = [];
  const sampleStep = Math.max(4, Math.floor(Math.min(width, height) / 40));

  for (let x = 0; x < width; x += sampleStep) {
    const topIdx = x * 4;
    const botIdx = ((height - 1) * width + x) * 4;
    borderSamples.push([data[topIdx], data[topIdx + 1], data[topIdx + 2]]);
    borderSamples.push([data[botIdx], data[botIdx + 1], data[botIdx + 2]]);
  }
  for (let y = 0; y < height; y += sampleStep) {
    const leftIdx = (y * width) * 4;
    const rightIdx = (y * width + (width - 1)) * 4;
    borderSamples.push([data[leftIdx], data[leftIdx + 1], data[leftIdx + 2]]);
    borderSamples.push([data[rightIdx], data[rightIdx + 1], data[rightIdx + 2]]);
  }

  const visited = new Uint8Array(totalPixels);
  const queue: number[] = [];

  // Enfileira todos os pixels externos da borda que combinam com o fundo da margem
  for (let x = 0; x < width; x++) {
    const top = x;
    const bot = (height - 1) * width + x;
    visited[top] = 1; queue.push(top);
    visited[bot] = 1; queue.push(bot);
  }
  for (let y = 0; y < height; y++) {
    const left = y * width;
    const right = y * width + (width - 1);
    if (!visited[left]) { visited[left] = 1; queue.push(left); }
    if (!visited[right]) { visited[right] = 1; queue.push(right); }
  }

  // 3. Flood Fill guiado por gradiente e similaridade de borda
  const gradientLimit = 18; // Barreira estrita de borda do equipamento
  const maxColorDist = Math.max(25, Math.min(tolerance, 50));

  let head = 0;
  while (head < queue.length) {
    const curr = queue[head++];
    const cx = curr % width;
    const cy = Math.floor(curr / width);
    const cIdx = curr * 4;
    const cr = data[cIdx], cg = data[cIdx + 1], cb = data[cIdx + 2];

    const neighbors = [
      cy > 0 ? curr - width : -1,
      cy < height - 1 ? curr + width : -1,
      cx > 0 ? curr - 1 : -1,
      cx < width - 1 ? curr + 1 : -1
    ];

    for (const n of neighbors) {
      if (n !== -1 && visited[n] === 0) {
        const nIdx = n * 4;
        const nr = data[nIdx], ng = data[nIdx + 1], nb = data[nIdx + 2];
        const localGrad = Math.abs(nr - cr) + Math.abs(ng - cg) + Math.abs(nb - cb);

        // Não atravessa borda com gradiente acentuado
        if (localGrad <= gradientLimit) {
          // Verifica proximidade com as amostras de cor do fundo da borda
          let minDist = 999;
          for (let s = 0; s < borderSamples.length; s += 6) {
            const d = colorDistance(nr, ng, nb, borderSamples[s][0], borderSamples[s][1], borderSamples[s][2]);
            if (d < minDist) {
              minDist = d;
              if (minDist <= 12) break; // Proximidade quase exata com o fundo
            }
          }

          if (minDist <= maxColorDist) {
            visited[n] = 1;
            queue.push(n);
          }
        }
      }
    }
  }

  // 4. Aplica transparência total nos pixels do fundo identificado
  let erasedPixels = 0;
  for (let i = 0; i < totalPixels; i++) {
    if (visited[i] === 1) {
      data[i * 4 + 3] = 0;
      erasedPixels++;
    }
  }

  // Se mais de 92% da imagem foi apagada, houve vazamento no objeto; preserva original
  if (erasedPixels / totalPixels > 0.92) {
    console.warn('[imageProcessor] Proteção ativada: evitou apagar o equipamento. Preservando original.');
    return await sharp(inputBuffer).trim({ threshold: 4 }).png().toBuffer();
  }

  // 5. Suavização sutil nas bordas do recorte (antialiasing)
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      if (visited[idx] === 0) {
        const hasTransparentNeighbor =
          visited[idx - 1] === 1 ||
          visited[idx + 1] === 1 ||
          visited[idx - width] === 1 ||
          visited[idx + width] === 1;

        if (hasTransparentNeighbor) {
          data[idx * 4 + 3] = 210;
        }
      }
    }
  }

  return await sharp(data, {
    raw: { width, height, channels: 4 }
  })
    .trim({ threshold: 4 })
    .png({ quality: 95, compressionLevel: 7 })
    .toBuffer();
}

/**
 * Remove o fundo branco (compatibilidade retroativa com fallback inteligente).
 */
export async function removeWhiteBackground(
  inputBuffer: Buffer,
  tolerance = 28
): Promise<Buffer> {
  return await removeAdaptiveBackground(inputBuffer, tolerance);
}

/**
 * Processa e otimiza a imagem mantendo a proporção estrita e proporção original.
 */
export async function processAndOptimizeImage(
  inputBuffer: Buffer,
  options: ProcessImageOptions = {}
): Promise<Buffer> {
  const {
    removeBackground = false,
    maxWidth = 900,
    maxHeight = 900,
    tolerance = 38
  } = options;

  let buffer = inputBuffer;

  if (removeBackground) {
    try {
      buffer = await removeAdaptiveBackground(buffer, tolerance);
    } catch (err) {
      console.warn('Aviso: Falha ao remover fundo, mantendo imagem original:', err);
    }
  }

  return await sharp(buffer)
    .resize({
      width: maxWidth,
      height: maxHeight,
      fit: 'inside',
      withoutEnlargement: true
    })
    .png({ quality: 92, compressionLevel: 7 })
    .toBuffer();
}
