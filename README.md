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

---

## 🛠️ Tecnologias Utilizadas

- **Frontend**: React 18, TypeScript, Vite, TailwindCSS, Lucide React Icons, Fontes IBM Plex Sans / IBM Plex Mono.
- **Backend**: Node.js 24, TypeScript, Express REST API.
- **Banco de Dados**: SQLite relacional nativo (`node:sqlite`) com WAL (*Write-Ahead Logging*) e integridade de chaves estrangeiras ativas.
- **Segurança**: Criptografia AES-256-GCM, Bcrypt para usuários do sistema e autenticação JWT.
- **DevOps**: Dockerfile multi-stage e Docker Compose.

---

## 🏁 Como Executar o Projeto

### 1. Execução Local Direta (Node.js)

Clone ou navegue até o diretório do projeto:

```bash
cd c:\Users\Suporte\Documents\ITLY
```

Popule o banco de dados com os dados de demonstração do **Condomínio Aurora**:
```bash
npm run seed
```

Inicie o servidor de produção (serve a API e o Frontend compilado):
```bash
npm start
```

Acesse em seu navegador:
👉 **http://localhost:3001**

Para desenvolvimento simultâneo com hot-reload:
```bash
# Terminal 1: Backend
npm run dev --workspace=server

# Terminal 2: Frontend
npm run dev --workspace=client
```

---

### 2. Implantação com Docker Compose

Para executar em contêineres Docker isolados com volumes persistentes para banco e uploads:

```bash
docker compose up -d --build
```

A aplicação estará disponível em `http://localhost:3001` (ou em produção via `https://itfy.lpaguiar.com.br`). Os dados são mantidos nos volumes `./data` e `./uploads`.

---

## 📋 Dados de Demonstração (Condomínio Residencial Aurora)

- **Cliente**: Condomínio Residencial Aurora (Rua das Flores, 120, Fortaleza, CE)
- **Roteador/ONT**: Huawei HG8145X6 (IP WAN: `203.0.113.45`, IP Local: `192.168.1.1`, MAC: `34:97:EB:12:34:56`)
- **Terminal Facial**: Control iD iDFace Max (`192.168.1.50`, MAC: `00:1A:2B:3C:4D:5E`, Porta WAN 8050 → 80)
- **Módulo Guarita**: Nice 3000 (`192.168.1.60`, MAC: `00:1B:44:7A:90:C1`, Porta WAN 8060 → 8000)
- **CFTV**: HiLook DVR-216Q-K1 (`192.168.1.70`, MAC: `00:1C:55:8E:21:F4`, Portas 8070, 8071 e 8072)
- **Usuário Padrão**: Liverton Aguiar (`tecnico@rededoc.com` / senha: `admin123`)

