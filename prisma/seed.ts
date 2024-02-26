// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import * as fs from 'node:fs';
import { join } from 'path';
const prisma = new PrismaClient();

async function main() {
  console.log('Skipping seed for now...');
  // const data = JSON.parse(fs.readFileSync(join(__dirname, 'data', 'fakeData.json'), 'utf-8'));
  // const data = JSON.parse(fs.readFileSync(join(__dirname, 'data', 'pictureFiles.json'), 'utf-8'));

  // // Insert produtores
  // await prisma.produtor.createMany({
  //   data: data.map((p) => ({
  //     ...p,
  //     id: BigInt(p.id),
  //   })),
  // });

  // // Insert propriedades
  // await prisma.propriedade.createMany({
  // data: data.map((p) => ({
  //   ...p,
  //   produtorId: BigInt(p.produtorId),
  // })),
  // });

  // Insert relatorios
  // await prisma.relatorio.createMany({
  // data: data.map((p) => ({
  //   ...p,
  //   produtorId: BigInt(p.produtorId),
  //   tecnicoId: BigInt(p.tecnicoId),
  //   createdAt: new Date(p.createdAt),
  // })),
  // });

  // Insert pictureFiles
  // await prisma.pictureFile.createMany({
  //   data: data.map((p) => ({
  //     ...p,
  //     uploadDate: new Date(p.uploadDate),
  //   })),
  // });

  // // Insert tecnicos
  // await prisma.usuario.createMany({
  //   data: data.usuarios,
  // });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
