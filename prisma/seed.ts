// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import * as fs from 'node:fs';
import { join } from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log(
    '🚀 ~ file: seed.ts:10**********************',
    join(__dirname, 'data', 'fakeData.json'),
  );
  const data = JSON.parse(fs.readFileSync(join(__dirname, 'data', 'fakeData.json'), 'utf-8'));

  // Insert produtores
  await prisma.produtor.createMany({
    data: data.produtores,
  });

  // Insert propriedades
  await prisma.propriedade.createMany({
    data: data.propriedades,
  });

  // Insert relatorios
  await prisma.relatorio.createMany({
    data: data.relatorios,
  });

  // Insert pictureFiles
  await prisma.pictureFile.createMany({
    data: data.pictureFiles,
  });

  // Insert tecnicos
  await prisma.tecnico.createMany({
    data: data.tecnicos,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
