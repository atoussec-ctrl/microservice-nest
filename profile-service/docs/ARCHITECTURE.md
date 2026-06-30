# Profile Service — Architecture

A user-profiles microservice built with **NestJS + GraphQL**, persisting to **PostgreSQL (RDS)** as the source of truth and projecting a read model into **OpenSearch**. Events propagate asynchronously through the **Transactional Outbox → SNS → SQS** pipeline. The codebase follows **Clean Architecture**, **SOLID**, and a TDD workflow.

## Layered design

| Layer | Responsibility | Depends on |
|-------|----------------|------------|
| **Domain** | Entities, value objects, domain events, repository ports | nothing |
| **Application** | Use cases, `Clock`, `IdGenerator` ports | Domain |
| **Infrastructure** | Prisma, OpenSearch, SNS, outbox poller, SQS consumer | Application, Domain |
| **Presentation** | GraphQL resolver, types, inputs | Application |

## CQRS split

- Writes → PostgreSQL (strong consistency)
- `profile(id)` → PostgreSQL
- `searchProfiles` → OpenSearch (eventual consistency)

## Transactional Outbox

Aggregate row and outbox event written in one Prisma transaction. Poller publishes pending events asynchronously.

## Delivery guarantees

At-least-once delivery with version-aware upsert and SNS FIFO deduplication.

See `docs/adr/` for individual decisions.
