# ADR-004: Prisma as the write-side ORM

**Status:** Accepted

**Context:** Need typed DB access plus transactional outbox support.

**Decision:** Prisma with `$transaction` for the atomic aggregate+outbox write. Read side bypasses the ORM and queries OpenSearch directly.

**Consequences:** Strong typing and migrations on the write side; the search adapter stays ORM-free.
