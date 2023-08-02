/*
  Warnings:

  - The primary key for the `Produtor` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- DropForeignKey
ALTER TABLE "Perfil" DROP CONSTRAINT "Perfil_id_cliente_fkey";

-- DropForeignKey
ALTER TABLE "Propriedade" DROP CONSTRAINT "Propriedade_produtor_id_fkey";

-- DropForeignKey
ALTER TABLE "Relatorio" DROP CONSTRAINT "Relatorio_produtor_id_fkey";

-- AlterTable
ALTER TABLE "Perfil" ALTER COLUMN "id_cliente" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "Produtor" DROP CONSTRAINT "Produtor_pkey",
ALTER COLUMN "id_pessoa_demeter" SET DATA TYPE BIGINT,
ADD CONSTRAINT "Produtor_pkey" PRIMARY KEY ("id_pessoa_demeter");

-- AlterTable
ALTER TABLE "Propriedade" ALTER COLUMN "produtor_id" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "Relatorio" ALTER COLUMN "produtor_id" SET DATA TYPE BIGINT;

-- AddForeignKey
ALTER TABLE "Propriedade" ADD CONSTRAINT "Propriedade_produtor_id_fkey" FOREIGN KEY ("produtor_id") REFERENCES "Produtor"("id_pessoa_demeter") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Relatorio" ADD CONSTRAINT "Relatorio_produtor_id_fkey" FOREIGN KEY ("produtor_id") REFERENCES "Produtor"("id_pessoa_demeter") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Perfil" ADD CONSTRAINT "Perfil_id_cliente_fkey" FOREIGN KEY ("id_cliente") REFERENCES "Produtor"("id_pessoa_demeter") ON DELETE RESTRICT ON UPDATE CASCADE;
