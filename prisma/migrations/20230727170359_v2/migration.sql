/*
  Warnings:

  - The primary key for the `Produtor` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `cpf_produtor` on the `Relatorio` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Propriedade" DROP CONSTRAINT "Propriedade_produtor_id_fkey";

-- DropForeignKey
ALTER TABLE "Relatorio" DROP CONSTRAINT "Relatorio_cpf_produtor_fkey";

-- AlterTable
ALTER TABLE "Produtor" DROP CONSTRAINT "Produtor_pkey",
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "Produtor_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Produtor_id_seq";

-- AlterTable
ALTER TABLE "Propriedade" ALTER COLUMN "produtor_id" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "Relatorio" DROP COLUMN "cpf_produtor",
ADD COLUMN     "produtor_id" TEXT;

-- AddForeignKey
ALTER TABLE "Relatorio" ADD CONSTRAINT "Relatorio_produtor_id_fkey" FOREIGN KEY ("produtor_id") REFERENCES "Produtor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Propriedade" ADD CONSTRAINT "Propriedade_produtor_id_fkey" FOREIGN KEY ("produtor_id") REFERENCES "Produtor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
