# ADR-006: JWT authentication with ownership-based authorization

**Status:** Accepted

**Context:** `updateProfile` and `deleteProfile` had no authentication at all — any caller could mutate or delete any profile by guessing/enumerating its UUID (IDOR). `profile-service` has no separate identity provider in this workspace, and `UserProfile` carries no password/credential field.

**Decision:** `createProfile` doubles as the identity-issuing action: on success it returns the created `profile` plus a JWT `accessToken` (HS256, `sub` = the new profile's id, 1h expiry, secret from `JWT_SECRET`). `updateProfile` and `deleteProfile` are guarded by `JwtAuthGuard` (verifies the bearer token) and additionally require the token's `sub` to match the target profile id, enforced in `ProfileResolver` before delegating to the use case — a caller can only ever modify the profile they authenticated as. `profile` and `searchProfiles` stay public (read-only, no sensitive fields beyond what's already returned).

Kept out of the domain/application core: the `TokenIssuer` port (`application/ports/application.port.ts`) is the only application-layer awareness of tokens; `JwtTokenIssuer` (infrastructure) and `JwtAuthGuard`/`CurrentUser` (presentation) hold all framework/JWT-specific code, matching the existing ports-and-adapters boundary.

**Consequences:** Closes the IDOR gap without requiring a separate auth service or a password/login system. Ownership is necessarily 1:1 with identity (a profile can only ever act as itself) — there is no concept of one identity managing multiple profiles, or of roles/admin overrides; either would need a real identity model layered on top later. Losing an `accessToken` is losing control of that profile until expiry (1h) — no refresh-token or revocation mechanism exists yet.
