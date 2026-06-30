# ADR-005: Code-first GraphQL with an SDL contract

**Status:** Accepted

**Context:** Want decorator-driven types co-located with code, but a reviewable contract too.

**Decision:** NestJS code-first resolver kept in lockstep with a checked-in `schema.graphql`.

**Consequences:** Schema drift is caught in review; the SDL doubles as documentation.
