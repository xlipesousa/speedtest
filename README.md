# Speedtest Modernizado

Este repositório contém a evolução do sistema de speedtest. A pasta legado/ mantém a versão atual em produção. O desenvolvimento ocorre nas novas pastas frontend/ (SvelteKit + TypeScript) e backend/ (Go).

## Requisitos
- Node.js 20+
- npm 10+
- Go 1.23+

## Comandos úteis
```bash
# frontend
cd frontend
npm install
npm run dev
npm run check

# backend
cd backend
GO111MODULE=on go run ./cmd/server
```

Contribua atualizando IMPLEMENTATION_NOTES.md com decisões adicionais.
