# CLAUDE — notas de contexto (engenharia + IA)

Este arquivo é usado como "memória" do projeto: decisões arquiteturais, convenções, pontos de atenção e contexto para que um agente (ou dev) retome o trabalho com menos fricção.

## Objetivo do projeto

- MVP: compartilhar localização em tempo real (passageiro -> acompanhante)
- Deve rodar em **um único servidor** (Next.js + Socket.IO + SQLite)

## Principais decisões

- **Next.js App Router**: único ponto de entrada, SSR possível, deploy simples.
- **Socket.IO** em `src/pages/api/socket.ts`: modo servidor único, compatível com `next dev` / `next start`.
- **Prisma + SQLite**: persistência leve, sem infra adicional (um único arquivo `dev.db`).
- **Teste unitário** (Jest) para camada de API / helpers.
- **CI**: GitHub Actions roda lint, typecheck, testes e build.

## Como usar (para desenvolvedor)

- `npm run dev` — rodar local
- `npm test` — rodar testes
- `npm run lint` — rodar lint

## Pontos de atenção futuros (backlog)

- Autenticação real (JWT / OAuth)
- Autorizar apenas quem criou a viagem a enviar atualizações
- Persistir histórico de localização (prisma + paginacao)
- Melhor UX: exibir estado de conexão, manejar falha de GPS, mostrar rastro no mapa
- Segurança: validação de input e sanitização de entradas

## Referências do Akita

1. Pequenos commits + CI (já tem GitHub Actions)
2. TDD (testes básicos já presentes)
3. Humano decide o quê, agente faz o como (este repositório usa essa filosofia)
4. Refatoração contínua (remover duplicação, promover reutilização)
5. Documentação (este arquivo + README)
6. Small releases (commit por feature, CI garante qualidade)
7. Segurança como hábito (validar inputs, evitar dependências perigosas)
8. Agente nunca diz "não" (implementa, mas você decide)
