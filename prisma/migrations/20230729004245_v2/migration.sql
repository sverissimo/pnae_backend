-- CreateEnum
CREATE TYPE "TipoPessoa" AS ENUM ('F', 'J');

-- CreateEnum
CREATE TYPE "TipoSexo" AS ENUM ('F', 'M');

-- CreateEnum
CREATE TYPE "PictureDescription" AS ENUM ('FOTO_RELATORIO', 'ASSINATURA_PRODUTOR');

-- CreateEnum
CREATE TYPE "Sexo" AS ENUM ('MASCULINO', 'FEMININO', 'NAO_INFORMADO');

-- CreateTable
CREATE TABLE "Produtor" (
    "id_pessoa_demeter" INTEGER NOT NULL,
    "nm_pessoa" TEXT NOT NULL,
    "nr_cpf_cnpj" TEXT NOT NULL,
    "tp_pessoa" "TipoPessoa" NOT NULL,
    "tp_sexo" "TipoSexo",
    "dt_nascimento" TEXT,
    "sn_ativo" INTEGER NOT NULL,
    "caf" TEXT,
    "dap" TEXT,
    "id_municipio" INTEGER,

    CONSTRAINT "Produtor_pkey" PRIMARY KEY ("id_pessoa_demeter")
);

-- CreateTable
CREATE TABLE "Propriedade" (
    "id" INTEGER NOT NULL,
    "produtor_id" INTEGER NOT NULL,
    "nome_propriedade" TEXT NOT NULL,
    "geo_ponto_texto" TEXT,
    "area_total" TEXT,
    "id_municipio" INTEGER,

    CONSTRAINT "Propriedade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Relatorio" (
    "id" SERIAL NOT NULL,
    "nr_relatorio" INTEGER NOT NULL,
    "assunto" TEXT NOT NULL,
    "orientacao" TEXT NOT NULL,
    "produtor_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Relatorio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PictureFile" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "size" DOUBLE PRECISION NOT NULL,
    "mimeType" TEXT NOT NULL,
    "description" "PictureDescription" NOT NULL,
    "relatorio_id" INTEGER NOT NULL,
    "upload_date" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PictureFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tecnico" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "masp" TEXT NOT NULL,

    CONSTRAINT "Tecnico_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Produtor_nr_cpf_cnpj_key" ON "Produtor"("nr_cpf_cnpj");

-- AddForeignKey
ALTER TABLE "Propriedade" ADD CONSTRAINT "Propriedade_produtor_id_fkey" FOREIGN KEY ("produtor_id") REFERENCES "Produtor"("id_pessoa_demeter") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Relatorio" ADD CONSTRAINT "Relatorio_produtor_id_fkey" FOREIGN KEY ("produtor_id") REFERENCES "Produtor"("id_pessoa_demeter") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PictureFile" ADD CONSTRAINT "PictureFile_relatorio_id_fkey" FOREIGN KEY ("relatorio_id") REFERENCES "Relatorio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
