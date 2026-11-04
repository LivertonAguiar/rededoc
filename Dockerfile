# Stage 1: Build do Frontend e Backend
FROM node:24-alpine AS builder

WORKDIR /app

# Copia manifestos de pacotes
COPY package.json ./
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
FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV DATA_DIR=/app/data
ENV UPLOAD_DIR=/app/uploads

# Copia dependências e artefatos compilados
COPY package.json ./
COPY server/package.json ./server/
COPY client/package.json ./client/

RUN npm install --omit=dev

COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/client/dist ./client/dist

# Cria diretórios de persistência
RUN mkdir -p /app/data /app/uploads

EXPOSE 3001

CMD ["node", "server/dist/index.js"]

