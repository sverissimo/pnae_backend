/*
  Warnings:

  - You are about to drop the column `produtor_id` on the `Relatorio` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Relatorio" DROP CONSTRAINT "Relatorio_produtor_id_fkey";

-- AlterTable
ALTER TABLE "Relatorio" DROP COLUMN "produtor_id",
ADD COLUMN     "cpfCnpj" TEXT;

-- AddForeignKey
ALTER TABLE "Relatorio" ADD CONSTRAINT "Relatorio_cpfCnpj_fkey" FOREIGN KEY ("cpfCnpj") REFERENCES "Produtor"("nr_cpf_cnpj") ON DELETE SET NULL ON UPDATE CASCADE;
