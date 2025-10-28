    #!/bin/bash

echo "🚀 Iniciando deploy do Blog Backend..."

# 1. Atualizar código do Git
echo "📥 Baixando código atualizado..."
git pull origin main

# 2. Instalar dependências
echo "📦 Instalando dependências..."
npm install

# 3. Gerar Prisma Client
echo "🔧 Gerando Prisma Client..."
npx prisma generate

# 4. Rodar migrações do banco
echo "🗄️  Aplicando migrações do banco de dados..."
npx prisma migrate deploy

# 5. Reiniciar aplicação com PM2
echo "🔄 Reiniciando aplicação..."
pm2 restart blog-backend || pm2 start src/server.js --name blog-backend

echo "✅ Deploy concluído com sucesso!"
echo "📊 Status da aplicação:"
pm2 status