# Event-Driven Principles

## Transactional Outbox

- Aggregate e evento persistidos na **mesma transação** PostgreSQL.
- Poller publica eventos `PENDING` de forma assíncrona.
- Elimina dual-write inconsistente (DB commit + SNS publish separados).

## At-least-once delivery

- SNS → SQS garante entrega pelo menos uma vez.
- Consumidores **devem ser idempotentes**.
- Version-aware upsert: eventos com `version <= indexed` são no-ops.

## Ordenação e deduplicação

- SNS FIFO: `MessageGroupId = aggregateId` (ordem por perfil).
- `MessageDeduplicationId = aggregateId:version:type` (dedupe).

## CQRS

- **Write model**: PostgreSQL — integridade, constraints, consistência forte.
- **Read model**: OpenSearch — full-text, autocomplete, filtros.
- `profile(id)` lê Postgres; `searchProfiles` lê OpenSearch (eventual consistency).

## Eventos de domínio

- `ProfileCreated`, `ProfileUpdated`, `ProfileDeleted`.
- Cada evento carrega `aggregateId`, `version`, `payload`, `occurredAt`.
