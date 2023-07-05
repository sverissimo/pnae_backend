-- CreateEnum
CREATE TYPE "TipoPessoa" AS ENUM ('FISICA', 'JURIDICA');

-- CreateEnum
CREATE TYPE "PictureDescription" AS ENUM ('FOTO_VISITA', 'ASSINATURA_PROPRIETARIO');

-- CreateEnum
CREATE TYPE "Sexo" AS ENUM ('MASCULINO', 'FEMININO', 'NAO_INFORMADO');

-- CreateTable
CREATE TABLE "Visita" (
    "id" SERIAL NOT NULL,
    "propriedade_id" INTEGER NOT NULL,
    "orientacao" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Visita_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PictureFile" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "size" DOUBLE PRECISION NOT NULL,
    "mimeType" TEXT NOT NULL,
    "description" "PictureDescription" NOT NULL,
    "visita_id" INTEGER NOT NULL,
    "upload_date" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PictureFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Propriedade" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "municipio" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "coordenadas" TEXT NOT NULL,
    "proprietario_id" INTEGER NOT NULL,

    CONSTRAINT "Propriedade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proprietario" (
    "id" SERIAL NOT NULL,
    "tipo_pessoa" "TipoPessoa" NOT NULL,
    "nome" TEXT NOT NULL,
    "cpf" TEXT,
    "cnpj" TEXT,
    "data_nascimento" TIMESTAMP(3),
    "sexo" "Sexo",

    CONSTRAINT "Proprietario_pkey" PRIMARY KEY ("id")
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
CREATE UNIQUE INDEX "Proprietario_cpf_key" ON "Proprietario"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "Proprietario_cnpj_key" ON "Proprietario"("cnpj");

-- AddForeignKey
ALTER TABLE "Visita" ADD CONSTRAINT "Visita_propriedade_id_fkey" FOREIGN KEY ("propriedade_id") REFERENCES "Propriedade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PictureFile" ADD CONSTRAINT "PictureFile_visita_id_fkey" FOREIGN KEY ("visita_id") REFERENCES "Visita"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Propriedade" ADD CONSTRAINT "Propriedade_proprietario_id_fkey" FOREIGN KEY ("proprietario_id") REFERENCES "Proprietario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
