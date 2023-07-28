/*
  Warnings:

  - You are about to drop the column `cnpj` on the `Produtor` table. All the data in the column will be lost.
  - You are about to drop the column `cpf` on the `Produtor` table. All the data in the column will be lost.
  - You are about to drop the column `propriedade_id` on the `Relatorio` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[nr_cpf_cnpj]` on the table `Produtor` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "Relatorio" DROP CONSTRAINT "Relatorio_propriedade_id_fkey";

-- DropIndex
DROP INDEX "Produtor_cnpj_key";

-- DropIndex
DROP INDEX "Produtor_cpf_key";

-- AlterTable
ALTER TABLE "Produtor" DROP COLUMN "cnpj",
DROP COLUMN "cpf",
ADD COLUMN     "nr_cpf_cnpj" TEXT;

-- AlterTable
ALTER TABLE "Relatorio" DROP COLUMN "propriedade_id",
ADD COLUMN     "produtor_id" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Produtor_nr_cpf_cnpj_key" ON "Produtor"("nr_cpf_cnpj");

-- AddForeignKey
ALTER TABLE "Relatorio" ADD CONSTRAINT "Relatorio_produtor_id_fkey" FOREIGN KEY ("produtor_id") REFERENCES "Produtor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
