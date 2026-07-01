# Fluxograma da Aplicação — Profile Service

**Repositório:** `microservice-nest/profile-service` · **Porta:** 3000 · **Protocolo:** GraphQL (síncrono) + Worker SQS (assíncrono)

Este documento descreve a aplicação inteira através de diagramas UML (componentes, classes,
sequência, atividades e estados), cada um seguido do **porquê** da decisão de design. Os
diagramas usam sintaxe [Mermaid](https://mermaid.js.org/) (renderizada nativamente pelo
GitHub/GitLab), seguindo notação UML 2.x. As decisões formais também estão registradas como ADRs
em [`docs/adr/`](./adr/); este documento as amarra visualmente ao fluxo real de execução.

---

## 1. Diagrama de componentes — Clean/Hexagonal Architecture

```mermaid
flowchart TB
    CLIENT["Cliente GraphQL\n(Postman / app)"]

    subgraph PRES["Presentation"]
        RESOLVER["ProfileResolver"]
        GUARD["JwtAuthGuard"]
        CURUSER["@CurrentUser decorator"]
        FILTER["DomainExceptionFilter"]
    end

    subgraph APPL["Application — 5 Use Cases + Portas"]
        UC_CREATE["CreateProfileUseCase"]
        UC_UPDATE["UpdateProfileUseCase"]
        UC_DELETE["DeleteProfileUseCase"]
        UC_GET["GetProfileByIdUseCase"]
        UC_SEARCH["SearchProfilesUseCase"]
        PORT_CLOCK["«port» Clock"]
        PORT_ID["«port» IdGenerator"]
        PORT_TOKEN["«port» TokenIssuer"]
    end

    subgraph DOM["Domain (núcleo — zero dependência de framework/infra)"]
        ENTITY["UserProfile\n(entidade rica)"]
        VOS["Value Objects\nUsername · Email · DisplayName"]
        EVENTS["Domain Events\nProfileCreated/Updated/Deleted"]
        ERRORS["Domain Errors\nVALIDATION/CONFLICT/NOT_FOUND/\nVERSION_CONFLICT/FORBIDDEN"]
        PORT_REPO["«port» UserProfileRepository"]
        PORT_SEARCH["«port» ProfileSearchRepository"]
        PORT_OUTBOX["«port» OutboxRepository"]
        PORT_PUB["«port» EventPublisher"]
    end

    subgraph INFRA["Infrastructure (adapters)"]
        PRISMA["PrismaUserProfileRepository\n+ PrismaOutboxRepository"]
        OS_REPO["OpenSearchProfileRepository"]
        SNS_PUB["SnsEventPublisher"]
        JWT_ISSUER["JwtTokenIssuer"]
        OUTBOX_POLLER["OutboxPollerService\n@Cron 10s"]
        SQS_CONSUMER["SqsProfileIndexConsumerService"]
        IDX_CONSUMER["ProfileIndexConsumer"]
    end

    PG[("PostgreSQL\nuser_profiles + outbox_events")]
    OS[("OpenSearch\níndice profiles-v1")]
    SNSQ["SNS FIFO profile-events.fifo\n→ SQS profile-index-queue"]

    CLIENT --> RESOLVER
    RESOLVER --> GUARD
    GUARD --> CURUSER
    RESOLVER --> UC_CREATE
    RESOLVER --> UC_UPDATE
    RESOLVER --> UC_DELETE
    RESOLVER --> UC_GET
    RESOLVER --> UC_SEARCH
    RESOLVER -.->|erro de domínio| FILTER

    UC_CREATE --> ENTITY
    UC_CREATE --> PORT_REPO
    UC_CREATE --> PORT_CLOCK
    UC_CREATE --> PORT_ID
    UC_CREATE --> PORT_TOKEN
    UC_UPDATE --> PORT_REPO
    UC_DELETE --> PORT_REPO
    UC_GET --> PORT_REPO
    UC_SEARCH --> PORT_SEARCH

    ENTITY --> VOS
    ENTITY --> EVENTS
    ENTITY -.->|lança| ERRORS

    PORT_REPO -.impl.-> PRISMA
    PORT_SEARCH -.impl.-> OS_REPO
    PORT_OUTBOX -.impl.-> PRISMA
    PORT_PUB -.impl.-> SNS_PUB
    PORT_TOKEN -.impl.-> JWT_ISSUER

    PRISMA --> PG
    OUTBOX_POLLER --> PORT_OUTBOX
    OUTBOX_POLLER --> PORT_PUB
    SNS_PUB --> SNSQ
    SQS_CONSUMER --> SNSQ
    SQS_CONSUMER --> IDX_CONSUMER
    IDX_CONSUMER --> PORT_SEARCH
    OS_REPO --> OS

    style DOM fill:#e8f5e9,stroke:#2e7d32
    style APPL fill:#e3f2fd,stroke:#1565c0
    style PRES fill:#fff3e0,stroke:#e65100
    style INFRA fill:#fce4ec,stroke:#ad1457
```

**Por quê Ports & Adapters aqui, e não a arquitetura modular simples usada no `cyberalert`?**
Este serviço tem duas fontes de persistência com consistência diferente (Postgres forte,
OpenSearch eventual), um mecanismo de propagação assíncrona (outbox → SNS → SQS) e regras de
negócio não triviais (bloqueio otimista, soft-delete com liberação de username). Isolar o domínio
via portas permite testar `UserProfile`, os 5 use cases e as regras de negócio **sem** subir
Postgres/OpenSearch/LocalStack — e trocar a implementação de busca (ex.: outro motor além do
OpenSearch) sem tocar em `application/` ou `domain/`. A regra de dependência (setas `-.impl.->`
sempre apontando de fora para dentro) é o que garante que `domain/` nunca importe Prisma, o AWS
SDK ou o cliente OpenSearch — verificável a olho em qualquer arquivo de `src/domain/`.

---

## 2. Diagrama de classes — domínio e aplicação

```mermaid
classDiagram
    class UserProfile {
        <<Rich Domain Entity>>
        +readonly string id
        +readonly Username username
        +readonly Email email
        +DisplayName displayName
        +string avatarUrl
        +ProfileStatus status
        +int version
        -boolean deleted
        -DomainEvent[] domainEvents
        +create(props)$ UserProfile
        +reconstitute(data)$ UserProfile
        +update(props) void
        +delete(now) void
        +isDeleted() boolean
        +pullDomainEvents() DomainEvent[]
        +toPayload() DomainEventPayload
    }

    class Username {
        <<Value Object>>
        -string value
        +create(raw)$ Username
        +toString() string
        +equals(other) boolean
    }
    class Email {
        <<Value Object>>
        +create(raw)$ Email
        +toString() string
    }
    class DisplayName {
        <<Value Object>>
        +create(raw)$ DisplayName
        +toString() string
    }

    class DomainEvent {
        <<interface>>
        +string aggregateId
        +string type
        +int version
        +DomainEventPayload payload
        +Date occurredAt
    }
    class ProfileCreatedEvent
    class ProfileUpdatedEvent
    class ProfileDeletedEvent
    DomainEvent <|.. ProfileCreatedEvent
    DomainEvent <|.. ProfileUpdatedEvent
    DomainEvent <|.. ProfileDeletedEvent

    class DomainError {
        <<abstract>>
        +readonly DomainErrorCode code
    }
    class InvalidUsernameError
    class UsernameAlreadyTakenError
    class ProfileNotFoundError
    class VersionConflictError
    class ProfileAlreadyDeletedError
    class ForbiddenProfileAccessError
    DomainError <|-- InvalidUsernameError
    DomainError <|-- UsernameAlreadyTakenError
    DomainError <|-- ProfileNotFoundError
    DomainError <|-- VersionConflictError
    DomainError <|-- ProfileAlreadyDeletedError
    DomainError <|-- ForbiddenProfileAccessError

    class UserProfileRepository {
        <<port / interface>>
        +save(profile, events) Promise
        +findById(id) Promise~UserProfile~
        +existsByUsername(username) Promise~boolean~
        +existsByEmail(email) Promise~boolean~
    }
    class TokenIssuer {
        <<port / interface>>
        +issueFor(profileId) string
    }
    class Clock {
        <<port / interface>>
        +now() Date
    }

    class CreateProfileUseCase {
        -UserProfileRepository repository
        -Clock clock
        -IdGenerator idGenerator
        -TokenIssuer tokenIssuer
        +execute(input) CreateProfileResult
    }
    class UpdateProfileUseCase {
        -UserProfileRepository repository
        -Clock clock
        +execute(input) UserProfile
    }
    class DeleteProfileUseCase {
        -UserProfileRepository repository
        -Clock clock
        +execute(id) boolean
    }
    class GetProfileByIdUseCase {
        -UserProfileRepository repository
        +execute(id) UserProfile
    }
    class SearchProfilesUseCase {
        -ProfileSearchRepository searchRepository
        +execute(input) ProfileSearchResult
    }

    UserProfile *-- Username
    UserProfile *-- Email
    UserProfile *-- DisplayName
    UserProfile ..> DomainEvent : registra via recordEvent()
    UserProfile ..> DomainError : lança (update/delete)

    CreateProfileUseCase --> UserProfileRepository
    CreateProfileUseCase --> TokenIssuer
    CreateProfileUseCase --> Clock
    CreateProfileUseCase ..> UserProfile : UserProfile.create()
    UpdateProfileUseCase --> UserProfileRepository
    UpdateProfileUseCase ..> UserProfile : profile.update()
    DeleteProfileUseCase --> UserProfileRepository
    DeleteProfileUseCase ..> UserProfile : profile.delete()
    GetProfileByIdUseCase --> UserProfileRepository
```

**Por quê `UserProfile` tem construtor `private` e fábricas estáticas (`create`/`reconstitute`)?**
Garante que **toda** instância nasce em um estado válido: `create()` é o único caminho para um
perfil novo (versão inicial = 1, evento `ProfileCreatedEvent` registrado automaticamente),
enquanto `reconstitute()` é usado exclusivamente pelo mapper de persistência para reidratar uma
linha do banco em uma entidade — sem gerar eventos de domínio (não é uma "criação" de novo, é uma
leitura). Um construtor público permitiria montar um `UserProfile` em estado inconsistente
(ex.: `version=0` sem evento correspondente).

**Por quê `update()`/`delete()` lançam exceção em vez de retornar `Result<T, Error>`?**
Consistência com o restante do codebase: `DomainError` é uma hierarquia tipada
(`DomainErrorCode` como discriminador), capturada uma única vez no limite da aplicação — o
`DomainExceptionFilter` no GraphQL (ver §6). Isso evita que cada use case precise checar e
repassar manualmente um objeto de erro, mantendo o código de orquestração enxuto (DRY).

**Por quê `TokenIssuer` é uma porta da camada de aplicação, não do domínio?**
`UserProfile` (domínio) não sabe o que é um JWT — emitir um token não é uma regra de negócio do
perfil, é uma preocupação de infraestrutura de segurança orientada a caso de uso (só
`CreateProfileUseCase` precisa emitir um token, no momento em que a identidade nasce). Colocar a
porta em `application/ports/` em vez de `domain/ports/` comunica exatamente esse escopo.

---

## 3. Diagrama de sequência — `createProfile` (identidade + emissão de JWT)

```mermaid
sequenceDiagram
    autonumber
    participant C as Cliente (Postman)
    participant R as ProfileResolver
    participant UC as CreateProfileUseCase
    participant VO as Value Objects
    participant Repo as UserProfileRepository\n(PrismaUserProfileRepository)
    participant DB as PostgreSQL
    participant Ent as UserProfile
    participant JWT as JwtTokenIssuer

    C ->> R: mutation createProfile(input)
    R ->> UC: execute(input)
    UC ->> VO: Username.create / Email.create / DisplayName.create
    alt validação falha
        VO -->> UC: throw InvalidXxxError (VALIDATION)
    end
    UC ->> Repo: existsByUsername(username)
    Repo ->> DB: count(username, status != INACTIVE)
    alt username já em uso
        DB -->> UC: throw UsernameAlreadyTakenError (CONFLICT)
    end
    UC ->> Repo: existsByEmail(email)
    alt email já em uso
        DB -->> UC: throw EmailAlreadyTakenError (CONFLICT)
    end
    UC ->> Ent: UserProfile.create({id, username, email, displayName, now})
    Ent -->> UC: profile (version=1, evento ProfileCreated registrado)
    UC ->> Ent: pullDomainEvents()
    Ent -->> UC: [ProfileCreatedEvent]
    UC ->> Repo: save(profile, events)
    Repo ->> DB: $transaction([UPSERT user_profiles, INSERT outbox_events])
    UC ->> JWT: issueFor(profile.id)
    JWT -->> UC: accessToken (HS256, sub=profile.id, exp=1h)
    UC -->> R: {profile, accessToken}
    R -->> C: CreateProfileResultType {profile, accessToken}
```

**Por quê `createProfile` não exige autenticação, mas devolve um token?**
Não existe um provedor de identidade separado neste workspace — `createProfile` **é** o ato de
nascimento da identidade. O token emitido aqui é a prova de posse daquele perfil para as próximas
chamadas (ver ADR-006). Isso resolve o problema de autenticação sem exigir um serviço de login
adicional, ao custo de não haver conceito de uma pessoa dona de múltiplos perfis.

---

## 4. Diagrama de sequência — `updateProfile` / `deleteProfile` (guarda + ownership + lock otimista)

```mermaid
sequenceDiagram
    autonumber
    participant C as Cliente (Postman)
    participant Guard as JwtAuthGuard
    participant R as ProfileResolver
    participant UC as UpdateProfileUseCase
    participant Repo as UserProfileRepository
    participant Ent as UserProfile
    participant Filter as DomainExceptionFilter

    C ->> Guard: mutation updateProfile(input)\nHeader: Authorization Bearer TOKEN
    Guard ->> Guard: extractBearerToken(header)
    alt sem token
        Guard -->> C: 401 UNAUTHENTICATED (via Filter)
    end
    Guard ->> Guard: jwtService.verifyAsync(token)
    alt token inválido/expirado
        Guard -->> C: 401 UNAUTHENTICATED
    end
    Guard ->> Guard: request.user = {sub: payload.sub}
    Guard -->> R: canActivate() = true

    R ->> R: @CurrentUser() lê request.user.sub
    R ->> R: currentUserId !== input.id ?
    alt token não pertence ao perfil alvo
        R ->> Filter: throw ForbiddenProfileAccessError
        Filter -->> C: 403 FORBIDDEN
    else é o dono
        R ->> UC: execute(input)
        UC ->> Repo: findById(input.id)
        alt não encontrado
            Repo -->> Filter: throw ProfileNotFoundError
            Filter -->> C: 404 NOT_FOUND
        end
        UC ->> Ent: profile.update({expectedVersion: input.version, ...})
        alt profile.isDeleted()
            Ent -->> Filter: throw ProfileAlreadyDeletedError (CONFLICT)
        else version !== expectedVersion
            Ent -->> Filter: throw VersionConflictError
            Filter -->> C: 412 PRECONDITION_FAILED
        else ok
            Ent ->> Ent: version += 1, recordEvent(ProfileUpdatedEvent)
            UC ->> Repo: save(profile, events)
            UC -->> R: profile atualizado
            R -->> C: 200 ProfileType
        end
    end
```

**Por quê a checagem de ownership (`currentUserId !== input.id`) acontece no `ProfileResolver`, e
não dentro do `UpdateProfileUseCase`?**
O `JwtAuthGuard` e o conceito de "usuário autenticado atual" são preocupações de transporte
(GraphQL/JWT) — a camada de aplicação (`UseCase`) não deveria saber que existe um "chamador
autenticado" além do id do recurso que está manipulando. Colocar a checagem no resolver mantém o
`UpdateProfileUseCase`/`DeleteProfileUseCase` reutilizáveis por qualquer transporte futuro (ex.:
uma mutação administrativa interna sem guard) sem duplicar a regra de autorização — e mantém o
domínio livre de qualquer noção de "quem está logado".

**Por quê a checagem de ownership acontece antes de chamar o use case, e não depois?**
Fail-fast: evita uma consulta ao banco (`findById`) para um chamador que já sabemos, só pelo
token, que não tem permissão — tanto por eficiência quanto para não vazar, via timing ou efeitos
colaterais, se o recurso existe antes mesmo de confirmar a autorização.

**Por quê lock otimista (`version`) em vez de lock pessimista (`SELECT ... FOR UPDATE`)?**
GraphQL mutations são requisições HTTP independentes e potencialmente concorrentes vindas de
clientes diferentes; segurar uma transação de banco aberta entre o `findById` e o `save` (lock
pessimista) amarraria uma conexão de pool pelo tempo de ida-e-volta da requisição inteira. O
padrão `version` incrementado a cada `update()`/`delete()` detecta o conflito na escrita
(`VersionConflictError`) sem bloquear leituras concorrentes — o cliente decide se tenta de novo.

---

## 5. Diagrama de sequência — Transactional Outbox → SNS FIFO → SQS → OpenSearch (CQRS assíncrono)

```mermaid
sequenceDiagram
    autonumber
    participant UC as UseCase (Create/Update/Delete)
    participant Repo as PrismaUserProfileRepository
    participant DB as PostgreSQL
    participant Poller as OutboxPollerService\n(@Cron a cada 10s)
    participant SNS as SnsEventPublisher
    participant Topic as SNS FIFO\nprofile-events.fifo
    participant Queue as SQS\nprofile-index-queue
    participant Consumer as SqsProfileIndexConsumerService
    participant Idx as ProfileIndexConsumer
    participant OS as OpenSearchProfileRepository
    participant OSIndex as OpenSearch

    UC ->> Repo: save(profile, events)
    Repo ->> DB: BEGIN $transaction
    Repo ->> DB: UPSERT user_profiles
    Repo ->> DB: INSERT outbox_events (status=PENDING)
    Repo ->> DB: COMMIT
    Note over Repo,DB: escrita de negócio e evento de integração\nsão atômicas — ou as duas ou nenhuma (ADR-001)

    loop a cada 10s
        Poller ->> DB: findPending(limit=50)
        DB -->> Poller: OutboxEventRecord[]
        loop para cada evento pendente
            Poller ->> SNS: publish(event)
            SNS ->> Topic: PublishCommand\nMessageGroupId=aggregateId\nMessageDeduplicationId=aggregateId:version:type
            alt publish ok
                Poller ->> DB: markPublished(id, now)
            else falha
                Poller ->> DB: markFailed(id) → tentado de novo no próximo ciclo
            end
        end
    end

    Topic ->> Queue: fan-out (preserva ordem por aggregateId — FIFO)

    loop pollLoop() enquanto running
        Consumer ->> Queue: ReceiveMessage (long-poll 5s, até 10 msgs)
        Queue -->> Consumer: Message[]
        loop para cada mensagem
            Consumer ->> Consumer: parseMessage(Body) → {aggregateId, type, version, payload}
            Consumer ->> Idx: handleMessage(msg)
            alt type == PROFILE_CREATED | PROFILE_UPDATED
                Idx ->> OS: upsertVersionAware(id, version, payload)
                OS ->> OSIndex: scripted_upsert (painless script)
                Note over OS,OSIndex: só sobrescreve se\nparams.doc.version > ctx._source.version\n(ADR-003 — protege contra entrega fora de ordem)
            else type == PROFILE_DELETED
                Idx ->> OS: delete(id)
                OS ->> OSIndex: DELETE (idempotente — ignora erro se já ausente)
            end
            Consumer ->> Queue: DeleteMessage
        end
    end
```

**Por quê Transactional Outbox em vez de publicar no SNS diretamente dentro do use case (dual
write)?**
Se o use case escrevesse no Postgres e chamasse `sns.publish()` como duas operações
independentes, uma falha entre elas (crash do processo, timeout de rede) deixaria o Postgres
atualizado mas o índice de busca **eternamente** desatualizado, sem qualquer sinal de erro. O
outbox transforma a publicação em um efeito colateral de uma linha já commitada — o poller só
publica o que sabe ter sido persistido com sucesso, e reitera (`FAILED` → tentado de novo) até
conseguir (ADR-001).

**Por quê SNS FIFO (`MessageGroupId=aggregateId`) em vez de um tópico standard?**
Um mesmo perfil pode ser criado e imediatamente atualizado; sem ordem garantida, o SQS poderia
entregar o evento de update antes do de create, ou entregar updates fora de ordem. O
`MessageGroupId=aggregateId` garante ordenação **por perfil** (perfis diferentes continuam
paralelos entre si), e `MessageDeduplicationId=aggregateId:version:type` faz o SNS descartar
publicações duplicadas do mesmo evento.

**Por quê o script de upsert do OpenSearch (`upsertVersionAware`) ainda compara versão, se o SNS
já é FIFO?**
Defesa em profundidade: FIFO garante ordem *dentro do SNS/SQS*, mas o consumidor pode reprocessar
uma mensagen antiga após um restart, um redrive de DLQ, ou uma race entre múltiplos workers. A
comparação `params.doc.version > ctx._source.version` no script Painless torna a indexação
**idempotente e comutativa** — não importa a ordem física de chegada no OpenSearch, o resultado
final converge para o estado da versão mais alta já vista (ADR-003).

---

## 6. Diagrama de sequência — leituras (consistência forte vs. eventual)

```mermaid
sequenceDiagram
    autonumber
    participant C as Cliente
    participant R as ProfileResolver
    participant UCGet as GetProfileByIdUseCase
    participant UCSearch as SearchProfilesUseCase
    participant Repo as PrismaUserProfileRepository
    participant DB as PostgreSQL
    participant SearchRepo as OpenSearchProfileRepository
    participant OS as OpenSearch

    C ->> R: query profile(id)
    R ->> UCGet: execute(id)
    UCGet ->> Repo: findById(id)
    Repo ->> DB: SELECT (fonte de verdade)
    alt não encontrado ou soft-deleted
        DB -->> UCGet: null / isDeleted()==true
        UCGet -->> R: throw ProfileNotFoundError
        R -->> C: null (tratado no resolver, não propaga erro)
    else encontrado e ativo
        DB -->> UCGet: UserProfile
        R -->> C: ProfileType
    end

    C ->> R: query searchProfiles(query, status, limit, offset)
    R ->> UCSearch: execute(input)
    UCSearch ->> UCSearch: clamp(limit, 1, 100) e clamp(offset, 0, ∞)
    UCSearch ->> SearchRepo: search({query, status, limit, offset})
    SearchRepo ->> OS: multi_match (displayName, username) + filtros
    OS -->> SearchRepo: hits + total
    SearchRepo -->> R: ProfileSearchResult
    R -->> C: ProfileSearchResultType\n(pode estar até ~10s desatualizado)
```

**Por quê `profile(id)` lê do Postgres e `searchProfiles` lê do OpenSearch — CQRS?**
São necessidades de leitura fundamentalmente diferentes: busca por id precisa de consistência
forte (acabou de criar, tem que aparecer imediatamente — ex.: o próprio fluxo de
`createProfile`→`updateProfile` do Postman depende disso) enquanto busca textual precisa de um
motor de full-text que o Postgres não oferece nativamente com a mesma qualidade. Separar os
modelos de leitura evita o pior dos dois mundos (usar Postgres para busca textual pobre, ou
esperar o OpenSearch de cada leitura por id) (ADR-002).

**Por quê o limite de `searchProfiles` é clampado (`1..100`) em vez de aceitar qualquer valor?**
Hardening contra exaustão de recursos: sem teto, um cliente (malicioso ou não) poderia pedir
`limit=1000000` e forçar uma consulta cara no OpenSearch. O clamp é aplicado na camada de
aplicação (`SearchProfilesUseCase`), não no resolver, para valer também se um outro transporte
futuro chamar o mesmo use case diretamente.

---

## 7. Diagrama de estados — ciclo de vida de `UserProfile`

```mermaid
stateDiagram-v2
    [*] --> ACTIVE: create() — version=1\nProfileCreatedEvent
    ACTIVE --> ACTIVE: update() — version+=1\nProfileUpdatedEvent\n[guarda: version==expectedVersion]
    ACTIVE --> SUSPENDED: update({status: SUSPENDED})
    SUSPENDED --> ACTIVE: update({status: ACTIVE})
    ACTIVE --> INACTIVE: delete() — version+=1\nProfileDeletedEvent\ndeleted=true (soft)
    SUSPENDED --> INACTIVE: delete()
    INACTIVE --> [*]: estado terminal\n(update()/delete() lançam\nProfileAlreadyDeletedError)

    note right of INACTIVE
        Linha NUNCA é apagada fisicamente
        (auditoria). username/email são
        reescritos para valores sintéticos
        (del_UUID / deleted+ID@released.invalid)
        para liberar o username/email
        original para reuso imediato.
    end note
```

**Por quê `INACTIVE` é terminal (não existe "reativar" um perfil deletado)?**
Semântica de soft-delete como operação irreversível pela API pública — uma vez deletado, um novo
perfil com o mesmo username é uma **nova** identidade (novo `id`, nova linha), não uma
reativação da antiga. Isso mantém o modelo de eventos simples: `ProfileDeletedEvent` é sempre o
último evento de um agregado.

**Por quê reescrever `username`/`email` em vez de deixá-los como estavam?**
Ambas as colunas têm constraint `unique` no Postgres. Um soft-delete que preservasse os valores
originais bloquearia permanentemente aquele username para qualquer outra pessoa — mesmo o próprio
dono não conseguiria "recriar" o perfil com o mesmo nome. `toPersistedUsername()`/
`toPersistedEmail()` (em `profile.mapper.ts`) resolvem isso reescrevendo para um valor sintético
não colidente só na hora de persistir (a entidade de domínio em memória mantém os valores
originais — a reescrita é uma preocupação de infraestrutura/persistência, não do domínio).
`existsByUsername()`/`existsByEmail()` filtram `status != INACTIVE`, então a checagem de conflito
do `CreateProfileUseCase` nunca "vê" as linhas soft-deletadas.

---

## 8. Diagrama de estados — `OutboxEvent`

```mermaid
stateDiagram-v2
    [*] --> PENDING: INSERT na mesma transação do UPSERT de domínio
    PENDING --> PUBLISHED: OutboxPollerService.publish() ok\nmarkPublished(id, now)
    PENDING --> FAILED: publish() lança exceção\nmarkFailed(id)
    FAILED --> PENDING: nada muda o status automaticamente\n— é retomado no próximo\nfindPending() se ainda\nfor retornado como pendente
    PUBLISHED --> [*]
```

**Nota sobre `FAILED`:** no código atual, `markFailed` grava `status=FAILED`, mas
`findPending()` só seleciona `status=PENDING` — ou seja, um evento marcado `FAILED` **não** é
automaticamente reprocessado pelo poller no estado atual da implementação; fica retido para
inspeção/republicação manual. Isso é uma escolha conservadora: preferir um evento "preso" e visível
a reprocessá-lo indefinidamente sem limite de tentativas (o que arriscaria um hot-loop de
publish se a falha for persistente, ex.: `SNS_TOPIC_ARN` mal configurado).

---

## 9. Diagrama de atividades — `JwtAuthGuard.canActivate()`

```mermaid
flowchart TD
    START(["canActivate(context)"]) --> CTX["req = GqlExecutionContext.create(context).getContext().req"]
    CTX --> HDR["token = extractBearerToken(req.headers.authorization)"]
    HDR --> D1{"token existe?"}
    D1 -->|não| E1["throw UnauthorizedException\n'Missing bearer token'"]
    D1 -->|sim| VERIFY["jwtService.verifyAsync(token)"]
    VERIFY --> D2{"assinatura/expiração válidas?"}
    D2 -->|não| E2["throw UnauthorizedException\n'Invalid or expired token'"]
    D2 -->|sim| SET["req.user = {sub: payload.sub}"]
    SET --> OK(["return true"])
    E1 --> FILTER["DomainExceptionFilter\nnão intercepta —\nUnauthorizedException nativa\ndo Nest vira 401 UNAUTHENTICATED"]
    E2 --> FILTER

    style E1 fill:#ffebee
    style E2 fill:#ffebee
    style OK fill:#e8f5e9
```

**Por quê um `JwtAuthGuard` próprio em vez de `@nestjs/passport` + `passport-jwt`?**
KISS: a necessidade é estritamente "verificar assinatura/validade do token e extrair `sub`" — não
há múltiplas estratégias de autenticação (OAuth, local, etc.) que justifiquem a indireção do
Passport (`Strategy`, `AuthGuard('jwt')`, serialização de sessão). Um `CanActivate` de ~30 linhas
usando `JwtService.verifyAsync` diretamente é mais fácil de auditar e testar unitariamente do que
uma estratégia Passport equivalente, sem perder nenhuma garantia de segurança.

---

## 10. Tabela-resumo de decisões de design ("porquês") e ADRs relacionadas

| Decisão | Alternativa descartada | Motivo | ADR |
|---|---|---|---|
| Transactional Outbox para propagar eventos | Dual-write direto (Postgres + SNS) | Falha parcial deixaria o índice de busca desatualizado silenciosamente | [ADR-001](./adr/ADR-001-transactional-outbox.md) |
| CQRS: Postgres (escrita) / OpenSearch (leitura textual) | Um único banco para tudo | Necessidades de consistência e de capacidade de busca são diferentes | [ADR-002](./adr/ADR-002-cqrs-postgres-opensearch.md) |
| Indexação idempotente e version-aware (script Painless) | Confiar cegamente na ordem do SNS FIFO | SQS pode redriver/reprocessar; convergência precisa ser garantida na ponta | [ADR-003](./adr/ADR-003-idempotent-indexing.md) |
| Prisma como ORM de escrita | TypeORM (como no cyberalert) | Ver justificativa específica na ADR | [ADR-004](./adr/ADR-004-prisma-write-orm.md) |
| GraphQL code-first | Schema-first (SDL manual) | Contrato gerado a partir do código, revisável, sem duplicação de definição | [ADR-005](./adr/ADR-005-graphql-sdl-contract.md) |
| JWT + autorização por ownership (`sub == id` do alvo) | Sem autenticação / RBAC completo com serviço externo | Fecha o IDOR em `update`/`delete` sem exigir um provedor de identidade separado | [ADR-006](./adr/ADR-006-jwt-ownership-authorization.md) |
| Lock otimista via campo `version` | Lock pessimista (`SELECT FOR UPDATE`) | Não amarra conexões de pool durante o ciclo de vida de uma mutation GraphQL | — |
| Soft-delete com reescrita de username/email | Hard delete, ou soft-delete sem reescrita | Preserva auditoria E libera o username/email para reuso imediato | — |
| Checagem de ownership no resolver, antes do use case | Checagem dentro do use case | Mantém o domínio livre de "usuário autenticado"; fail-fast antes de tocar o banco | — |
| `JwtAuthGuard` próprio em vez de Passport | `@nestjs/passport` + `passport-jwt` | KISS — uma única estratégia de auth não justifica a indireção do Passport | — |

---

## 11. Referências de código

| Diagrama | Arquivos-fonte |
|---|---|
| Componentes / camadas | `src/profile.module.ts`, `src/profile.tokens.ts` |
| Classes — domínio | `src/domain/entities/user-profile.entity.ts`, `src/domain/value-objects/*.vo.ts`, `src/domain/events/profile.events.ts`, `src/domain/errors/domain.errors.ts`, `src/domain/ports/repositories.port.ts` |
| Classes — aplicação | `src/application/use-cases/*.use-case.ts`, `src/application/ports/application.port.ts` |
| Sequência — createProfile | `src/presentation/graphql/profile.resolver.ts`, `src/application/use-cases/create-profile.use-case.ts`, `src/infrastructure/auth/jwt-token.issuer.ts` |
| Sequência — update/delete + auth | `src/presentation/graphql/jwt-auth.guard.ts`, `src/presentation/graphql/current-user.decorator.ts`, `src/presentation/graphql/profile.resolver.ts`, `src/presentation/graphql/domain-exception.filter.ts` |
| Sequência — outbox → SNS → SQS → OpenSearch | `src/infrastructure/persistence/prisma-user-profile.repository.ts`, `src/infrastructure/messaging/outbox-poller.service.ts`, `src/infrastructure/messaging/sns-event.publisher.ts`, `src/infrastructure/messaging/sqs-profile-index.consumer.service.ts`, `src/infrastructure/messaging/profile-index.consumer.ts`, `src/infrastructure/search/opensearch-profile.repository.ts` |
| Estados — UserProfile / soft-delete | `src/domain/entities/user-profile.entity.ts`, `src/infrastructure/persistence/profile.mapper.ts` |
| Estados — OutboxEvent | `prisma/schema.prisma`, `src/infrastructure/messaging/outbox-poller.service.ts` |
| Atividades — JwtAuthGuard | `src/presentation/graphql/jwt-auth.guard.ts` |

Ver também: [`docs/adr/`](./adr/) (decisões formais), [`docs/ARCHITECTURE.md`](./ARCHITECTURE.md) (se aplicável), [`../../microservice-cyberalert/docs/TECHNICAL_OVERVIEW.md`](../../microservice-cyberalert/docs/TECHNICAL_OVERVIEW.md) (visão cruzada dos dois serviços) e [`../HOW_TO_RUN.md`](../HOW_TO_RUN.md) (como subir o serviço para testar no Postman).
