-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "PictureDescription" AS ENUM ('FOTO_RELATORIO', 'ASSINATURA_PRODUTOR');

-- CreateEnum
CREATE TYPE "GrauInteresse" AS ENUM ('BAIXO', 'MEDIO', 'ALTO');

-- CreateTable
CREATE TABLE "relatorio" (
    "id" TEXT NOT NULL,
    "produtor_id" BIGINT NOT NULL,
    "tecnico_id" BIGINT NOT NULL,
    "numero_relatorio" INTEGER NOT NULL,
    "assunto" TEXT NOT NULL,
    "orientacao" TEXT NOT NULL,
    "pictureURI" TEXT,
    "assinaturaURI" TEXT,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "id_at_atendimento" BIGINT,
    "outro_extensionista" TEXT,
    "read_only" BOOLEAN NOT NULL DEFAULT false,
    "coordenadas" TEXT,
    "id_contrato" SMALLINT NOT NULL,
    "comercializa_pnae" BOOLEAN,
    "produto_tratado" TEXT,
    "grau_interesse" "GrauInteresse",

    CONSTRAINT "relatorio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "arquivos" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "description" "PictureDescription" NOT NULL,
    "relatorio_id" TEXT NOT NULL,
    "upload_date" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "arquivos_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "arquivos" ADD CONSTRAINT "arquivos_relatorio_id_fkey" FOREIGN KEY ("relatorio_id") REFERENCES "relatorio"("id") ON DELETE CASCADE ON UPDATE CASCADE;

