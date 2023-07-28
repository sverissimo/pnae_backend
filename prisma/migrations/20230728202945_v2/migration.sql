/*
  Warnings:

  - You are about to drop the column `produtor_id` on the `Relatorio` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Relatorio" DROP CONSTRAINT "Relatorio_produtor_id_fkey";

-- AlterTable
ALTER TABLE "Relatorio" DROP COLUMN "produtor_id";
