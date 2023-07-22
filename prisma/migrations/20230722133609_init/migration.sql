/*
  Warnings:

  - The values [FOTO_VISITA] on the enum `PictureDescription` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `visita_id` on the `PictureFile` table. All the data in the column will be lost.
  - You are about to drop the `Visita` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `relatorio_id` to the `PictureFile` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "PictureDescription_new" AS ENUM ('FOTO_RELATORIO', 'ASSINATURA_PRODUTOR');
ALTER TABLE "PictureFile" ALTER COLUMN "description" TYPE "PictureDescription_new" USING ("description"::text::"PictureDescription_new");
ALTER TYPE "PictureDescription" RENAME TO "PictureDescription_old";
ALTER TYPE "PictureDescription_new" RENAME TO "PictureDescription";
DROP TYPE "PictureDescription_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "PictureFile" DROP CONSTRAINT "PictureFile_visita_id_fkey";

-- DropForeignKey
ALTER TABLE "Visita" DROP CONSTRAINT "Visita_propriedade_id_fkey";

-- AlterTable
ALTER TABLE "PictureFile" DROP COLUMN "visita_id",
ADD COLUMN     "relatorio_id" INTEGER NOT NULL;

-- DropTable
DROP TABLE "Visita";

-- CreateTable
CREATE TABLE "Relatorio" (
    "id" SERIAL NOT NULL,
    "nr_relatorio" INTEGER NOT NULL,
    "assunto" TEXT NOT NULL,
    "orientacao" TEXT NOT NULL,
    "propriedade_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Relatorio_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Relatorio" ADD CONSTRAINT "Relatorio_propriedade_id_fkey" FOREIGN KEY ("propriedade_id") REFERENCES "Propriedade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PictureFile" ADD CONSTRAINT "PictureFile_relatorio_id_fkey" FOREIGN KEY ("relatorio_id") REFERENCES "Relatorio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
