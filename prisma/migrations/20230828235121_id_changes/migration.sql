/*
  Warnings:

  - The primary key for the `relatorio` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- DropForeignKey
ALTER TABLE "arquivos" DROP CONSTRAINT "arquivos_relatorio_id_fkey";

-- AlterTable
ALTER TABLE "arquivos" ALTER COLUMN "relatorio_id" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "relatorio" DROP CONSTRAINT "relatorio_pkey",
ALTER COLUMN "id" SET DATA TYPE TEXT,
ADD CONSTRAINT "relatorio_pkey" PRIMARY KEY ("id");

-- AddForeignKey
ALTER TABLE "arquivos" ADD CONSTRAINT "arquivos_relatorio_id_fkey" FOREIGN KEY ("relatorio_id") REFERENCES "relatorio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
