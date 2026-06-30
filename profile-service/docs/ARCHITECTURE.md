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

## Read pipeline (SQS consumer)

The outbox poller publishes to SNS FIFO; an SQS queue subscribes to the topic. The `SqsProfileIndexConsumerService` (infrastructure) long-polls the queue, unwraps the SNS envelope, delegates to the idempotent `ProfileIndexConsumer`, and deletes the message only on success. Malformed or failing messages are left in the queue for retry / DLQ.

## Exception handling

Domain errors are pure and carry a semantic `code` (`DomainErrorCode`): `VALIDATION`, `CONFLICT`, `NOT_FOUND`, `VERSION_CONFLICT`. The presentation layer owns the transport mapping: `DomainExceptionFilter` (a global `GqlExceptionFilter`) translates each code into a `GraphQLError` with `extensions.code` (`BAD_USER_INPUT`, `CONFLICT`, `NOT_FOUND`, `PRECONDITION_FAILED`) plus an informational `httpStatus`. The domain never imports framework/HTTP concerns; the dependency rule is preserved.

The single-entity `profile(id)` query returns `null` on `ProfileNotFoundError` (idiomatic nullable lookup); all other domain errors surface through the filter.

See `docs/adr/` for individual decisions.
