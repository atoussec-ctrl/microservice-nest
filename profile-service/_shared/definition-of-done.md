# Definition of Done

Um item está **Done** quando:

- [ ] Spec/contrato atualizado (`specs/schema.graphql`, `prisma/schema.prisma` se aplicável)
- [ ] Testes unitários escritos **antes** da implementação (TDD)
- [ ] Testes passando (`npm test`)
- [ ] Coverage ≥ 90% em domain + application (`npm run test:cov`)
- [ ] Sem dependências invertidas (domain não importa infrastructure)
- [ ] ADR criado/atualizado se decisão arquitetural nova
- [ ] `.env.example` atualizado para novas variáveis
- [ ] README/quickstart reflete mudanças de uso
