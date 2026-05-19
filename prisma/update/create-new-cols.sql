DO $$
BEGIN
  CREATE TYPE "GrauInteresse" AS ENUM ('BAIXO', 'MEDIO', 'ALTO');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "relatorio"
  ADD COLUMN IF NOT EXISTS "comercializa_pnae" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "produto_tratado" TEXT,
  ADD COLUMN IF NOT EXISTS "grau_interesse" "GrauInteresse";