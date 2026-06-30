# ADR-001: Transactional Outbox over direct dual-write

**Status:** Accepted

**Context:** Profile writes must reach both Postgres and OpenSearch. Writing to the DB and then publishing to SNS as two operations can leave the index stale if the publish fails after commit.

**Decision:** Persist the aggregate and the event in one Postgres transaction; a poller publishes from the outbox.

**Consequences:** Strong write consistency and no lost events. Adds a small indexing latency (poll interval) and an outbox table to operate.
