# Fluxo de Sincronização de Relatórios (getRelatorioSyncData)

Este documento explica, passo a passo e em linguagem clara, como funciona o fluxo de sincronização de relatórios no backend. O objetivo é que qualquer pessoa nova no projeto entenda rapidamente o que acontece quando o cliente pede para verificar/atualizar relatórios.

A função principal é `SyncService.getRelatorioSyncData`, localizada em `src/modules/@sync/sync.service.ts`. Ela orquestra a lógica de comparação entre o que o cliente tem e o que o servidor possui, e também faz uma verificação do sistema de arquivos (FS) para ver se as imagens/arquivos referenciados existem fisicamente.

---

## Visão Geral

- Entrada (do cliente): uma lista de itens com `{ id, updatedAt, assinaturaURI?, pictureURI? }`, chamada de `relatoriosSyncInfo`.
- Dados do servidor: registros completos do Prisma/DB (`RelatorioModel`).
- Saída (para o cliente): um conjunto de "baldes" (buckets) com ações:
  - `missingIdsOnServer`: IDs que o cliente possui, mas o servidor não.
  - `missingOnClient`: registros que o servidor tem e o cliente não.
  - `outdatedOnServer`: patches que o servidor precisa receber do cliente (cliente está mais novo/tem algo que o servidor precisa).
  - `outdatedOnClient`: registros que o cliente deve atualizar a partir do servidor (servidor está mais novo).
  - `upToDateIds`: IDs que não precisam de nenhuma ação.

Observação importante: o campo `updatedAt` é tratado como "atualização do registro como um todo" (não há versionamento por campo). A sincronização de URIs (assinatura/picture) é feita com regras específicas para evitar sobreescritas indesejadas.

---

## Fluxo Passo a Passo

### 1) Coleta de dados do servidor

Arquivo: `SyncService.getRelatorioSyncData`

- Extrai `ids` dos objetos enviados pelo cliente (`relatoriosSyncInfo`).
- Chama `RelatorioService.findMany({ ids, produtorIds })` para obter os relatórios existentes no servidor.

Resultado: `existingRelatorios` (lista de registros do servidor).

### 2) Diferença lógico-semântica (sem FS)

Arquivo: `RelatorioDomainService.getSyncInfo`

Responsabilidades:

- Classificar cada ID nos buckets acima com base em presença e `updatedAt`.
- Gerar patches mínimos de URIs quando necessário (evitando enviar campos que não mudaram).
- Não sabe nada sobre arquivos faltantes no disco: é puramente "lógico".

Regras principais:

- Cliente mais novo que servidor (server newer):
  - O servidor envia o objeto para o cliente via `outdatedOnClient`.
  - URIs idênticas ao cliente são removidas do payload (para não forçar regravação desnecessária). URIs diferentes são mantidas, pois o cliente deve atualizar as suas cópias.
- Cliente mais novo que servidor (client newer):
  - O cliente envia um patch mínimo ao servidor via `outdatedOnServer`.
  - Apenas URIs que efetivamente mudaram entram no patch; se nada mudou de URIs (apenas texto), vai apenas `{ id }`.
- Datas iguais (equal timestamps):
  - Regra de "gap fill" (preencher faltas):
    - Se o servidor está sem uma URI que o cliente tem → adiciona patch para o servidor (`outdatedOnServer`).
    - Se o cliente está sem uma URI que o servidor tem → adiciona patch para o cliente (`outdatedOnClient`).
    - Se ambos têm URIs não vazias mas diferentes → ignora (nenhuma ação), para evitar conflito sem critério temporal.
- Presença/ausência:
  - Se o cliente tem IDs que o servidor não tem → `missingIdsOnServer`.
  - Se o servidor tem registros que o cliente não tem → `missingOnClient` (registros completos).

Normalização de datas:

- O servidor normaliza `updatedAt` para UTC (ex.: convertendo timezone BR para UTC). O cliente é comparado contra o valor normalizado do servidor.

Saída desta etapa: `updateInfoOutput` com os 5 buckets.

### 3) Verificação de arquivos no sistema (FS)

Arquivo: `SyncService.checkForMissingFiles`

Responsabilidade:

- A partir dos URIs enviados na entrada do cliente, gerar um conjunto único de IDs de arquivos.
- Perguntar ao `FileService.findMissingFiles` quais URIs não possuem o arquivo físico.
- Produzir uma lista de relatórios do cliente anotados com um campo auxiliar `_missingFiles: { assinaturaURI?, pictureURI? }` indicando quais URIs estão faltando no FS.

Saída: `relatoriosWithFileStatus` (a mesma lista do cliente, com o campo `_missingFiles`).

### 4) Sobreposição de faltas físicas (overlay de FS)

Arquivo: `SyncService.injectMissingURIsToUpdateInfo`

Responsabilidade:

- Usar `updateInfoOutput` (etapa 2) e enriquecer `outdatedOnServer` com pedidos de upload apenas quando fizer sentido, de acordo com as regras de frescor e integridade.
- Não sobreescrever decisões lógicas da etapa 2. Apenas solicitar uploads que fazem falta no FS.

Regras por campo (assinaturaURI, pictureURI):

- Se o servidor é mais novo (server newer) E a URI do servidor é diferente da URI do cliente → NÃO solicitar upload do cliente para esse campo (evitar sobreescrever o servidor com algo mais antigo).
- Se o servidor é mais novo E as URIs são iguais E o arquivo está faltando no FS → solicitar upload ao cliente (o servidor precisa do arquivo físico).
- Se as datas são iguais OU o cliente é mais novo E o arquivo está faltando no FS → solicitar upload ao cliente.
- Se já existe uma entrada para o mesmo `id` em `outdatedOnServer`, mesclar somente os campos permitidos (e remover os campos que agora se tornaram proibidos por conta das regras acima).

Resultado final: `updateInfoOutput` atualizado com os pedidos de upload faltantes no FS, sem nunca pedir para o cliente sobrescrever uma URI mais nova do servidor.

---

## Exemplos de Caminhos (Branches)

1. Server newer e URIs diferentes:
   - Bucket: `outdatedOnClient` recebe o objeto do servidor (URIs diferentes permanecem para o cliente atualizar sua cópia).
   - FS overlay: se algum arquivo estiver faltando, NÃO pedimos upload do cliente para esse campo específico (evita sobrescrever o servidor).

2. Server newer e URIs iguais, mas arquivo faltando no FS:
   - Bucket: `outdatedOnClient` recebe o objeto do servidor (URIs iguais podem ser removidas).
   - FS overlay: solicitar upload ao cliente apenas para os URIs faltantes (como são iguais, não há risco de sobrescrita indevida).

3. Client newer e URIs mudaram:
   - Bucket: `outdatedOnServer` recebe um patch mínimo contendo apenas os URIs alterados.
   - FS overlay: se os arquivos estiverem faltando no FS do servidor, o pedido de upload se mantém.

4. Datas iguais com lacunas (gap fill):
   - Se só um lado tiver uma URI, ela é copiada para o lado que está faltando (server → client ou client → server) via buckets apropriados.
   - Se ambos tiverem URIs diferentes (não faltantes), nenhuma ação.

5. Itens presentes apenas no cliente ou apenas no servidor:
   - Apenas cliente → `missingIdsOnServer` (o servidor não conhece esse ID).
   - Apenas servidor → `missingOnClient` (enviar registro completo para o cliente).

---

## Arquivos e Funções Envolvidas

- `src/modules/@sync/sync.service.ts`
  - `getRelatorioSyncData(input)`: Orquestra todo o fluxo (dados do servidor → diff → FS → overlay) e retorna os buckets finais.
  - `checkForMissingFiles(relatorios)`: Agrega URIs e pergunta ao `FileService` quais arquivos estão faltando fisicamente.
  - `injectMissingURIsToUpdateInfo({...})`: Sobrepõe pedidos de upload ao bucket `outdatedOnServer` somente quando seguro.

- `src/@domain/relatorio/relatorio-domain-service.ts`
  - `getSyncInfo(client, server)`: Diferença lógico-semântica (sem FS) e classificação em buckets.
  - `injectURIsIfNeeded(target, newer, older)`: Insere apenas URIs que realmente mudaram (patch mínimo para o servidor).
  - `stripUnchangedUris(serverRelatorio, clientRelatorio)`: Remove URIs idênticas no caminho server → client (não sobrescrever o cliente).
  - `reconcileUrisOnEqual(serverRelatorio, clientRelatorio)`: Em datas iguais, preenche somente lacunas (gap fill), ignorando divergências não vazias.

- `src/common/files/file.service.ts`
  - `findMissingFiles(uris: string[])`: Informa quais URIs não têm arquivo físico no servidor.

---

## Notas Importantes (Boas Práticas do Fluxo)

- Imutabilidade conceitual: o domínio decide a lógica e o serviço apenas complementa com faltas físicas; o serviço não contradiz o domínio.
- Patch mínimo: sempre que possível, enviar somente o que mudou. Evita upload/transferência desnecessários e reduz risco de conflitos.
- Segurança contra sobrescritas: quando o servidor for mais novo e tiver URIs diferentes, nunca pedir upload do cliente para esse campo.
- Datas inválidas/ausentes: quando qualquer lado não tem `updatedAt` válido, as regras caem para casos de presença/ausência e gap fill.

---

## TL;DR (Resumo Curto)

1. Busca no servidor os IDs recebidos.
2. Compara cliente × servidor (sem FS) e classifica em 5 buckets.
3. Checa o sistema de arquivos para ver URIs faltantes.
4. Sobrepõe pedidos de upload ao servidor apenas onde fizer sentido e com segurança (sem sobrescrever server mais novo).
5. Retorna buckets finais para o cliente saber exatamente o que enviar/atualizar.

---

Para dúvidas, ler os testes:

- `src/modules/@sync/sync.service.spec.ts`
- `src/@domain/relatorio/relatorio-domain-service.spec.ts`

Eles cobrem os casos de borda e ajudam a visualizar a intenção de cada regra.
