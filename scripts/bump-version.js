const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

// 1. Ler argumentos
const arg = process.argv[2] || 'patch';
const description = process.argv[3] || '';

// 2. Ler versão atual do package.json
const pkgPath = path.join(root, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const currentVersion = pkg.version;

function bump(ver, type) {
  const parts = ver.split('.').map(n => parseInt(n, 10) || 0);
  let [major, minor, patch] = parts;

  if (type === 'major') {
    major += 1;
    minor = 0;
    patch = 0;
  } else if (type === 'minor') {
    minor += 1;
    patch = 0;
  } else if (type === 'patch') {
    patch += 1;
  } else if (/^\d+\.\d+\.\d+$/.test(type)) {
    return type;
  } else {
    throw new Error(`Tipo de versão inválido: ${type}. Use 'patch', 'minor', 'major' ou '1.2.3'.`);
  }

  return `${major}.${minor}.${patch}`;
}

const newVersion = bump(currentVersion, arg);

// 3. Ler e incrementar versionCode do Android
const gradlePath = path.join(root, 'client', 'android', 'app', 'build.gradle');
let gradleContent = fs.readFileSync(gradlePath, 'utf8');

const codeMatch = gradleContent.match(/versionCode\s+(\d+)/);
const currentCode = codeMatch ? parseInt(codeMatch[1], 10) : 1;
const newCode = currentCode + 1;

console.log(`\n======================================================`);
console.log(`🚀 Atualizando Versão do ITFY`);
console.log(`   Versão:  v${currentVersion}  ───>  v${newVersion}`);
console.log(`   Android: Code ${currentCode}       ───>  Code ${newCode}`);
console.log(`======================================================\n`);

// Atualiza package.json raiz
pkg.version = newVersion;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log(`✓ package.json atualizado`);

// Atualiza client/package.json
const clientPkgPath = path.join(root, 'client', 'package.json');
const clientPkg = JSON.parse(fs.readFileSync(clientPkgPath, 'utf8'));
clientPkg.version = newVersion;
fs.writeFileSync(clientPkgPath, JSON.stringify(clientPkg, null, 2) + '\n');
console.log(`✓ client/package.json atualizado`);

// Atualiza server/package.json
const serverPkgPath = path.join(root, 'server', 'package.json');
const serverPkg = JSON.parse(fs.readFileSync(serverPkgPath, 'utf8'));
serverPkg.version = newVersion;
fs.writeFileSync(serverPkgPath, JSON.stringify(serverPkg, null, 2) + '\n');
console.log(`✓ server/package.json atualizado`);

// Atualiza client/android/app/build.gradle
gradleContent = gradleContent
  .replace(/versionCode\s+\d+/, `versionCode ${newCode}`)
  .replace(/versionName\s+"[^"]+"/, `versionName "${newVersion}"`);
fs.writeFileSync(gradlePath, gradleContent);
console.log(`✓ client/android/app/build.gradle atualizado (code: ${newCode}, name: "${newVersion}")`);

// Atualiza client/src/services/otaService.ts
const otaPath = path.join(root, 'client', 'src', 'services', 'otaService.ts');
if (fs.existsSync(otaPath)) {
  let otaContent = fs.readFileSync(otaPath, 'utf8');
  otaContent = otaContent
    .replace(/CURRENT_CLIENT_VERSION\s*=\s*'[^']+'/, `CURRENT_CLIENT_VERSION = '${newVersion}'`)
    .replace(/CURRENT_CLIENT_BUILD\s*=\s*\d+/, `CURRENT_CLIENT_BUILD = ${newCode}`);
  fs.writeFileSync(otaPath, otaContent);
  console.log(`✓ client/src/services/otaService.ts atualizado`);
}

// Atualiza server/src/index.ts
const serverIndexPath = path.join(root, 'server', 'src', 'index.ts');
if (fs.existsSync(serverIndexPath)) {
  let serverIndex = fs.readFileSync(serverIndexPath, 'utf8');
  serverIndex = serverIndex
    .replace(/const currentVersion = '[^']+';/, `const currentVersion = '${newVersion}';`)
    .replace(/version:\s*'[^']+',(\s*\/\/|\s*buildNumber)/, `version: '${newVersion}',$1`)
    .replace(/buildNumber:\s*\d+/, `buildNumber: ${newCode}`)
    .replace(/apkFileName:\s*'ITFY-v[^']+\.apk'/, `apkFileName: 'ITFY-v${newVersion}.apk'`);
  fs.writeFileSync(serverIndexPath, serverIndex);
  console.log(`✓ server/src/index.ts atualizado`);
}

// Atualiza CHANGELOG.md
const changelogPath = path.join(root, 'CHANGELOG.md');
if (fs.existsSync(changelogPath)) {
  let changelog = fs.readFileSync(changelogPath, 'utf8');
  const today = new Date().toISOString().split('T')[0];
  const newHeader = `## [${newVersion}] - ${today}`;

  if (!changelog.includes(newHeader)) {
    const template = `## [${newVersion}] - ${today}\n\n### 🚀 Novas Funcionalidades\n- ${description || 'Melhorias contínuas do sistema.'}\n\n### 🐛 Correções de Falhas\n- \n\n---\n\n`;
    changelog = changelog.replace(/(# Changelog[^\n]*\n[\s\S]*?---\n\n)/, `$1${template}`);
    fs.writeFileSync(changelogPath, changelog);
    console.log(`✓ CHANGELOG.md atualizado com seção v${newVersion}`);
  }
}

console.log(`\n🎉 Todos os 7 arquivos sincronizados com sucesso para a versão v${newVersion}!`);
console.log(`\nPróximos passos recomendados:`);
console.log(`  1. git add . && git commit -m "chore(release): bump version to v${newVersion}"`);
console.log(`  2. git tag -a v${newVersion} -m "Release v${newVersion}"`);
console.log(`  3. git push origin main --follow-tags`);
console.log(`\nIsso disparará automaticamente a compilação do APK ITFY-v${newVersion}.apk e atualização OTA.`);
