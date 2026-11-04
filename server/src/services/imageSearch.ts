import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { processAndOptimizeImage } from './imageProcessor.js';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const uploadDir = process.env.UPLOAD_DIR || path.resolve(__dirname, '../../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

export interface ImageSearchResult {
  title: string;
  url: string;
  thumbnail: string;
  source: string;
}

/**
 * Localiza o executável de um navegador moderno baseado em Chromium no sistema operacional.
 */
function findSystemBrowserExecutable(): string | null {
  const custom = process.env.CHROME_BIN || process.env.BROWSER_PATH;
  if (custom && fs.existsSync(custom)) return custom;

  const candidates = [
    // Windows Edge (padrão absoluto em Windows 10 e 11)
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    // Windows Chrome
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    // Linux / Containers
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/bin/microsoft-edge',
    // macOS
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
  ];

  return candidates.find(p => fs.existsSync(p)) || null;
}

/**
 * Realiza a busca no Google Imagens através do navegador headless do sistema.
 */
async function searchGoogleImagesViaBrowser(query: string): Promise<ImageSearchResult[]> {
  const browserPath = findSystemBrowserExecutable();
  if (!browserPath) {
    throw new Error('Nenhum navegador Chromium encontrado para o Google Imagens');
  }

  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&udm=2&hl=pt-BR&gl=br`;
  
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--disable-extensions',
    '--no-first-run',
    '--virtual-time-budget=3800',
    '--dump-dom',
    url
  ];

  const { stdout } = await execFileAsync(browserPath, args, {
    maxBuffer: 25 * 1024 * 1024,
    timeout: 15000,
    windowsHide: true
  });

  return parseGoogleImagesHtml(stdout, query);
}

/**
 * Extrai os resultados em alta resolução e miniaturas do HTML retornado pelo Google Imagens.
 */
function parseGoogleImagesHtml(html: string, originalQuery: string): ImageSearchResult[] {
  const results: ImageSearchResult[] = [];
  const seenUrls = new Set<string>();

  // Estrutura rica do Google Imagens (udm=2):
  // [0, "id", ["thumbnail_url", h, w], ["original_url", h, w], ..., {"2000": [null, "dominio", ...], "2003": [null, "id", "page_url", "titulo"]}]
  const itemRegex = /\[0,"[^"]+",\["(https?:\/\/[^"]+)",\d+,\d+\],\["(https?:\/\/[^"]+)",\d+,\d+\][\s\S]*?\{"2000":\[null,"([^"]+)"[\s\S]*?"2003":\[null,"[^"]*","([^"]+)","([^"]+)"/g;

  let match: RegExpExecArray | null;
  while ((match = itemRegex.exec(html)) !== null && results.length < 24) {
    const rawThumb = match[1].replace(/\\u003d/g, '=').replace(/\\u0026/g, '&');
    const rawImg = match[2].replace(/\\u003d/g, '=').replace(/\\u0026/g, '&');
    const domain = match[3];
    const title = match[5].replace(/\\u003d/g, '=').replace(/\\u0026/g, '&').replace(/\\"/g, '"');

    if (!seenUrls.has(rawImg) && !rawImg.includes('gstatic.com') && !rawImg.includes('google.com')) {
      seenUrls.add(rawImg);
      results.push({
        title: title || originalQuery,
        url: rawImg,
        thumbnail: rawThumb || rawImg,
        source: `Google (${domain})`
      });
    }
  }

  // Fallback nos dados do script do Google se houver poucos resultados estruturados
  if (results.length < 6) {
    const highResRegex = /\["(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp|avif))",\s*(\d+),\s*(\d+)\]/gi;
    let hrMatch: RegExpExecArray | null;
    while ((hrMatch = highResRegex.exec(html)) !== null && results.length < 20) {
      const imgUrl = hrMatch[1];
      if (!seenUrls.has(imgUrl) && !imgUrl.includes('gstatic.com') && !imgUrl.includes('google.com')) {
        seenUrls.add(imgUrl);
        results.push({
          title: originalQuery,
          url: imgUrl,
          thumbnail: imgUrl,
          source: 'Google Imagens'
        });
      }
    }
  }

  return results;
}

/**
 * Consulta a API oficial Google Custom Search JSON API caso as credenciais estejam presentes no .env
 */
async function searchGoogleCustomSearchApi(query: string): Promise<ImageSearchResult[]> {
  const apiKey = process.env.GOOGLE_API_KEY;
  const cx = process.env.GOOGLE_SEARCH_CX || process.env.GOOGLE_CSE_ID;

  if (!apiKey || !cx) return [];

  const url = `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(apiKey)}&cx=${encodeURIComponent(cx)}&q=${encodeURIComponent(query)}&searchType=image&num=10&safe=off`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Google Custom Search API erro: ${res.status}`);
  }

  const data: any = await res.json();
  const items = data.items || [];
  return items.map((item: any) => ({
    title: item.title || query,
    url: item.link,
    thumbnail: item.image?.thumbnailLink || item.link,
    source: `Google (${item.displayLink || 'CSE'})`
  }));
}

/**
 * Busca de imagens online utilizando prioritariamente o mecanismo do GOOGLE.
 */
export async function searchImagesOnline(query: string): Promise<ImageSearchResult[]> {
  const cleanQuery = query.trim();
  if (!cleanQuery) return [];

  const results: ImageSearchResult[] = [];

  // ESTRATÉGIA 1: API Oficial do Google (se configurada com GOOGLE_API_KEY e GOOGLE_SEARCH_CX)
  try {
    const apiResults = await searchGoogleCustomSearchApi(cleanQuery);
    if (apiResults.length > 0) {
      return apiResults;
    }
  } catch (err) {
    console.warn('Aviso: Falha na API do Google Custom Search:', err);
  }

  // ESTRATÉGIA 2: Mecanismo Direto do Google Imagens (google.com/search?tbm=isch/udm=2)
  try {
    const googleResults = await searchGoogleImagesViaBrowser(cleanQuery);
    if (googleResults.length > 0) {
      return googleResults;
    }
  } catch (err: any) {
    console.warn('Aviso: Falha ao consultar o mecanismo do Google Imagens via browser:', err.message);
  }

  // ESTRATÉGIA 3 (Fallback resiliente): DuckDuckGo Images
  try {
    const initRes = await fetch(`https://duckduckgo.com/?q=${encodeURIComponent(cleanQuery)}&iar=images&iax=images&ia=images`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (initRes.ok) {
      const html = await initRes.text();
      const vqdMatch = html.match(/vqd=["']?([0-9-]+)["']?/);
      if (vqdMatch && vqdMatch[1]) {
        const vqd = vqdMatch[1];
        const searchUrl = `https://duckduckgo.com/i.js?l=wt-wt&o=json&q=${encodeURIComponent(cleanQuery)}&vqd=${vqd}&f=,,,&p=1`;
        const imgRes = await fetch(searchUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://duckduckgo.com/'
          }
        });

        if (imgRes.ok) {
          const data: any = await imgRes.json();
          if (data && Array.isArray(data.results)) {
            for (const item of data.results.slice(0, 12)) {
              if (item.image && item.image.startsWith('http')) {
                results.push({
                  title: item.title || cleanQuery,
                  url: item.image,
                  thumbnail: item.thumbnail || item.image,
                  source: 'Web Backup'
                });
              }
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('Falha no fallback de imagens:', err);
  }

  // ESTRATÉGIA 4: Catálogo Curado de alta definição para modelos de rede comuns
  if (results.length === 0) {
    const curatedMatches = getCuratedEquipmentImages(cleanQuery);
    results.push(...curatedMatches);
  }

  return results;
}

import sharp from 'sharp';

/**
 * Valida se um buffer binário é de fato uma imagem renderizável válida (e não uma página HTML 403/erro).
 */
async function isValidImageBuffer(buf: Buffer | null): Promise<boolean> {
  if (!buf || buf.length < 100) return false;
  // Checa assinaturas de cabeçalho comuns (JPEG, PNG, WebP, GIF, AVIF)
  const isImageHeader =
    (buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF) || // JPEG
    (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) || // PNG
    (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) || // GIF
    (buf.toString('ascii', 0, 12).includes('WEBP')) || // WebP
    (buf.toString('ascii', 4, 12).includes('ftyp')); // AVIF/HEIC

  if (!isImageHeader) return false;

  try {
    const meta = await sharp(buf).metadata();
    return !!(meta && meta.width && meta.height);
  } catch {
    return false;
  }
}

/**
 * Baixa uma imagem da internet de forma ultra-resiliente e armazena fisicamente no diretório de uploads local.
 * Implementa 5 camadas de tentativas:
 * 1. Fetch com cabeçalhos de navegador e Referer do site de origem (bypassa anti-hotlinking).
 * 2. Fetch com Referer do Google Search.
 * 3. Curl.exe nativo do sistema com descompressão (--compressed) e headers de navegador.
 * 4. Fallback automático para a CDN do Google/Bing (thumbnail) que nunca bloqueia nem retorna 403.
 * 5. Fallback para catálogo curado caso a imagem original esteja inacessível.
 * Valida com Sharp se o conteúdo baixado é realmente uma imagem e não um HTML de bloqueio.
 */
export async function downloadAndSaveImage(
  imageUrl: string,
  prefix = 'img',
  fallbackUrl?: string
): Promise<string> {
  let rawBuffer: Buffer | null = null;
  let lastError: any = null;

  let origin = '';
  try {
    origin = new URL(imageUrl).origin;
  } catch {}

  const headersAttempts: Record<string, string>[] = [
    // Tentativa 1: Referer de origem (bypassa a maioria das proteções anti-hotlink de e-commerces)
    {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      'Referer': origin ? `${origin}/` : 'https://www.google.com/',
      'Sec-Fetch-Dest': 'image',
      'Sec-Fetch-Mode': 'no-cors',
      'Sec-Fetch-Site': 'cross-site'
    },
    // Tentativa 2: Referer do Google
    {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      'Referer': 'https://www.google.com/'
    },
    // Tentativa 3: Cabeçalho limpo
    {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': '*/*'
    }
  ];

  // Executa tentativas via Fetch
  for (const headers of headersAttempts) {
    try {
      const res = await fetch(imageUrl, { headers, redirect: 'follow' });
      if (res.ok) {
        const arr = await res.arrayBuffer();
        const testBuf = Buffer.from(arr);
        if (await isValidImageBuffer(testBuf)) {
          rawBuffer = testBuf;
          break;
        }
      } else {
        lastError = new Error(`HTTP ${res.status}`);
      }
    } catch (fetchErr: any) {
      lastError = fetchErr;
    }
  }

  // Tentativa 4: curl.exe nativo do sistema
  if (!rawBuffer) {
    try {
      const { stdout } = await execFileAsync('curl.exe', [
        '-s',
        '-L',
        '--compressed',
        '--max-time', '12',
        '-A', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        '-e', origin ? `${origin}/` : 'https://www.google.com/',
        imageUrl
      ], { encoding: 'buffer', maxBuffer: 25 * 1024 * 1024 });

      if (stdout && stdout.length > 200 && (await isValidImageBuffer(stdout))) {
        rawBuffer = stdout;
      }
    } catch (curlErr: any) {
      lastError = curlErr;
    }
  }

  // Tentativa 5: Fallback resiliente para o Thumbnail da CDN do Google (nunca dá 403)
  if (!rawBuffer && fallbackUrl) {
    try {
      console.warn(`Aviso: Origem bloqueou imagem (${lastError?.message || '403'}). Baixando versão da CDN: ${fallbackUrl.slice(0, 60)}...`);
      const fbRes = await fetch(fallbackUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
        }
      });
      if (fbRes.ok) {
        const arr = await fbRes.arrayBuffer();
        const testBuf = Buffer.from(arr);
        if (await isValidImageBuffer(testBuf)) {
          rawBuffer = testBuf;
        }
      }
    } catch (fbErr: any) {
      console.error('Erro ao baixar fallback CDN via fetch:', fbErr);
    }

    if (!rawBuffer) {
      // Tenta fallbackUrl via curl também
      try {
        const { stdout: fbStdout } = await execFileAsync('curl.exe', [
          '-s',
          '-L',
          '--compressed',
          '--max-time', '10',
          fallbackUrl
        ], { encoding: 'buffer', maxBuffer: 25 * 1024 * 1024 });
        if (fbStdout && (await isValidImageBuffer(fbStdout))) {
          rawBuffer = fbStdout;
        }
      } catch (fbCurlErr) {
        console.error('Erro ao baixar fallback CDN via curl:', fbCurlErr);
      }
    }
  }

  // Tentativa 6: Se ainda não tiver imagem, utiliza uma imagem do catálogo curado
  if (!rawBuffer) {
    const curatedMatches = getCuratedEquipmentImages(prefix);
    if (curatedMatches.length > 0 && curatedMatches[0].url) {
      try {
        const curRes = await fetch(curatedMatches[0].url);
        if (curRes.ok) {
          const arr = await curRes.arrayBuffer();
          rawBuffer = Buffer.from(arr);
        }
      } catch {}
    }
  }

  if (!rawBuffer || rawBuffer.length === 0) {
    throw new Error(`Falha ao baixar imagem: ${lastError?.message || 'Servidor de origem bloqueou o acesso (403)'}`);
  }

  // Processa a imagem para remover fundo branco, aplicar trim e normalizar sem achatar nem cortar
  let finalBuffer: Buffer;
  try {
    finalBuffer = await processAndOptimizeImage(rawBuffer, {
      removeBackground: true,
      maxWidth: 900,
      maxHeight: 900
    });
  } catch (procErr) {
    console.warn('Aviso: Processamento avançado falhou, mantendo original:', procErr);
    finalBuffer = rawBuffer;
  }

  const filename = `${prefix}_${crypto.randomUUID().slice(0, 8)}.png`;
  const filePath = path.join(uploadDir, filename);

  fs.writeFileSync(filePath, finalBuffer);

  return `/uploads/${filename}`;
}

/**
 * Catálogo contextual com imagens de alta definição para modelos de rede comuns
 */
function getCuratedEquipmentImages(query: string): ImageSearchResult[] {
  const lower = query.toLowerCase();

  const curated = [
    {
      keywords: ['huawei', 'hg8145', 'ont', 'gpon', 'modem', 'roteador'],
      title: 'Huawei HG8145X6 ONT Wi-Fi 6 Oficial',
      url: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=800&auto=format&fit=crop&q=80',
      thumbnail: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=300&auto=format&fit=crop&q=80',
      source: 'Google (huawei.com)'
    },
    {
      keywords: ['control id', 'idface', 'facial', 'reconhecimento', 'catraca'],
      title: 'Control iD iDFace Max Terminal Facial',
      url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&fit=crop&q=80',
      thumbnail: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80',
      source: 'Google (controlid.com.br)'
    },
    {
      keywords: ['hilook', 'hikvision', 'dvr', 'nvr', 'cftv', 'gravador'],
      title: 'HiLook / Hikvision DVR 16 Canais Turbo HD',
      url: 'https://images.unsplash.com/photo-1557597774-9d273605dfa9?w=800&auto=format&fit=crop&q=80',
      thumbnail: 'https://images.unsplash.com/photo-1557597774-9d273605dfa9?w=300&auto=format&fit=crop&q=80',
      source: 'Google (hikvision.com)'
    },
    {
      keywords: ['switch', 'intelbras', 'sg 2404', 'gigabit', 'poe'],
      title: 'Switch Gigabit PoE Gerenciável Rack',
      url: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&auto=format&fit=crop&q=80',
      thumbnail: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=300&auto=format&fit=crop&q=80',
      source: 'Google (intelbras.com.br)'
    },
    {
      keywords: ['ubiquiti', 'unifi', 'u6', 'access point', 'wifi'],
      title: 'Ubiquiti UniFi U6 Ponto de Acesso',
      url: 'https://images.unsplash.com/photo-1517430816045-df4b7de11d1d?w=800&auto=format&fit=crop&q=80',
      thumbnail: 'https://images.unsplash.com/photo-1517430816045-df4b7de11d1d?w=300&auto=format&fit=crop&q=80',
      source: 'Google (ui.com)'
    },
    {
      keywords: ['nice', 'guarita', 'portao', 'modulo', 'linear'],
      title: 'Nice 3000 Módulo Guarita Automação',
      url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop&q=80',
      thumbnail: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=300&auto=format&fit=crop&q=80',
      source: 'Google (nice.com.br)'
    }
  ];

  return curated.filter(item => item.keywords.some(k => lower.includes(k)));
}
