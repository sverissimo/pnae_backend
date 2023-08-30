/*
  Warnings:

  - You are about to drop the column `updated_at` on the `relatorio` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "relatorio" DROP COLUMN "updated_at",
ADD COLUMN     "updatedAt" TIMESTAMP(3);
