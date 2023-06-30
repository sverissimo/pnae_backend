// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import * as fs from 'node:fs';
import { join } from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log(join);
  const data = JSON.parse(
    fs.readFileSync(join(__dirname, 'data', 'fakeData.json'), 'utf-8'),
  );

  // Insert proprietarios
  await prisma.proprietario.createMany({
    data: data.proprietarios,
  });

  // Insert propriedades
  await prisma.propriedade.createMany({
    data: data.propriedades,
  });

  // Insert visitas
  await prisma.visita.createMany({
    data: data.visitas,
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
