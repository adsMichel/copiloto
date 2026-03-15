# Copiloto (Geolocation Sharing)

Aplicação demo para compartilhar localização em tempo real, com arquitetura pensada para **engenharia de software de verdade** (pequenos commits, testes, CI, segurança e refatoração contínua).

## 🚀 Tecnologias

- **Next.js (App Router)**
- **TypeScript**
- **Tailwind CSS**
- **Socket.IO** para tempo real
- **Prisma + SQLite** para persistência leve
- **Jest** para testes unitários + mocks
- **GitHub Actions** para CI

## 🧩 Como rodar

```bash
npm install
JWT_SECRET=uma-senha-secreta npm run dev
```

Abra http://localhost:3000

> 💡 Dica: o script `dev` já remove automaticamente o arquivo de lock do Next.js (`.next/dev/lock`) caso ele exista, evitando a mensagem de erro de "lock" quando o servidor anterior não encerrou corretamente.

> 💡 Dica: o script `dev` já remove automaticamente o arquivo de lock do Next.js (`.next/dev/lock`) caso ele exista, evitando a mensagem de erro de "lock" quando o servidor anterior não encerrou corretamente.

## ✅ Scripts úteis

- `npm run dev` - servidor de desenvolvimento
- `npm run build` - build de produção
- `npm run start` - inicia o build em produção
- `npm run lint` - executa ESLint
- `npm run test` - roda testes
- `npm run typecheck` - checa tipos TypeScript

## 🧪 Testes

Este projeto vem com um conjunto básico de testes unitários para a camada de API.

```bash
npm test
```

## 🗂 Estrutura relevante

- `src/app` — frontend (Next.js App Router)
- `src/pages/api` — rotas de API (inclui WebSocket / Socket.IO)
- `src/lib` — helpers (Prisma, Socket, API client)
- `prisma` — esquema e migrações

---

> Baseado nas diretrizes do Akita: commits pequenos, testes como rede de segurança, refatoração contínua e documentação como investimento.
