import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { initDatabase, queryAll, queryOne, execute } from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Inicializa banco de dados SQLite
initDatabase();

// Suporte a argumentos CLI: --client=<id> ou argumento posicional
const args = process.argv.slice(2);
let targetClientId: string | null = null;

for (const arg of args) {
  if (arg.startsWith('--client=')) {
    targetClientId = arg.split('=')[1];
  } else if (arg.startsWith('--clientId=')) {
    targetClientId = arg.split('=')[1];
  } else if (!arg.startsWith('--') && !targetClientId) {
    targetClientId = arg;
  }
}

const rootDir = path.resolve(__dirname, '../../../');

function inferTags(title: string, body: string): string[] {
  const text = (title + ' ' + body).toLowerCase();
  const tags: string[] = [];

  if (text.includes('control id') || text.includes('control_id') || text.includes('idface')) tags.push('control_id');
  if (text.includes('hikvision')) tags.push('hikvision');
  if (text.includes('intelbras')) tags.push('intelbras');
  if (text.includes('mikrotik') || text.includes('routerboard') || text.includes('winbox')) tags.push('mikrotik');
  if (text.includes('cgnat')) tags.push('cgnat');
  if (text.includes('cftv') || text.includes('dvr') || text.includes('nvr') || text.includes('câmera')) tags.push('cftv');
  if (text.includes('facial') || text.includes('leitora facial')) tags.push('facial');
  if (text.includes('porta') || text.includes('redirecionamento') || text.includes('nat')) tags.push('portas');
  if (text.includes('vpn')) tags.push('vpn');
  if (text.includes('mip 1000') || text.includes('mip1000')) tags.push('mip1000');

  return tags.length > 0 ? tags : ['procedimento', 'rede'];
}

function parseMarkdownSections(filePath: string): Array<{ title: string; body: string; tags: string[] }> {
  const content = fs.readFileSync(filePath, 'utf-8');
  // Divide o arquivo por separadores comuns encontrados nos arquivos de documentação
  const rawSections = content.split(/\n={10,}\n|\n-{10,}\n/g);
  const articles: Array<{ title: string; body: string; tags: string[] }> = [];

  for (const raw of rawSections) {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.length < 30) continue;

    const lines = trimmed.split('\n');
    let title = '';
    let bodyStartIndex = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('#')) {
        title = line.replace(/^#+\s*/, '').trim();
        bodyStartIndex = i + 1;
        break;
      }
    }

    if (!title && lines.length > 0) {
      title = lines[0].replace(/^#+\s*/, '').trim();
      bodyStartIndex = 1;
    }

    if (!title) continue;

    const body = lines.slice(bodyStartIndex).join('\n').trim();
    if (!body || body.length < 20) continue;

    const tags = inferTags(title, body);
    articles.push({ title, body: `# ${title}\n\n` + body, tags });
  }

  return articles;
}

export async function importArticles() {
  console.log('=====================================================');
  console.log(' Início da Importação de Artigos / Base de Conhecimento');
  console.log(` Cliente alvo: ${targetClientId ? targetClientId : 'GLOBAL (Artigos visíveis para todos os clientes)'}`);
  console.log('=====================================================');

  const filesToScan = [
    path.join(rootDir, 'condfy_deep_dive.md'),
    path.join(rootDir, 'condfy_hardware_ports.md'),
    path.join(rootDir, 'condfy_technical_documentation.md')
  ];

  let importedCount = 0;
  let skippedCount = 0;
  const importedArticleIds: { id: string; title: string }[] = [];

  for (const file of filesToScan) {
    if (!fs.existsSync(file)) {
      console.log(`[AVISO] Arquivo não encontrado: ${path.basename(file)}`);
      continue;
    }

    console.log(`\nProcessando arquivo: ${path.basename(file)}...`);
    const parsedList = parseMarkdownSections(file);

    for (const item of parsedList) {
      // Idempotência: verifica se o artigo já existe pelo título
      const existing = queryOne<any>('SELECT id, version FROM articles WHERE title = ?', item.title);

      if (existing) {
        console.log(`  [PULADO] Já existe: "${item.title}" (ID: ${existing.id}, v${existing.version})`);
        skippedCount++;
        importedArticleIds.push({ id: existing.id, title: item.title });
        continue;
      }

      const id = 'art_' + crypto.randomUUID().slice(0, 8);
      const tagsString = item.tags.join(', ');

      // Cria artigo
      execute(`
        INSERT INTO articles (
          id, client_id, title, body_md, tags, visible_in_portal,
          version, created_by, updated_by
        ) VALUES (?, ?, ?, ?, ?, 1, 1, 'Importador Técnico', 'Importador Técnico')
      `, id, targetClientId, item.title, item.body, tagsString);

      // Cria versão inicial 1 no histórico
      execute(`
        INSERT INTO article_versions (id, article_id, version, title, body_md, changed_by)
        VALUES (?, ?, 1, ?, ?, 'Importador Técnico')
      `, 'ver_' + crypto.randomUUID().slice(0, 8), id, item.title, item.body);

      console.log(`  [CRIADO] "${item.title}" [Tags: ${tagsString}] -> ID: ${id}`);
      importedCount++;
      importedArticleIds.push({ id, title: item.title });
    }
  }

  // Vincula automaticamente um artigo a um equipamento facial do Condomínio Aurora se existir
  try {
    const facialEquip = queryOne<any>(`
      SELECT id, name, client_id FROM equipments
      WHERE name LIKE '%Facial%' OR model LIKE '%Face%'
      LIMIT 1
    `);

    const controlIdArticle = importedArticleIds.find(a =>
      a.title.toLowerCase().includes('control') || a.title.toLowerCase().includes('facial')
    );

    if (facialEquip && controlIdArticle) {
      const existingLink = queryOne<any>(`
        SELECT id FROM entity_links
        WHERE (source_type = 'equipment' AND source_id = ? AND target_type = 'article' AND target_id = ?)
           OR (source_type = 'article' AND source_id = ? AND target_type = 'equipment' AND target_id = ?)
      `, facialEquip.id, controlIdArticle.id, controlIdArticle.id, facialEquip.id);

      if (!existingLink) {
        const linkId = 'link_' + crypto.randomUUID().slice(0, 8);
        execute(`
          INSERT INTO entity_links (id, client_id, source_type, source_id, target_type, target_id, label, created_by)
          VALUES (?, ?, 'equipment', ?, 'article', ?, 'Procedimento Operacional', 'Importador')
        `, linkId, facialEquip.client_id, facialEquip.id, controlIdArticle.id);

        console.log(`\n[VÍNCULO AUTO] Equipamento "${facialEquip.name}" vinculado ao artigo "${controlIdArticle.title}" (Link ID: ${linkId})`);
      }
    }
  } catch (err: any) {
    console.error('Aviso ao vincular artigo a equipamento:', err.message);
  }

  console.log('\n=====================================================');
  console.log(` Importação concluída!`);
  console.log(` Artigos criados: ${importedCount}`);
  console.log(` Artigos mantidos/pulados (já existentes): ${skippedCount}`);
  console.log('=====================================================');
}

// Execução direta via CLI
importArticles().catch(err => {
  console.error('Erro fatal durante a importação:', err);
  process.exit(1);
});

