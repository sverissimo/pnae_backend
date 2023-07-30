-- CreateTable
CREATE TABLE "Perfil" (
    "id" SERIAL NOT NULL,
    "tipo_perfil" TEXT NOT NULL,
    "id_tecnico" INTEGER NOT NULL,
    "id_cliente" INTEGER NOT NULL,
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

    CONSTRAINT "Perfil_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DadosProducao" (
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

    CONSTRAINT "DadosProducao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Atividade" (
    "id" INTEGER NOT NULL,
    "id_perfil_see" INTEGER NOT NULL,
    "id_propriedade" INTEGER NOT NULL,
    "atividade" TEXT NOT NULL,
    "producao_dedicada_pnae" BOOLEAN,

    CONSTRAINT "Atividade_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Perfil_id_dados_producao_agro_industria_key" ON "Perfil"("id_dados_producao_agro_industria");

-- CreateIndex
CREATE UNIQUE INDEX "Atividade_id_perfil_see_key" ON "Atividade"("id_perfil_see");

-- CreateIndex
CREATE UNIQUE INDEX "Atividade_id_propriedade_key" ON "Atividade"("id_propriedade");

-- AddForeignKey
ALTER TABLE "Perfil" ADD CONSTRAINT "Perfil_id_cliente_fkey" FOREIGN KEY ("id_cliente") REFERENCES "Produtor"("id_pessoa_demeter") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Perfil" ADD CONSTRAINT "Perfil_id_dados_producao_agro_industria_fkey" FOREIGN KEY ("id_dados_producao_agro_industria") REFERENCES "DadosProducao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Atividade" ADD CONSTRAINT "Atividade_id_perfil_see_fkey" FOREIGN KEY ("id_perfil_see") REFERENCES "Perfil"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
