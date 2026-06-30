# temasAtendimento e numeroVisita — Fluxo e Armazenamento Duplo

## Visão Geral

`temas_atendimento` e `numero_relatorio`/`numeroVisita` são dois campos especiais do ciclo de vida do Relatório com comportamento diferente dos demais: eles precisam ser gravados em dois sistemas — o **banco de dados local (Prisma/PostgreSQL)** e o **servidor externo (GraphQL + REST API legada)**.

> **Importante:** `temas_atendimento` NÃO é coluna no Prisma/Postgres. Existe apenas no servidor externo (via `at_atendimento_indi_camp_acess`). `numeroRelatorio` SIM existe no Prisma (`numero_relatorio`) E no servidor externo.

---

## Entidades e Arquivos Envolvidos

| Camada | Arquivo | Papel |
|---|---|---|
| Domain | [src/modules/atendimento/entities/atendimento.entity.ts](../../src/modules/atendimento/entities/atendimento.entity.ts) | Converte temas e número para o formato do servidor externo |
| Service | [src/modules/atendimento/atendimento.service.ts](../../src/modules/atendimento/atendimento.service.ts) | `updateTemasAndVisita()` — normaliza e despacha para a REST API |
| Service | [src/modules/relatorios/relatorios.service.ts](../../src/modules/relatorios/relatorios.service.ts) | `syncAtendimentoTemasAndNumero()` — chama `updateTemasAndVisita` no update |
| External | [src/@rest-api-server/rest-api.service.ts](../../src/@rest-api-server/rest-api.service.ts) | `updateTemasAndVisitaAtendimento()` — PATCH no servidor legado |
| External | [src/@graphQL-server/atendimento-api.service.ts](../../src/@graphQL-server/atendimento-api.service.ts) | `createAtendimento()` — insere no GraphQL server na criação |
| DTO | [src/modules/atendimento/dto/create-atendimento.dto.ts](../../src/modules/atendimento/dto/create-atendimento.dto.ts) | `temas_atendimento?: string[]`, `numero_relatorio?: string` |
| DTO | [src/modules/atendimento/dto/update-temas-and-visita-atendimento.dto.ts](../../src/modules/atendimento/dto/update-temas-and-visita-atendimento.dto.ts) | `temasAtendimento?: string`, `numeroVisita?: string` |
| DTO | [src/modules/relatorios/dto/update-relatorio.dto.ts](../../src/modules/relatorios/dto/update-relatorio.dto.ts) | `temas_atendimento?: string` (accept no PATCH do relatorio) |

---

## Codificação de `temas_atendimento`

O servidor externo não aceita os labels em texto. A lista `['Agroindústria', 'Culturas', 'Pecuária']` é convertida para códigos numéricos separados por ponto-e-vírgula:

| Label | Código |
|---|---|
| Agroindústria | `1` |
| Culturas | `2` |
| Pecuária | `3` |

Exemplos: `['Culturas', 'Pecuária']` → `"2;3"` | `['Agroindústria']` → `"1"`

Essa conversão acontece em dois lugares:
- **Criação:** `Atendimento.createTemasAtendimentoDTO()` (instância, chamada em `Atendimento.create()`)
- **Atualização:** `Atendimento.temasAtendimentoListToDTO(string)` (estático, chamado em `AtendimentoService.updateTemasAndVisita()`)

---

## Fluxo de Criação (POST /relatorios)

O mobile (e o web interface) seguem o mesmo fluxo de **duas chamadas em sequência**:

```
1. POST /atendimento   { id_usuario, id_pessoa_demeter, id_pl_propriedade, id_und_empresa,
                          link_pdf, numero_relatorio?, temas_atendimento?: string[] }
   → backend constrói Atendimento.create(input)
   → at_atendimento_indi_camp_acess:
       - id_at_indicador_camp_acessorio: '14032'  → valor = numero_relatorio
       - id_at_indicador_camp_acessorio: '14033'  → valor = temasAtendimentoDTO (ex. "1;2")
   → graphQLAPI.createAtendimento(...)  (grava no servidor externo)
   ← retorna atendimentoId (string)

2. POST /relatorios  (multipart FormData)  { ...relatorio, atendimentoId }
   → grava no Prisma/Postgres (incluindo numeroRelatorio)
   → NÃO processa temas aqui — temas já foram para o servidor externo no passo 1
```

`temas_atendimento` não é enviado ao `POST /relatorios`. Não tem coluna Prisma.

---

## Fluxo de Atualização (PATCH /relatorios/:id)

Uma única chamada multipart FormData que carrega `temas_atendimento` como string opcional:

```
PATCH /relatorios/:id  { numeroRelatorio?, temas_atendimento?, ...outros campos }
```

O `RelatorioService.update()` faz **duas coisas em sequência**:

```
1. prismaService.relatorio.update(...)
   → grava no Postgres apenas os campos do modelo Prisma (sem temas)
   → atualiza numeroRelatorio se fornecido

2. syncAtendimentoTemasAndNumero({ atendimentoId, temasAtendimento, numeroVisita, oldRelatorioNumber })
   → shouldUpdateNumero = (numeroVisita !== oldRelatorioNumber)
   → shouldUpdateTemas  = (temasAtendimento tem itens)
   → se algum dos dois for verdadeiro:
       atendimentoService.updateTemasAndVisita(...)
       → normaliza temas (array ou string comma-separated → "1;2" via temasAtendimentoListToDTO)
       → restAPI.updateTemasAndVisitaAtendimento(atendimentoId, { temasAtendimento, numeroVisita })
           → PATCH /api/updateTemasAndVisitaAtendimento/{atendimentoId}  (REST API legada)
```

Condições de guarda:
- `syncAtendimentoTemasAndNumero` retorna cedo se `!atendimentoId`.
- `temasAtendimento` vazio/ausente → `shouldUpdateTemas = false` → temas não são alterados no externo.
- `numeroVisita === oldRelatorioNumber` → `shouldUpdateNumero = false` → número não é reenviado.

---

## Comportamento do Mobile

O mobile separa `temas_atendimento` do restante do relatorio antes de enviar:

```typescript
// useManageRelatorios.ts — saveRelatorio()
const { temas_atendimento, ...relatorioData } = relatorioInput;

const atendimento: AtendimentoModel = {
  ...campos do produtor/usuário...
  numero_relatorio: String(relatorioModel.numeroRelatorio),
  temas_atendimento,   // vai só para /atendimento
};

// Sequência:
atendimentoId = await RelatorioService.createRelatorio(relatorioModel, atendimento);
```

No **update**, o mobile não reenvia `temas_atendimento` — só as demais props que mudaram.

---

## Comportamento do Web Interface (estado atual)

- **Criação:** `buildAtendimentoPayload()` já envia `numero_relatorio`. **Não envia `temas_atendimento`** (nenhuma UI nem estado para isso ainda).
- **Edição:** `parseRelatorioUpdate()` em `useEditRelatorioMultipart.ts` tem allowlist de campos. `temas_atendimento` **não está na allowlist** ainda.
- **Fetch:** `GET /relatorios/:id` não retorna `temas_atendimento` (não é coluna Prisma). Não é possível pre-popular o campo na edição sem buscar o atendimento externo separadamente.

---

## Resumo Rápido

| Campo | Prisma (local) | Servidor externo |
|---|---|---|
| `numeroRelatorio` | ✅ coluna `numero_relatorio` | ✅ `id_at_indicador_camp_acessorio: '14032'` |
| `temas_atendimento` | ❌ não existe | ✅ `id_at_indicador_camp_acessorio: '14033'` (codificado) |

| Operação | Quem persiste numero? | Quem persiste temas? |
|---|---|---|
| Criar relatorio | `POST /relatorios` (Prisma) + `POST /atendimento` (externo) | `POST /atendimento` (externo) |
| Editar relatorio | `PATCH /relatorios/:id` (Prisma) + REST API se mudou | REST API se fornecido |
