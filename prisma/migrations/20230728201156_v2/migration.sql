/*
  Warnings:

  - The primary key for the `Produtor` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `produtor_id` column on the `Relatorio` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `id` on the `Produtor` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `produtor_id` on the `Propriedade` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "Propriedade" DROP CONSTRAINT "Propriedade_produtor_id_fkey";

-- DropForeignKey
ALTER TABLE "Relatorio" DROP CONSTRAINT "Relatorio_produtor_id_fkey";

-- AlterTable
ALTER TABLE "Produtor" DROP CONSTRAINT "Produtor_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" INTEGER NOT NULL,
ADD CONSTRAINT "Produtor_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "Propriedade" DROP COLUMN "produtor_id",
ADD COLUMN     "produtor_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "Relatorio" ADD COLUMN     "perfil_id" INTEGER,
DROP COLUMN "produtor_id",
ADD COLUMN     "produtor_id" INTEGER;

-- AddForeignKey
ALTER TABLE "Relatorio" ADD CONSTRAINT "Relatorio_produtor_id_fkey" FOREIGN KEY ("produtor_id") REFERENCES "Produtor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Propriedade" ADD CONSTRAINT "Propriedade_produtor_id_fkey" FOREIGN KEY ("produtor_id") REFERENCES "Produtor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
