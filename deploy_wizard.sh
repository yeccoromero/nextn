#!/bin/bash
set -e

echo "🚀 Iniciando Asistente de Despliegue Automático"
echo "================================================"

# 1. Check for Homebrew
if ! command -v brew &> /dev/null; then
    echo "❌ Error: Homebrew no encontrado. Por favor instálalo desde brew.sh"
    exit 1
fi

# 2. Install GitHub CLI if missing
if ! command -v gh &> /dev/null; then
    echo "📦 Instalando GitHub CLI..."
    brew install gh
else
    echo "✅ GitHub CLI ya instalado."
fi

# 3. Authenticate with GitHub
echo "🔑 Autenticando con GitHub..."
echo "👉 Sigue las instrucciones en el navegador para iniciar sesión."
gh auth login -p https -w

# 4. Create and Push Repository
echo "📂 Creando repositorio en GitHub..."
# Try to create, if fails (e.g. already exists), continue
gh repo create nextn --public --source=. --remote=origin || echo "⚠️ El repositorio ya podría existir o hubo un error. Intentando continuar..."

echo "⬆️ Subiendo código..."
git push -u origin main
git push -u origin dev

# 5. Vercel Deployment
echo "🚀 Desplegando en Vercel..."
echo "Te pedirá loguearte si no lo estás."
npx vercel login
npx vercel project add nextn || echo "⚠️ El proyecto podría ya existir en Vercel."
npx vercel deploy --prod

echo "================================================"
echo "✅ ¡Todo listo! Tu proyecto debería estar desplegado."
