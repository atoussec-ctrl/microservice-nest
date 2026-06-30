# Clean Code & SOLID

## Clean Code

- Nomes revelam intenção (`CreateProfileUseCase`, não `Handler`).
- Funções pequenas, uma responsabilidade.
- Sem comentários que repetem o código — comentários só para regras de negócio não óbvias.
- Erros de domínio tipados (`UsernameAlreadyTakenError`), não strings genéricas.

## SOLID aplicado

| Princípio | Aplicação no Profile Service |
|-----------|------------------------------|
| **S** | Cada use case uma razão para mudar; resolver só traduz transporte |
| **O** | Novo adapter (Redis cache) sem alterar use cases |
| **L** | Qualquer `UserProfileRepository` substituível em testes |
| **I** | Ports separados: write (`UserProfileRepository`) vs read (`ProfileSearchRepository`) |
| **D** | Use cases dependem de interfaces do domínio/aplicação, nunca de Prisma ou AWS SDK |

## Regra de dependência

Dependências apontam sempre para dentro: Presentation → Application → Domain.
