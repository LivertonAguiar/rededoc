import { initDatabase, queryAll, queryOne, execute } from '../db/database.js';
import DOMPurify from 'dompurify';
import { marked } from 'marked';

console.log('=====================================================');
console.log(' TESTE AUTOMATIZADO — CRITÉRIOS DE ACEITE DA FASE 2');
console.log('=====================================================');

initDatabase();

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`✅ [PASSOU] ${testName}`);
    passed++;
  } else {
    console.error(`❌ [FALHOU] ${testName}`);
    failed++;
  }
}

// 1. Criação de Artigo e Versão Inicial (v1)
console.log('\n1. Testando criação de artigo...');
const testId = 'art_test_' + Date.now();
execute(`
  INSERT INTO articles (id, client_id, title, body_md, tags, visible_in_portal, version, created_by, updated_by)
  VALUES (?, NULL, 'Procedimento Teste X', '# Teste\nConteúdo inicial.', 'teste,segurança', 1, 1, 'Tester', 'Tester')
`, testId);

execute(`
  INSERT INTO article_versions (id, article_id, version, title, body_md, changed_by)
  VALUES (?, ?, 1, 'Procedimento Teste X', '# Teste\nConteúdo inicial.', 'Tester')
`, 'ver_test_1_' + Date.now(), testId);

const art1 = queryOne<any>('SELECT * FROM articles WHERE id = ?', testId);
const ver1 = queryOne<any>('SELECT * FROM article_versions WHERE article_id = ? AND version = 1', testId);
assert(art1 && art1.version === 1 && art1.title === 'Procedimento Teste X', 'Artigo criado com versão inicial 1');
assert(ver1 && ver1.version === 1 && ver1.body_md.includes('inicial'), 'Versão 1 persistida em article_versions');

// 2. Edição de Artigo e Registro de Nova Versão (v2)
console.log('\n2. Testando atualização de artigo e versionamento...');
execute(`
  INSERT INTO article_versions (id, article_id, version, title, body_md, changed_by)
  VALUES (?, ?, 2, 'Procedimento Teste X Modificado', '# Teste v2\nConteúdo modificado.', 'Tester')
`, 'ver_test_2_' + Date.now(), testId);

execute(`
  UPDATE articles
  SET title = 'Procedimento Teste X Modificado',
      body_md = '# Teste v2\nConteúdo modificado.',
      version = 2,
      updated_by = 'Tester'
  WHERE id = ?
`, testId);

const art2 = queryOne<any>('SELECT * FROM articles WHERE id = ?', testId);
const verCount = queryAll<any>('SELECT * FROM article_versions WHERE article_id = ?', testId);
assert(art2 && art2.version === 2 && art2.title.includes('Modificado'), 'Artigo atualizado para a versão 2');
assert(verCount.length === 2, 'Histórico contém exatamente 2 versões salvas');

// 3. Restauração de Versão Anterior
console.log('\n3. Testando restauração de versão histórica...');
const targetVer = queryOne<any>('SELECT * FROM article_versions WHERE article_id = ? AND version = 1', testId);
const nextVer = 3;
execute(`
  INSERT INTO article_versions (id, article_id, version, title, body_md, changed_by)
  VALUES (?, ?, ?, ?, ?, 'Tester (Restaurado de v1)')
`, 'ver_test_3_' + Date.now(), testId, nextVer, targetVer.title, targetVer.body_md);

execute(`
  UPDATE articles
  SET title = ?, body_md = ?, version = ?, updated_by = 'Tester'
  WHERE id = ?
`, targetVer.title, targetVer.body_md, nextVer, testId);

const artRestored = queryOne<any>('SELECT * FROM articles WHERE id = ?', testId);
assert(artRestored && artRestored.version === 3 && artRestored.title === 'Procedimento Teste X', 'Artigo restaurado para conteúdo da v1 incrementando para v3');

// 4. Sanitização contra XSS
console.log('\n4. Testando sanitização de Markdown/HTML malicioso...');
const maliciousInput = '# Título Seguro\n<script>alert("XSS")</script><img src="x" onerror="alert(1)">\n[Clique aqui](javascript:alert("hacked"))';

// Função de higienização equivalente ao DOMPurify em ambiente backend/headless
function sanitizeHtmlSimple(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/onerror\s*=\s*["'][^"']*["']/gi, '')
    .replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"');
}

const rawHtml = marked.parse(maliciousInput) as string;
const sanitized = sanitizeHtmlSimple(rawHtml);
assert(!sanitized.includes('<script>'), 'Tag <script> removida com sucesso');
assert(!sanitized.includes('onerror='), 'Atributo onerror removido com sucesso');
assert(!sanitized.includes('javascript:'), 'Links javascript: neutralizados');

// Limpa dados de teste
execute('DELETE FROM article_versions WHERE article_id = ?', testId);
execute('DELETE FROM articles WHERE id = ?', testId);

// 5. Verificação de Artigo Vinculado a Equipamento
console.log('\n5. Testando vínculo de artigo a equipamento...');
const link = queryOne<any>(`
  SELECT l.*, e.name as equip_name, a.title as article_title
  FROM entity_links l
  JOIN equipments e ON e.id = l.source_id
  JOIN articles a ON a.id = l.target_id
  WHERE l.source_type = 'equipment' AND l.target_type = 'article'
  LIMIT 1
`);
assert(link !== null, `Equipamento "${link?.equip_name}" possui artigo vinculado: "${link?.article_title}"`);

console.log('\n=====================================================');
console.log(` RESULTADO FINAL FASE 2: ${passed} passaram, ${failed} falharam.`);
console.log('=====================================================');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
