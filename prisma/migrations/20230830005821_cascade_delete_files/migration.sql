-- DropForeignKey
ALTER TABLE "arquivos" DROP CONSTRAINT "arquivos_relatorio_id_fkey";

-- AddForeignKey
ALTER TABLE "arquivos" ADD CONSTRAINT "arquivos_relatorio_id_fkey" FOREIGN KEY ("relatorio_id") REFERENCES "relatorio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
