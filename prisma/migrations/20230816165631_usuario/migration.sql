/*
  Warnings:

  - You are about to drop the `Tecnico` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `tecnico_id` to the `Relatorio` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Relatorio" ADD COLUMN     "tecnico_id" BIGINT NOT NULL;

-- DropTable
DROP TABLE "Tecnico";

-- CreateTable
CREATE TABLE "Usuario" (
    "id_usuario" BIGSERIAL NOT NULL,
    "login_usuario" VARCHAR(255) NOT NULL,
    "nome_usuario" VARCHAR(255),
    "email_usuario" VARCHAR(255),
    "celular_usuario" VARCHAR(255),
    "cpf_usuario" VARCHAR(14),
    "matricula_usuario" CHAR(5),
    "digito_matricula" CHAR(1),
    "id_und_empresa" CHAR(5),
    "id_cargo" CHAR(4),
    "sexo_usuario" CHAR(1),

    CONSTRAINT "pk_usuario" PRIMARY KEY ("id_usuario")
);

-- CreateIndex
CREATE UNIQUE INDEX "uq_usuario_login" ON "Usuario"("login_usuario");
