# Stage 1: Build do Frontend e Backend
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Copia manifestos de pacotes
COPY package.json package-lock.json* ./
COPY server/package.json ./server/
COPY client/package.json ./client/

# Instala todas as dependências
RUN npm install

# Copia código-fonte
COPY server/ ./server/
COPY client/ ./client/

# Executa build do backend e frontend
RUN npm run build --workspace=server
RUN npm run build --workspace=client

# Stage 2: Runtime de Produção
FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV DATA_DIR=/app/data
ENV UPLOAD_DIR=/app/uploads

# Instala utilitário nativo de ping ICMP
RUN apt-get update && apt-get install -y --no-install-recommends iputils-ping && rm -rf /var/lib/apt/lists/*

# Copia dependências e artefatos compilados
COPY package.json package-lock.json* ./
COPY server/package.json ./server/
COPY client/package.json ./client/

RUN npm install --omit=dev && npm cache clean --force

COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/client/dist ./client/dist

# Cria diretórios de persistência
RUN mkdir -p /app/data /app/uploads

EXPOSE 3001

CMD ["node", "server/dist/index.js"]

