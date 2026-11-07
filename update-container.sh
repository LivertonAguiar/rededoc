#!/usr/bin/env bash
set -e

echo "========================================"
echo "[ITFY] Atualizando container itfy-app..."
echo "========================================"

cd /opt/docker/itfy

echo "-> Atualizando código do repositório (git pull)..."
git pull origin main

echo "-> Reconstruindo imagem Docker itfy-app..."
docker compose build itfy-app

echo "-> Reiniciando container itfy-app..."
docker compose up -d itfy-app

echo "-> Aguardando inicialização..."
sleep 6

echo "-> Verificando integridade e saúde da aplicação..."
if docker exec itfy-app node -e "fetch('http://127.0.0.1:3001/api/health').then(r => { if (!r.ok) process.exit(1); console.log('Saúde OK:', r.status); process.exit(0) }).catch(() => process.exit(1))"; then
    echo "========================================"
    echo "[ITFY] Container atualizado com SUCESSO!"
    echo "URL: https://itfy.lpaguiar.com.br"
    echo "========================================"
else
    echo "[ITFY] AVISO: Falha na verificação de saúde. Verifique os logs com: docker logs itfy-app"
    exit 1
fi

