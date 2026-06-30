# TDD Practices — Pirâmide de Testes

## Pirâmide

| Camada | Proporção | Foco |
|--------|-----------|------|
| Unit — Domain | ~40% | VOs, invariantes, eventos de domínio |
| Unit — Use Cases | ~35% | Orquestração com fakes in-memory |
| Integration | ~20% | Adapters, consumer idempotência |
| E2E | ~5% | Fluxos GraphQL críticos |

## Ciclo Red → Green → Refactor

1. Escreva o teste que falha (Red).
2. Implemente o mínimo para passar (Green).
3. Refatore mantendo os testes verdes (Refactor).

## Convenções

- **AAA**: Arrange, Act, Assert — estrutura clara em cada teste.
- **Naming**: `should_<expected>_when_<condition>`.
- **Fakes over mocks**: preferir repositórios in-memory a mocks excessivos.
- **Determinismo**: injetar `Clock` e `IdGenerator` — nunca depender de wall-clock ou UUIDs aleatórios.

## Coverage

- Gate de **90%** em lines/functions para `src/domain` e `src/application`.
- Integração e E2E complementam, não substituem, testes unitários.

## Comandos

```bash
npm test              # todos os suites
npm run test:unit     # domain + use cases
npm run test:integration
npm run test:e2e
npm run test:cov      # com coverage gate
```
