/*
  Warnings:

  - You are about to drop the `atividade` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `dados_producao` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `perfil` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `produtor` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `propriedade` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `usuario` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `id_contrato` to the `relatorio` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "atividade" DROP CONSTRAINT "atividade_id_perfil_see_fkey";

-- DropForeignKey
ALTER TABLE "perfil" DROP CONSTRAINT "perfil_id_cliente_fkey";

-- DropForeignKey
ALTER TABLE "perfil" DROP CONSTRAINT "perfil_id_dados_producao_agro_industria_fkey";

-- DropForeignKey
ALTER TABLE "propriedade" DROP CONSTRAINT "propriedade_produtor_id_fkey";

-- AlterTable
ALTER TABLE "relatorio" ADD COLUMN     "id_contrato" SMALLINT NOT NULL;

-- DropTable
DROP TABLE "atividade";

-- DropTable
DROP TABLE "dados_producao";

-- DropTable
DROP TABLE "perfil";

-- DropTable
DROP TABLE "produtor";

-- DropTable
DROP TABLE "propriedade";

-- DropTable
DROP TABLE "usuario";

-- DropEnum
DROP TYPE "Sexo";

-- DropEnum
DROP TYPE "TipoPessoa";

-- DropEnum
DROP TYPE "TipoSexo";
