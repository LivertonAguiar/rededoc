# ITFY — Sistema de Documentação e Gerenciamento de Infraestrutura de Redes

Sistema web completo desenvolvido para técnicos de informática, instaladores e prestadores de serviços de infraestrutura em condomínios e clientes corporativos.

Projetado com foco em agilidade na recuperação de informações técnicas, segurança no armazenamento de senhas e visualização clara da topologia de rede e regras de NAT.

---

## 🚀 Principais Módulos e Funcionalidades

1. **Dashboard Geral & Topologia Visual**:
   - KPIs em tempo real: IP WAN público, Roteador/ONT, Total de Equipamentos, Regras de Portas (ativas, validadas e com falha) e data da última alteração.
   - Mapa visual hierárquico da rede: **Internet → Roteador/ONT → Equipamentos**, com badges âmbar indicando porta externa → porta interna e sinalização de status (verde para funcionando, âmbar para não testada, vermelho para com falha).
   - Painel lateral com resumo da sub-rede (IP local, máscara, gateway, DNS primário/secundário e faixa DHCP), observações técnicas e arquivos de configuração anexados (ex: `config-roteador.bin`).

2. **Cofre de Credenciais Seguro (AES-256-GCM)**:
   - Criptografia autenticada reversível utilizando chave mestre fora do banco (`VAULT_SECRET_KEY`), vetor de inicialização (IV) único de 96 bits e Auth Tag de integridade de 128 bits.
   - Mascaramento padrão no frontend (`••••••••`).
   - Ação explícita de **Revelar** ou **Copiar** que registra instantaneamente um log de auditoria com nome do técnico, data/hora e IP.

3. **Gerenciamento de Redirecionamento de Portas (NAT)**:
   - Mapeamento completo: `WAN_IP:Porta_Externa → Roteador → IP_Local:Porta_Interna (Protocolo)`.
   - **Validação automática de conflitos**: impede o cadastro de portas externas duplicadas no mesmo IP público e protocolo.
   - Distinção transparente entre regra documentada e status de teste validado.

4. **Inventário de Equipamentos**:
   - Cadastro detalhado com categorias (ONT/Roteadores, Terminais Faciais, CFTV/DVR, Módulos de Portão, Switches, Access Points, etc.).
   - Controle de IP local, MAC Address, interface, VLAN, reserva de IP estático por MAC e caminho de menu no roteador.

5. **Atendimentos Técnicos (Ordens de Serviço)**:
   - Linha do tempo dos serviços executados, descrição de problemas, alterações realizadas e resultados de testes.

6. **Relatórios Técnicos e Exportação em PDF**:
   - Geração de relatório consolidado com layout otimizado para impressão ou download em PDF (`window.print()`).
   - Credenciais mantidas ocultas por padrão, com inclusão opcional sob autorização explícita.

7. **Configurações, Backup e Restauração**:
   - Exportação em 1 clique de dump completo do sistema em formato `.json`.
   - Importação e restauração transacional com reversão automática em caso de inconsistência.

8. **Base de Conhecimento e Procedimentos Operacionais (Fase 2)**:
   - Editor Markdown com pré-visualização em tempo real e sanitização estrita contra XSS via DOMPurify.
   - Histórico completo de versões (`article_versions`) com rastreamento de autor e restauração transacional.
   - Artigos globais ou específicos por condomínio, organizados por tags e busca contextual.
   - Integração com `RelatedItems`, permitindo vincular tutoriais operacionais diretamente a equipamentos, portas e credenciais.
   - Script de importação em lote idempotente (`npm run import:articles`).

9. **Vencimentos e Alertas Automatizados (Fase 3)**:
   - Monitoramento proativo de garantias de hardware (`equipments.warranty_expires_at`) e intervalo de rotação de credenciais (`credentials.rotation_days` / `expires_at`).
   - Sinalização visual em cores (vermelho para vencidos, âmbar para prazo de 7 dias e azul para 30 dias).
   - Cartão unificado `ExpirationsCard` presente na Visão Geral Global e no Painel individual de cada condomínio.
   - Agendador interno periódico no Node.js (`setInterval` diário às 08:00 no fuso configurado via `ALERT_HOUR` / `TZ`).
   - Canal de alertas via **Webhook genérico** (POST JSON) para ntfy, Telegram e gateways corporativos.
   - Prevenção rigorosa de duplicidade com registro diário em `notification_log`.

10. **Monitoramento de Domínios, Certificados SSL e DNS (Fase 7)**:
   - Gestão completa de domínios públicos e hostnames DDNS (No-IP, DuckDNS, etc.) vinculados aos condomínios.
   - Verificação nativa de certificados SSL via `node:tls` com cálculo de dias restantes, emissor e status de validade.
   - Resolução de registros DNS (`A`, `MX`, `NS`, `TXT`, `SPF`, `DMARC`, `CAA`) com auditoria de segurança e pontuação (score 0 a 100).
   - Consulta RDAP resiliente (Registro.br e global) para data de expiração do registro e autoridade registradora em modo best-effort.
   - Detecção inteligente de desvio DDNS: alerta imediato caso o IP resolvido divirja do IP público WAN cadastrado do condomínio.
   - Integração automática com o motor unificado de vencimentos e alertas da Fase 3.

11. **Visão Geral Melhorada e Busca Global FTS5 (Fase 5)**:
   - Motor de busca em texto completo de alta performance via SQLite FTS5 (*Full-Text Search*) com normalização de endereços IP e MAC Address (com e sem dois-pontos).
   - Paleta de comando modal estilo Codex/Spotlight acionada pelo atalho global `Ctrl + K` ou `/`.
   - Navegação instantânea por teclado (Up/Down/Enter/Esc) direcionando direto para equipamentos, portas NAT, clientes, procedimentos ou credenciais.
   - Sistema de **Favoritos** persistente por usuário (`favorites`) com marcação de estrela nos cards e cabeçalhos de condomínios.
   - Acesso rápido a **Condomínios Recentes** com persistência em armazenamento local.
   - Painel consolidado de **Atividades Recentes de Auditoria** na tela inicial.

12. **IPAM Simples por Cliente e Detecção de Conflitos (Fase 6)**:
   - Gerenciamento de sub-redes IPv4 por condomínio (tabela `subnets`) com cálculo matemático nativo de rede, broadcast, primeiro/último IP utilizável e total de hosts.
   - Grade visual de ocupação de endereços IP com distinção de status: Gateway, Ocupado (estático), DHCP, Livre e Em Conflito.
   - **Prevenção e detecção ativa de conflitos**:
     - Alerta de IP duplicado entre equipamentos no mesmo cliente.
     - Alerta de equipamento com IP estático dentro da faixa DHCP sem reserva de MAC documentada.
   - Algoritmo inteligente de **Sugestão do Próximo IP Livre** dentro da faixa do condomínio com botão de 1 clique ("Usar próximo livre") no modal de cadastro de equipamentos.
   - Detecção automática e importação/sugestão de sub-redes a partir do inventário de equipamentos existentes.
   - Vínculos bidirecionais automáticos (`RelatedItems`) entre a sub-rede e equipamentos, credenciais ou procedimentos da infraestrutura.

---

## 🛠️ Tecnologias Utilizadas

- **Frontend**: React 18, TypeScript, Vite, TailwindCSS, Lucide React Icons, Fontes IBM Plex Sans / IBM Plex Mono.
- **Backend**: Node.js 24, TypeScript, Express REST API.
- **Banco de Dados**: SQLite relacional nativo (`node:sqlite`) com WAL (*Write-Ahead Logging*) e integridade de chaves estrangeiras ativas.
- **Segurança**: Criptografia AES-256-GCM, Bcrypt para usuários do sistema e autenticação JWT.
- **DevOps**: Dockerfile multi-stage e Docker Compose.

---

## 🚀 Implantação Self-Hosted no Servidor (Proxmox / VPS)

O ITFY foi arquitetado para rodar em modo **Self-Hosted** em servidores dedicados, containers LXC / VMs no **Proxmox VE** ou instâncias **VPS** (Oracle Cloud, Hetzner, DigitalOcean, AWS, etc.) através de contêineres Docker isolados com alta segurança, persistência e proxy reverso.

### 1. Requisitos do Servidor

- Sistema Operacional Linux (Ubuntu 22.04+, Debian 12+, Alpine ou Proxmox LXC/VM)
- **Docker** e **Docker Compose Plugin** instalados
- Proxy Reverso ou Gerenciador de Túnel (Nginx, Nginx Proxy Manager, Traefik, Caddy ou Cloudflare Tunnel)

---

### 2. Passo a Passo de Instalação no Servidor

Clone o repositório no diretório de containers do seu servidor (ex: `/opt/docker/itfy`):

```bash
git clone https://github.com/LivertonAguiar/rededoc.git /opt/docker/itfy
cd /opt/docker/itfy
```

Crie o arquivo de variáveis de ambiente a partir do modelo de produção:

```bash
cp .env.production.example .env
```

Edite o `.env` e configure chaves secretas exclusivas para criptografia do cofre e autenticação JWT:

```bash
nano .env
```

Suba o container com build automático:

```bash
docker compose up -d --build
```

(Opcional) Popule o banco de dados inicial com o cenário de teste:

```bash
docker exec itfy-app npm run seed
```

---

### 3. Atualização Contínua do Servidor (Zero-Downtime)

Para atualizar a aplicação no servidor após novos commits no GitHub, basta executar o script automatizado de atualização:

```bash
./update-container.sh
```

O script baixa as novas alterações, reconstrói o container, aguarda a inicialização e valida a integridade do serviço via endpoint `/api/health`.

---

### 4. Persistência de Dados e Backup

Os dados do sistema são mantidos nos volumes persistentes mapeados na raiz do projeto:
- `./data` → `/app/data`: Armazena o banco relacional SQLite com WAL (`itfy.db`, `itfy.db-wal`, `itfy.db-shm`).
- `./uploads` → `/app/uploads`: Armazena fotos de equipamentos, documentos e anexos de ordens de serviço.

---

### 5. Verificação de Integridade e Saúde da API

A saúde do backend pode ser consultada a qualquer momento através do endpoint:
- `GET /api/health`

Exemplo de resposta:
```json
{
  "status": "ok",
  "system": "ITFY API",
  "version": "1.0.0",
  "timestamp": "2026-11-07T15:46:11.784Z"
}
```

---

## 📋 Dados de Demonstração (Condomínio Residencial Aurora)

- **Cliente**: Condomínio Residencial Aurora (Rua das Flores, 120, Fortaleza, CE)
- **Roteador/ONT**: Huawei HG8145X6 (IP WAN: `203.0.113.45`, IP Local: `192.168.1.1`, MAC: `34:97:EB:12:34:56`)
- **Terminal Facial**: Control iD iDFace Max (`192.168.1.50`, MAC: `00:1A:2B:3C:4D:5E`, Porta WAN 8050 → 80)
- **Módulo Guarita**: Nice 3000 (`192.168.1.60`, MAC: `00:1B:44:7A:90:C1`, Porta WAN 8060 → 8000)
- **CFTV**: HiLook DVR-216Q-K1 (`192.168.1.70`, MAC: `00:1C:55:8E:21:F4`, Portas 8070, 8071 e 8072)
- **Usuário Padrão**: Liverton Aguiar (`tecnico@rededoc.com` / senha: `admin123`)

