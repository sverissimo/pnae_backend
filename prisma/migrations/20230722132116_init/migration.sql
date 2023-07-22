/*
  Warnings:

  - The values [ASSINATURA_PROPRIETARIO] on the enum `PictureDescription` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `proprietario_id` on the `Propriedade` table. All the data in the column will be lost.
  - You are about to drop the `Proprietario` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `produtor_id` to the `Propriedade` table without a default value. This is not possible if the table is not empty.
  - Added the required column `assunto` to the `Visita` table without a default value. This is not possible if the table is not empty.
  - Added the required column `nr_visita` to the `Visita` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "PictureDescription_new" AS ENUM ('FOTO_VISITA', 'ASSINATURA_PRODUTOR');
ALTER TABLE "PictureFile" ALTER COLUMN "description" TYPE "PictureDescription_new" USING ("description"::text::"PictureDescription_new");
ALTER TYPE "PictureDescription" RENAME TO "PictureDescription_old";
ALTER TYPE "PictureDescription_new" RENAME TO "PictureDescription";
DROP TYPE "PictureDescription_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "Propriedade" DROP CONSTRAINT "Propriedade_proprietario_id_fkey";

-- AlterTable
ALTER TABLE "Propriedade" DROP COLUMN "proprietario_id",
ADD COLUMN     "produtor_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Visita" ADD COLUMN     "assunto" TEXT NOT NULL,
ADD COLUMN     "nr_visita" INTEGER NOT NULL;

-- DropTable
DROP TABLE "Proprietario";

-- CreateTable
CREATE TABLE "Produtor" (
    "id" SERIAL NOT NULL,
    "tipo_pessoa" "TipoPessoa" NOT NULL,
    "nome" TEXT NOT NULL,
    "cpf" TEXT,
    "cnpj" TEXT,
    "data_nascimento" TIMESTAMP(3),
    "sexo" "Sexo",

    CONSTRAINT "Produtor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Produtor_cpf_key" ON "Produtor"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "Produtor_cnpj_key" ON "Produtor"("cnpj");

-- AddForeignKey
ALTER TABLE "Propriedade" ADD CONSTRAINT "Propriedade_produtor_id_fkey" FOREIGN KEY ("produtor_id") REFERENCES "Produtor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
