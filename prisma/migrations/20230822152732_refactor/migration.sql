/*
  Warnings:

  - You are about to drop the column `nr_relatorio` on the `Relatorio` table. All the data in the column will be lost.
  - Added the required column `numero_relatorio` to the `Relatorio` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Relatorio" DROP COLUMN "nr_relatorio",
ADD COLUMN     "assinaturaURI" TEXT,
ADD COLUMN     "numero_relatorio" INTEGER NOT NULL,
ADD COLUMN     "pictureURI" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3);
