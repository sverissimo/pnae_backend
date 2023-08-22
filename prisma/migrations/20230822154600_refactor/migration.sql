/*
  Warnings:

  - You are about to drop the `Atividade` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `DadosProducao` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Perfil` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PictureFile` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Produtor` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Propriedade` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Relatorio` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Usuario` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Atividade" DROP CONSTRAINT "Atividade_id_perfil_see_fkey";

-- DropForeignKey
ALTER TABLE "Perfil" DROP CONSTRAINT "Perfil_id_cliente_fkey";

-- DropForeignKey
ALTER TABLE "Perfil" DROP CONSTRAINT "Perfil_id_dados_producao_agro_industria_fkey";

-- DropForeignKey
ALTER TABLE "PictureFile" DROP CONSTRAINT "PictureFile_relatorio_id_fkey";

-- DropForeignKey
ALTER TABLE "Propriedade" DROP CONSTRAINT "Propriedade_produtor_id_fkey";

-- DropForeignKey
ALTER TABLE "Relatorio" DROP CONSTRAINT "Relatorio_produtor_id_fkey";

-- DropTable
DROP TABLE "Atividade";

-- DropTable
DROP TABLE "DadosProducao";

-- DropTable
DROP TABLE "Perfil";

-- DropTable
DROP TABLE "PictureFile";

-- DropTable
DROP TABLE "Produtor";

-- DropTable
DROP TABLE "Propriedade";

-- DropTable
DROP TABLE "Relatorio";

-- DropTable
DROP TABLE "Usuario";

-- CreateTable
CREATE TABLE "produtor" (
    "id_pessoa_demeter" BIGINT NOT NULL,
    "nm_pessoa" TEXT NOT NULL,
    "nr_cpf_cnpj" TEXT NOT NULL,
    "tp_pessoa" "TipoPessoa" NOT NULL,
    "tp_sexo" "TipoSexo",
    "dt_nascimento" TEXT,
    "sn_ativo" INTEGER NOT NULL,
    "caf" TEXT,
    "dap" TEXT,
    "id_municipio" INTEGER,

    CONSTRAINT "produtor_pkey" PRIMARY KEY ("id_pessoa_demeter")
);

-- CreateTable
CREATE TABLE "propriedade" (
    "id" INTEGER NOT NULL,
    "produtor_id" BIGINT NOT NULL,
    "nome_propriedade" TEXT NOT NULL,
    "geo_ponto_texto" TEXT,
    "area_total" TEXT,
    "id_municipio" INTEGER,

    CONSTRAINT "propriedade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relatorio" (
    "id" SERIAL NOT NULL,
    "produtor_id" BIGINT NOT NULL,
    "tecnico_id" BIGINT NOT NULL,
    "numero_relatorio" INTEGER NOT NULL,
    "assunto" TEXT NOT NULL,
    "orientacao" TEXT NOT NULL,
    "pictureURI" TEXT,
    "assinaturaURI" TEXT,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3),

    CONSTRAINT "relatorio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arquivos" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "description" "PictureDescription" NOT NULL,
    "relatorio_id" INTEGER NOT NULL,
    "upload_date" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "arquivos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario" (
    "id_usuario" BIGSERIAL NOT NULL,
    "login_usuario" VARCHAR(255) NOT NULL,
    "nome_usuario" VARCHAR(255),
    "email_usuario" VARCHAR(255),
    "celular_usuario" VARCHAR(255),
    "cpf_usuario" VARCHAR(14),
    "matricula_usuario" CHAR(5),
    "digito_matricula" CHAR(1),
    "id_und_empresa" CHAR(5),
    "id_cargo" CHAR(4),
    "sexo_usuario" CHAR(1),

    CONSTRAINT "pk_usuario" PRIMARY KEY ("id_usuario")
);

-- CreateTable
CREATE TABLE "perfil" (
    "id" SERIAL NOT NULL,
    "tipo_perfil" TEXT NOT NULL,
    "id_tecnico" INTEGER NOT NULL,
    "id_cliente" BIGINT NOT NULL,
    "data_preenchimento" TIMESTAMP(3) NOT NULL,
    "data_atualizacao" TIMESTAMP(3) NOT NULL,
    "participa_organizacao" BOOLEAN NOT NULL,
    "id_dados_producao_in_natura" INTEGER,
    "nivel_tecnologico_cultivo" INTEGER,
    "sistema_producao" INTEGER,
    "condicao_posse" INTEGER,
    "dap_caf_vigente" BOOLEAN,
    "credito_rural" BOOLEAN,
    "fonte_captacao_agua" INTEGER,
    "forma_esgotamento_sanitario" INTEGER,
    "possui_cadastro_car" BOOLEAN,
    "aderiu_pra" BOOLEAN,
    "ciente_iniciativas_regularizacao_pra" BOOLEAN,
    "realiza_escalonamento_producao" BOOLEAN,
    "procedimento_pos_colheita" INTEGER,
    "tipo_gestao_unidade" TEXT,
    "pessoas_processamento_alimentos" INTEGER,
    "tipo_estabelecimento" TEXT,
    "tipo_pessoa_juridica" TEXT,
    "agroindustria_precisa_adaptacao_reforma" BOOLEAN,
    "possui_registro_orgao_fiscalizacao_sanitaria" BOOLEAN,
    "orgao_fiscalizacao_sanitaria" TEXT,
    "atividades_usam_recursos_hidricos" INTEGER,
    "atividades_com_regularizacao_ambiental" INTEGER,
    "possui_agroindustria_propria" BOOLEAN,
    "grau_interesse_pnae" TEXT NOT NULL,
    "id_dados_producao_agro_industria" INTEGER,

    CONSTRAINT "perfil_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dados_producao" (
    "id" INTEGER NOT NULL,
    "controla_custos_producao" BOOLEAN NOT NULL,
    "dificuldade_fornecimento" INTEGER NOT NULL,
    "forma_entrega_produtos" INTEGER NOT NULL,
    "informacoes_adicionais" TEXT,
    "local_comercializacao" INTEGER NOT NULL,
    "tipo_regularizacao_ambiental" TEXT NOT NULL,
    "tipo_regularizacao_uso_recursos_hidricos" TEXT NOT NULL,
    "valor_total_obtido_outros" INTEGER NOT NULL,
    "valor_total_obtido_pnae" INTEGER NOT NULL,

    CONSTRAINT "dados_producao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "atividade" (
    "id" INTEGER NOT NULL,
    "id_perfil_see" INTEGER NOT NULL,
    "id_propriedade" INTEGER NOT NULL,
    "atividade" TEXT NOT NULL,
    "producao_dedicada_pnae" BOOLEAN,

    CONSTRAINT "atividade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "produtor_nr_cpf_cnpj_key" ON "produtor"("nr_cpf_cnpj");

-- CreateIndex
CREATE UNIQUE INDEX "uq_usuario_login" ON "usuario"("login_usuario");

-- CreateIndex
CREATE UNIQUE INDEX "perfil_id_dados_producao_agro_industria_key" ON "perfil"("id_dados_producao_agro_industria");

-- CreateIndex
CREATE UNIQUE INDEX "atividade_id_perfil_see_key" ON "atividade"("id_perfil_see");

-- CreateIndex
CREATE UNIQUE INDEX "atividade_id_propriedade_key" ON "atividade"("id_propriedade");

-- AddForeignKey
ALTER TABLE "propriedade" ADD CONSTRAINT "propriedade_produtor_id_fkey" FOREIGN KEY ("produtor_id") REFERENCES "produtor"("id_pessoa_demeter") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relatorio" ADD CONSTRAINT "relatorio_produtor_id_fkey" FOREIGN KEY ("produtor_id") REFERENCES "produtor"("id_pessoa_demeter") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "arquivos" ADD CONSTRAINT "arquivos_relatorio_id_fkey" FOREIGN KEY ("relatorio_id") REFERENCES "relatorio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "perfil" ADD CONSTRAINT "perfil_id_cliente_fkey" FOREIGN KEY ("id_cliente") REFERENCES "produtor"("id_pessoa_demeter") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "perfil" ADD CONSTRAINT "perfil_id_dados_producao_agro_industria_fkey" FOREIGN KEY ("id_dados_producao_agro_industria") REFERENCES "dados_producao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "atividade" ADD CONSTRAINT "atividade_id_perfil_see_fkey" FOREIGN KEY ("id_perfil_see") REFERENCES "perfil"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
