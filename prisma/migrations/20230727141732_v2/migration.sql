/*
  Warnings:

  - You are about to drop the column `cpfCnpj` on the `Relatorio` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Relatorio" DROP CONSTRAINT "Relatorio_cpfCnpj_fkey";

-- AlterTable
ALTER TABLE "Relatorio" DROP COLUMN "cpfCnpj",
ADD COLUMN     "cpf_produtor" TEXT;

-- AddForeignKey
ALTER TABLE "Relatorio" ADD CONSTRAINT "Relatorio_cpf_produtor_fkey" FOREIGN KEY ("cpf_produtor") REFERENCES "Produtor"("nr_cpf_cnpj") ON DELETE SET NULL ON UPDATE CASCADE;
