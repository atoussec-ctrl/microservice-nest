# ADR-002: CQRS with Postgres (write) + OpenSearch (read)

**Status:** Accepted

**Context:** Search needs full-text/autocomplete that a relational DB serves poorly; writes need constraints and integrity.

**Decision:** Postgres is the source of truth; OpenSearch is a derived read model. `profile(id)` reads Postgres; `searchProfiles` reads OpenSearch.

**Consequences:** Search is eventually consistent. Clear separation, independent scaling.
