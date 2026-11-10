# Changelog — ITFY (Sistema de Documentação de Redes)

Todas as alterações notáveis deste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/)
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

---

## [1.0.5] - 2026-11-10

### 🛡️ Proteção do Banco de Dados contra Perda de Dados (Zero Data Loss)
- **Motor de Snapshots Atômicos Periódicos (`backupService.ts`)**:
  - Implementado sistema de backup online sem bloqueio com o comando nativo SQLite `VACUUM INTO`.
  - Agendador automático executado a cada 12 horas com rotatividade inteligente (retenção automática dos últimos 14 pontos para prevenir esgotamento de disco).
  - Cada snapshot acompanha manifesto JSON com data ISO, tamanho formatado, hash criptográfico SHA-256 e contadores de entidades (clientes, equipamentos, credenciais, ordens de serviço).
- **Proteção Preventiva Pré-Restauração (Rollback Automático)**:
  - Antes de qualquer importação de JSON ou restauração de snapshot, um backup de segurança do estado atual é gerado instantaneamente (`pre-import` / `pre-restore`). Em caso de falha ou engano, o administrador pode reverter a qualquer momento.
- **Resiliência e Integridade do SQLite**:
  - Configurados novos PRAGMAs: `synchronous = NORMAL`, `busy_timeout = 5000` (elimina erros de concorrência `SQLITE_BUSY`) e `wal_autocheckpoint = 1000`.
  - Verificação de integridade no startup com `PRAGMA integrity_check` e endpoint `/api/backup/integrity`.
- **Encerramento Gracioso (Graceful Shutdown)**:
  - Captura dos sinais `SIGTERM` e `SIGINT` (reboot do host / restart do container docker) para descarregar o buffer WAL com `PRAGMA wal_checkpoint(TRUNCATE)` e fechar conexões de forma segura, evitando corrupção de páginas.
- **Painel Interativo de Snapshots no Frontend (`BackupView.tsx`)**:
  - Indicadores em tempo real da saúde da base (status de integridade, tamanho do arquivo ativo e buffer WAL).
  - Tabela de pontos de restauração históricos com badges de identificação (automático, manual, pré-restauração), cópia rápida de SHA-256 e ações para baixar `.sqlite`, restaurar ponto ou excluir.

### 🐛 Correções de Falhas Críticas
- **Correção no Exportador ZIP de Backup**:
  - Corrigido bug crítico em `backupRouter.get('/export-zip')` que referenciava o arquivo legado `rededoc.sqlite` em vez da base ativa `itfy.sqlite`, o que resultava no download de dados defasados.
  - O exportador agora executa checkpoint do WAL e gera snapshot via `VACUUM INTO` em tempo real para inclusão no arquivo `.zip`.

---

## [1.0.4] - 2026-11-08

### 🚀 Melhorias de Experiência Mobile & Atualizações
- **Fluxo de Atualização no Aplicativo Android Nativo**:
  - Ajustado o banner de atualização (`OtaUpdateNotifier`) para reconhecer o ambiente nativo do Capacitor. Ao invés de tentar recarregar assets estáticos internos que estão gravados na partição read-only do APK, o botão agora aciona diretamente o download do novo instalador `ITFY-v1.0.4.apk` e abre o assistente de instalação do Android.
  - Eliminação de valores fixos legados (`v1.0.1`): O botão de download em *Configurações > Banco & Backup* agora consulta em tempo real a versão disponível no servidor e reflete dinamicamente a versão mais recente (`Baixar ITFY-v1.0.4.apk`).

---

## [1.0.3] - 2026-11-08

### 🐛 Correções de Falhas
- **Resolução de Imagens e Fotos de Equipamentos no Aplicativo Mobile**:
  - Implementada a função de resolução universal `resolveMediaUrl` em todos os nós da Topologia, vitrines de equipamentos, modais de cadastro/edição, relatórios técnicos, ordens de serviço e portal do cliente.
  - No aplicativo nativo Android (Capacitor), URLs relativas (`/uploads/...`) agora são automaticamente direcionadas para o endpoint de produção absoluto (`https://itfy.lpaguiar.com.br/uploads/...`), permitindo que as fotos de roteadores/ONTs, leitores faciais e câmeras sejam renderizadas sem falha.
  - Tratamento defensivo no evento `onError` das imagens para ocultar o contêiner vazio caso o arquivo não exista no servidor, evitando caixas pretas sem conteúdo.

---

## [1.0.2] - 2026-11-08

### 🚀 Novas Funcionalidades & Design
- **Modo Tela Cheia & Respeito ao Entalhe (Notch / Display Cutout)**:
  - Configurado `android:windowLayoutInDisplayCutoutMode="shortEdges"` no tema nativo do Android (`styles.xml`), permitindo expansão fluida da interface sobre todo o display.
  - Cores nativas das barras do sistema alinhadas ao tema escuro da aplicação (`statusBarColor #0F1B2D` e `navigationBarColor #0A1424`).
  - Suporte completo a Safe Area Insets (`safe-top`, `safe-bottom-nav`, `safe-left`, `safe-right`) para prevenir qualquer sobreposição de elementos interativos com câmeras frontais tipo gota/furo ou barra de gestos do Android.
- **Redesenho Completo da Sidebar**:
  - Interface moderna estilo Cyber Glassmorphism (`#0A1324` com bordas sutis `#1B2F52`).
  - Logotipo oficial `ItfyLogo` integrado com insígnia `Pro` no topo.
  - Card interativo e destacado com o condomínio/cliente selecionado em atendimento e indicador de status.
  - Efeito de seleção neon com gradiente (`from-blue-600/30 via-cyan-500/15`) e animações suaves ao pairar o mouse/toque.
  - Card de download direto do APK mobile com versão e destaque visual.
  - Rodapé funcional com avatar do técnico, status de conexão em tempo real, botão de notas de versão e encerramento de sessão.

### 🛡️ Assinatura e Compatibilidade Android
- **Assinatura Determinística v1/v2**: Inclusão de keystore definitivo permitindo atualizações sucessivas sem conflito de pacotes no Android.

---

## [1.0.1] - 2026-11-08

### 🚀 Novas Funcionalidades
- **Cadastro Offline-First**: Implementado suporte a cadastro e edição de equipamentos em modo offline sem internet. Os dados são protegidos localmente em IndexedDB (`itfy_offline_db`) e sincronizados automaticamente em segundo plano assim que a conexão é restaurada.
- **Atualizações Over-The-Air (OTA)**: Sistema de notificação in-app e sincronização de atualizações sem necessidade de reinstalação do APK Android para correções e melhorias web.
- **Identidade Visual & Logotipo ITFY**: Criação do novo logotipo proprietário *Cyber Nexus* com símbolos de alta fidelidade e substituição completa dos ícones genéricos do Android e PWA.
- **Painel de Histórico e Registro de Versões**: Modal integrado no sistema com notas de versão completas e indicador de status da release.

### 🐛 Correções de Falhas
- **Login no Aplicativo Android Nativo (Capacitor)**: Corrigido o erro `Unexpected token '<', "<!doctype "... is not valid JSON` no WebView ao direcionar automaticamente chamadas de API para o backend absoluto `https://itfy.lpaguiar.com.br/api`.
- **Anexos e Fotos no Mobile**: Resolução de URLs de fotos e uploads com detecção de plataforma nativa do Capacitor.
- **Tratamento Defensivo na Camada de Rede**: Exibição de mensagens de erro amigáveis em português quando a resposta do servidor não for JSON válido.

### 🛡️ Segurança e Resiliência
- **Cofre de Senhas Offline**: Credenciais cadastradas simultaneamente com novos equipamentos são enfileiradas com criptografia local e sincronizadas com AES-256-GCM no servidor.
- **Garantia Contra Perda de Dados**: Fila de mutações com controle de tentativas, persistência transacional e identificadores temporários únicos.

---

## [1.0.0] - 2026-11-05

### 🚀 Lançamento Inicial
- **Gestão de Infraestrutura de Condomínios e Empresas**: Inventário completo de roteadores, switches, access points, controladoras faciais, módulos de guarita e DVR/NVR.
- **Topologia Interativa de Rede**: Diagrama interativo de conexões físicas e lógicas com auto-organização e exportação em alta qualidade.
- **Mapeamento e Conflitos IPAM**: Validação de sub-redes, detecção de conflitos de IP e sugestão automática de próximo IP livre.
- **Cofre de Senhas Criptografado**: Armazenamento seguro de credenciais com AES-256-GCM.
- **Gestão de Ordens de Serviço (OS)**: Abertura, acompanhamento e fechamento de chamados técnicos com anexos fotográficos.
- **Suporte Mobile e PWA**: Instalação como aplicativo no Android/iOS com suporte a gestos de toque e câmera nativa.

