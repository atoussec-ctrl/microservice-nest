---
name: pre-commit-validation
description: >-
  Equipe de validação pré-commit para Backend (Node, TypeScript, Python),
  TDD, Clean Code, Clean Architecture, GoF patterns, pirâmide de testes,
  NestJS, Jest, Husky e ESLint. Use antes de commitar, ao configurar hooks,
  ao revisar PRs ou quando o usuário pedir validação de qualidade de código.
globs: "*.ts,*.py,package.json,.husky/*,.github/workflows/*"
---

# Pre-Commit Validation — Equipe de Especialistas Backend

Pipeline de validação que simula um **comitê de especialistas** antes de cada commit.

## Especialistas (papéis)

| Especialista | Foco | Ferramenta |
|---|---|---|
| **Architect** | Clean Architecture, Dependency Rule, CQRS, ports/adapters | Revisão estrutural |
| **Clean Coder** | SOLID, nomes expressivos, funções pequenas, DRY moderado | ESLint + review |
| **TDD Coach** | Red→Green→Refactor, pirâmide de testes, fakes vs mocks | Jest |
| **NestJS Expert** | Modules, DI, composition root, GraphQL code-first | Build |
| **Pattern Guard** | GoF aplicável (Strategy, Factory, Repository, Observer/outbox) | Review |
| **Python Lead** | type hints, pytest, ruff/black quando houver `.py` | ruff/pytest |
| **Gatekeeper** | Husky hook, lint-staged, coverage gate | Husky |

## Pipeline (ordem obrigatória)

Execute na pasta do serviço (`profile-service/` ou raiz do package):

```bash
# 1. Lint — zero warnings/errors
npm run lint

# 2. Build — TypeScript compila
npm run build

# 3. Pirâmide de testes (base → topo)
npm run test:unit          # domain + use cases (~75%)
npm run test:integration   # adapters, consumer idempotência
npm run test:e2e           # fluxos GraphQL críticos (opcional no hook rápido)

# 4. Coverage gate (domain + application ≥ 90%)
npm run test:cov
```

### Hook Husky (pre-commit rápido)

O hook `.husky/pre-commit` (na raiz do repo) executa o **fast path**:

```bash
cd profile-service
npx lint-staged          # ESLint nos arquivos staged
npm run build            # compilação TypeScript
npm run test:unit        # testes rápidos (domain + use cases)
```

Setup na raiz do repositório:

```bash
npm install              # instala husky via root package.json
git config core.hooksPath .husky
```

Validação completa (CI / antes de PR):

```bash
npm run validate         # lint + build + unit + integration + coverage
```

## Checklist de revisão (comitê)

Antes de aprovar um commit, verifique:

### Clean Architecture
- [ ] Domain não importa NestJS, Prisma, OpenSearch ou AWS SDK
- [ ] Use cases dependem de ports (interfaces), não de adapters concretos
- [ ] Composition root (`profile.module.ts`) é o único lugar com bindings concretos

### TDD & Pirâmide
- [ ] Testes unitários de domain/use-cases existem para código novo
- [ ] `Clock` e `IdGenerator` injetados (sem wall-clock/UUID aleatório em testes)
- [ ] Integração cobre idempotência/eventos quando aplicável
- [ ] Coverage ≥ 90% em `src/domain` + `src/application`

### Clean Code & SOLID
- [ ] Um use case = uma responsabilidade (SRP)
- [ ] Erros de domínio tipados (`DomainError`), não strings genéricas
- [ ] Sem comentários que repetem o código

### GoF Patterns (quando aplicável)
- [ ] **Repository** — ports de persistência
- [ ] **Strategy** — adapters intercambiáveis (Prisma vs in-memory)
- [ ] **Observer/Outbox** — eventos de domínio + outbox assíncrono
- [ ] **Factory** — `UserProfile.create()` / `reconstitute()`

### NestJS
- [ ] Resolvers só traduzem transporte → use cases
- [ ] GraphQL code-first espelha `specs/schema.graphql`
- [ ] `@Inject(TOKEN)` para ports no infrastructure

### Python (se houver arquivos `.py`)
- [ ] `ruff check .` passa
- [ ] `pytest` passa
- [ ] Type hints em funções públicas

## Quando invocar o subagent

Para revisão profunda antes de commit/PR, delegue ao subagent **`backend-validation-team`**:

```
Revise as mudanças staged contra o checklist de pre-commit validation.
```

## Configuração Husky (setup inicial)

Na **raiz do repositório**:

```bash
npm install
git config core.hooksPath .husky
```

`lint-staged` está configurado em `profile-service/package.json`:

```json
{
  "lint-staged": {
    "src/**/*.ts": ["eslint --fix"],
    "test/**/*.ts": ["eslint --fix"]
  }
}
```

## Saída esperada

Ao final da validação, reporte:

1. **Verdict**: APPROVED / BLOCKED
2. **Pipeline**: quais steps passaram/falharam
3. **Findings**: lista priorizada (critical → warning → info)
4. **Coverage**: % atual vs gate (90%)

Se BLOCKED, corrija antes de commitar. Nunca use `--no-verify` sem justificativa explícita do usuário.
