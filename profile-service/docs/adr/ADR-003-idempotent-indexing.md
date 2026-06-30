# ADR-003: Idempotent, version-aware indexing

**Status:** Accepted

**Context:** SNS→SQS is at-least-once and can deliver out of order.

**Decision:** Every event carries `version`; the OpenSearch scripted upsert ignores writes whose version <= the indexed one. SNS FIFO dedupes on `aggregateId:version:type`.

**Consequences:** Duplicate/stale deliveries are safe no-ops. Requires version discipline in the aggregate.
