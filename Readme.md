# Profile Service — Event-Driven Backend

Microserviço de perfis de usuário construído com **NestJS + GraphQL**, **PostgreSQL**, **OpenSearch** e pipeline **Transactional Outbox → SNS → SQS**.

## Estrutura

```
profile-service/
├── _shared/          # Princípios transversais (TDD, SOLID, DoD)
├── docs/             # Arquitetura e ADRs
├── specs/            # Contratos GraphQL e OpenSearch
├── prisma/           # Schema PostgreSQL
├── src/              # Clean Architecture (domain → application → infrastructure → presentation)
└── test/             # Pirâmide de testes (unit, integration, e2e)
```

## Quickstart

```bash
cd profile-service
cp .env.example .env
docker compose up -d          # Postgres + OpenSearch
npm install
npx prisma generate
npx prisma db push
npm run start:dev
```

GraphQL Playground: http://localhost:3000/graphql

## Testes

```bash
npm test                  # todos
npm run test:unit         # domain + use cases (~75%)
npm run test:integration  # consumer idempotência
npm run test:e2e          # fluxos GraphQL
npm run test:cov          # coverage gate 90% domain+application
```

## Variáveis de ambiente

| Variável | Descrição |
|----------|-----------|
| `DATABASE_URL` | PostgreSQL connection string |
| `OPENSEARCH_NODE` | OpenSearch endpoint |
| `OPENSEARCH_INDEX` | Nome do índice |
| `SNS_TOPIC_ARN` | SNS FIFO topic ARN |
| `SQS_QUEUE_URL` | SQS queue URL |
| `AWS_REGION` | Região AWS |
| `PORT` | Porta HTTP (default 3000) |

## Arquitetura

- **CQRS**: writes em Postgres; `searchProfiles` em OpenSearch
- **Transactional Outbox**: aggregate + evento na mesma transação
- **Idempotência**: upsert version-aware no índice

Documentação completa em [`profile-service/docs/ARCHITECTURE.md`](profile-service/docs/ARCHITECTURE.md).
