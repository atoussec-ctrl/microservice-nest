# Creates semantic commits, pushes the branch, and opens a PR.
# Run from the microservice-nest repository root:
#   powershell -ExecutionPolicy Bypass -File scripts/release.ps1
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

$authorName = git log -1 --format="%an" main
$authorEmail = git log -1 --format="%ae" main
$env:GIT_AUTHOR_NAME = $authorName
$env:GIT_AUTHOR_EMAIL = $authorEmail
$env:GIT_COMMITTER_NAME = $authorName
$env:GIT_COMMITTER_EMAIL = $authorEmail

$branch = git branch --show-current
if ($branch -ne "feat/profile-service-hardening-and-docs") {
  Write-Host "Expected branch feat/profile-service-hardening-and-docs (current: $branch)"
  exit 1
}

function Commit($paths, $title, $body) {
  git add @paths
  if (-not (git diff --cached --quiet)) {
    git commit -m $title -m $body
  }
}

Commit @(
  "profile-service/src/infrastructure/messaging/aws-client.config.ts",
  "profile-service/src/infrastructure/messaging/sns-event.publisher.ts",
  "profile-service/src/infrastructure/messaging/sqs-profile-index.consumer.service.ts"
) "feat(messaging): add SQS polling loop and shared AWS client config" "Enable continuous SQS consumption for the OpenSearch indexing pipeline and centralize LocalStack credential handling for SNS/SQS clients."

Commit @(
  "profile-service/src/infrastructure/search/opensearch-profile.repository.ts",
  "profile-service/src/infrastructure/search/opensearch-bootstrap.service.ts",
  "profile-service/src/profile.module.ts"
) "feat(search): bootstrap OpenSearch index on startup" "Apply the profiles index template and create the search index automatically when the application starts."

Commit @(
  "profile-service/src/application/use-cases/get-profile-by-id.use-case.ts",
  "profile-service/src/infrastructure/persistence/prisma-user-profile.repository.ts",
  "profile-service/src/infrastructure/persistence/profile.mapper.ts",
  "profile-service/test/integration/prisma-user-profile.repository.spec.ts",
  "profile-service/test/support/in-memory-repositories.ts",
  "profile-service/test/unit/infrastructure/profile.mapper.spec.ts",
  "profile-service/test/unit/use-cases/create-profile.use-case.spec.ts",
  "profile-service/test/unit/use-cases/get-profile-by-id.use-case.spec.ts"
) "fix(profile): hide soft-deleted profiles and allow username reuse" "Treat deleted profiles as not found in queries, exclude inactive rows from uniqueness checks, and release username/email slots on soft delete."

Commit @(
  "profile-service/.env.example",
  "profile-service/docker-compose.yml",
  "profile-service/.gitattributes",
  "profile-service/scripts/localstack-init.sh"
) "chore(infra): upgrade LocalStack and configure coexistence ports" "Use LocalStack 4.4.0, provision SNS/SQS via awslocal init script, and map Postgres to 5433 and LocalStack to 4567 so both microservices can run together."

Commit @(
  "profile-service/package.json",
  "profile-service/package-lock.json",
  "profile-service/src/health",
  "profile-service/src/swagger.ts",
  "profile-service/src/main.ts",
  "profile-service/src/app.module.ts",
  "docs/postman"
) "feat(docs): add Swagger UI, health endpoint, and Postman collection" "Expose OpenAPI at /api/docs, add GET /health with database check, and ship Postman collection and environment for Profile Service and Threat Triage Engine."

Commit @(
  "scripts/release.ps1"
) "chore(scripts): add release automation for commits and PR" "Provide a local script to create semantic commits and open the pull request."

git push -u origin HEAD

$body = @"
## Summary
- Harden the event-driven indexing pipeline (SQS polling, AWS credentials, OpenSearch bootstrap)
- Fix soft-delete semantics so deleted profiles are hidden and usernames can be reused
- Upgrade local infrastructure (LocalStack 4.4.0, coexistence ports with Threat Triage Engine)
- Add API documentation: Swagger UI, health endpoint, and Postman collection/environment

## Test plan
- [x] ``npm test`` in profile-service (107 tests)
- [x] ``npm run build`` in profile-service
- [ ] ``docker compose up -d`` and ``npm run start:dev``
- [ ] Import ``docs/postman/collection.json`` and ``environment.json``
- [ ] Verify Swagger at http://localhost:3000/api/docs
- [ ] Run Create Profile → Search Profiles flow end-to-end
"@

gh pr create --title "feat(profile-service): harden pipeline, fix soft-delete, and add API docs" --body $body
