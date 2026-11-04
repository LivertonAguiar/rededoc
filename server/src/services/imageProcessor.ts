import sharp from 'sharp';

export interface ProcessImageOptions {
  removeBackground?: boolean;
  maxWidth?: number;
  maxHeight?: number;
  tolerance?: number;
}

/**
 * Remove o fundo branco de forma segura e inteligente, protegendo equipamentos brancos (como roteadores,
 * ONTs e faciais) através de amostragem dos cantos, barreira de gradiente de borda e trava de segurança do núcleo.
 */
export async function removeWhiteBackground(
  inputBuffer: Buffer,
  tolerance = 14
): Promise<Buffer> {
  const image = sharp(inputBuffer).ensureAlpha();
  const meta = await image.metadata();
  const width = meta.width || 0;
  const height = meta.height || 0;
  if (!width || !height) return inputBuffer;

  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });
  const totalPixels = width * height;

  // 1. Amostragem dos 4 cantos para verificar se o fundo é realmente branco / muito claro
  const corners = [
    0,                                      // Top-Left
    (width - 1),                            // Top-Right
    (height - 1) * width,                   // Bottom-Left
    (height - 1) * width + (width - 1)      // Bottom-Right
  ];

  let sumR = 0, sumG = 0, sumB = 0;
  let validCornerCount = 0;

  for (const c of corners) {
    const r = data[c * 4];
    const g = data[c * 4 + 1];
    const b = data[c * 4 + 2];
    const a = data[c * 4 + 3];

    if (a < 50) {
      validCornerCount++;
      continue;
    }

    // O canto deve ser claro (branco ou quase branco >= 238)
    if (r >= 238 && g >= 238 && b >= 238) {
      sumR += r;
      sumG += g;
      sumB += b;
      validCornerCount++;
    }
  }

  // Se menos de 3 cantos forem claros, a imagem não tem fundo branco uniforme (ex: foto de ambiente ou fundo escuro)
  // Preserva a imagem original para não destruir o objeto
  if (validCornerCount < 3) {
    console.log('[imageProcessor] Imagem não possui fundo branco uniforme nos cantos. Preservando original.');
    return await sharp(inputBuffer).trim({ threshold: 4 }).png().toBuffer();
  }

  const bgR = validCornerCount > 0 ? Math.round(sumR / validCornerCount) : 255;
  const bgG = validCornerCount > 0 ? Math.round(sumG / validCornerCount) : 255;
  const bgB = validCornerCount > 0 ? Math.round(sumB / validCornerCount) : 255;

  const maxTolerance = Math.min(tolerance, 16); // Tolerância estrita para não confundir plástico de roteador com fundo
  const gradientBarrier = 8; // Degrau de cor para parar o preenchimento na silhueta do equipamento

  const isBgColor = (idx: number) => {
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const a = data[idx + 3];

    if (a < 50) return true; // Já transparente

    const dR = Math.abs(r - bgR);
    const dG = Math.abs(g - bgG);
    const dB = Math.abs(b - bgB);

    return (
      dR <= maxTolerance &&
      dG <= maxTolerance &&
      dB <= maxTolerance &&
      Math.abs(r - g) < 15 &&
      Math.abs(r - b) < 15
    );
  };

  const visited = new Uint8Array(totalPixels);
  const queue: number[] = [];

  // Enfileira as 4 bordas externas
  for (let x = 0; x < width; x++) {
    const topIdx = x;
    const botIdx = (height - 1) * width + x;
    if (isBgColor(topIdx * 4)) { visited[topIdx] = 1; queue.push(topIdx); }
    if (isBgColor(botIdx * 4)) { visited[botIdx] = 1; queue.push(botIdx); }
  }
  for (let y = 0; y < height; y++) {
    const leftIdx = y * width;
    const rightIdx = y * width + (width - 1);
    if (!visited[leftIdx] && isBgColor(leftIdx * 4)) { visited[leftIdx] = 1; queue.push(leftIdx); }
    if (!visited[rightIdx] && isBgColor(rightIdx * 4)) { visited[rightIdx] = 1; queue.push(rightIdx); }
  }

  if (queue.length === 0) {
    return await sharp(inputBuffer).trim({ threshold: 4 }).png().toBuffer();
  }

  // Medição de segurança do núcleo central (onde o equipamento roteador fica situado)
  const coreXMin = Math.floor(width * 0.25);
  const coreXMax = Math.floor(width * 0.75);
  const coreYMin = Math.floor(height * 0.25);
  const coreYMax = Math.floor(height * 0.75);
  const coreTotal = Math.max(1, (coreXMax - coreXMin) * (coreYMax - coreYMin));
  let coreErased = 0;

  // BFS Flood Fill com barreira de gradiente
  let head = 0;
  while (head < queue.length) {
    const curr = queue[head++];
    const cx = curr % width;
    const cy = Math.floor(curr / width);

    if (cx >= coreXMin && cx < coreXMax && cy >= coreYMin && cy < coreYMax) {
      coreErased++;
    }

    const currIdx = curr * 4;
    const cR = data[currIdx];
    const cG = data[currIdx + 1];
    const cB = data[currIdx + 2];

    const neighbors = [
      cy > 0 ? curr - width : -1,
      cy < height - 1 ? curr + width : -1,
      cx > 0 ? curr - 1 : -1,
      cx < width - 1 ? curr + 1 : -1
    ];

    for (const n of neighbors) {
      if (n !== -1 && visited[n] === 0) {
        const nIdx = n * 4;
        if (isBgColor(nIdx)) {
          // Barreira de gradiente: não atravessa a borda plástica do roteador
          const grad = Math.abs(data[nIdx] - cR) + Math.abs(data[nIdx + 1] - cG) + Math.abs(data[nIdx + 2] - cB);
          if (grad <= gradientBarrier) {
            visited[n] = 1;
            queue.push(n);
          }
        }
      }
    }
  }

  // Trava de segurança: se mais de 65% do centro da imagem foi atingido, o roteador/objeto é branco!
  // Preserva a imagem original com recorte de bordas para não apagar o roteador.
  const coreRatio = coreErased / coreTotal;
  if (coreRatio > 0.65) {
    console.log(`[imageProcessor] Objeto branco detectado no centro (${(coreRatio * 100).toFixed(1)}% do núcleo). Preservando equipamento.`);
    return await sharp(inputBuffer).trim({ threshold: 4 }).png().toBuffer();
  }

  // Aplica transparência total nos pixels de fundo
  for (let i = 0; i < totalPixels; i++) {
    if (visited[i] === 1) {
      data[i * 4 + 3] = 0;
    }
  }

  // Suavização sutil nas bordas
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
          const r = data[idx * 4];
          const g = data[idx * 4 + 1];
          const b = data[idx * 4 + 2];
          if (r > 235 && g > 235 && b > 235) {
            data[idx * 4 + 3] = 210;
          }
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
 * Processa a imagem para exibição perfeita no sistema:
 * - Remove fundo branco quando solicitado;
 * - Corta bordas vazias (trim);
 * - Ajusta dimensões máximas mantendo a proporção original estrita sem achatar ou cortar;
 * - Exporta em PNG com transparência.
 */
export async function processAndOptimizeImage(
  inputBuffer: Buffer,
  options: ProcessImageOptions = {}
): Promise<Buffer> {
  const {
    removeBackground = true,
    maxWidth = 900,
    maxHeight = 900,
    tolerance = 28
  } = options;

  let buffer = inputBuffer;

  if (removeBackground) {
    try {
      buffer = await removeWhiteBackground(buffer, tolerance);
    } catch (err) {
      console.warn('Aviso: Falha ao remover fundo, mantendo imagem original:', err);
    }
  }

  // Redimensiona proporcionalmente mantendo proporção (fit: inside)
  return await sharp(buffer)
    .resize({
      width: maxWidth,
      height: maxHeight,
      fit: 'inside',
      withoutEnlargement: true
    })
    .png({ quality: 90, compressionLevel: 8 })
    .toBuffer();
}

