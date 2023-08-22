import { Injectable } from '@nestjs/common';
import { CreateRelatorioDto } from './dto/create-relatorio.dto';
import { UpdateRelatorioDto } from './dto/update-relatorio.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { RelatorioGraphQLAPI } from 'src/@graphQL-server/relatorio-api.service';
import { Prisma, Relatorio } from '@prisma/client';

@Injectable()
export class RelatorioService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly graphQLAPI: RelatorioGraphQLAPI,
  ) {}

  async create(
    createRelatorioDto: Prisma.RelatorioCreateInput & { produtorId: any },
  ): Promise<Relatorio> {
    const relatorio = await this.prismaService.relatorio.create({
      data: {
        //produtorId: createRelatorioDto.produtorId,
        tecnicoId: createRelatorioDto.tecnicoId,
        numeroRelatorio: +createRelatorioDto.numeroRelatorio,
        assunto: createRelatorioDto.assunto,
        orientacao: createRelatorioDto.orientacao,
        produtor: {
          connect: {
            id: BigInt(createRelatorioDto.produtorId),
          },
        },
      },
    });

    //const demeterUpdate = await this.graphQLAPI.createRelatorio(relatorio);
    // console.log('🚀 ~ file: relatorios.service.ts:25 ~ create ~ demeterUpdate:', demeterUpdate);

    /* ### TODO - avaliar a utilização de criação com transaction para garantir Sync
     const relatorio = await this.prismaService.createSync(
      createRelatorioDto,
      'relatorio',
      this.graphQLAPI,
    ); */
    return relatorio;
  }

  async findAll() {
    const relatorios = await this.prismaService.relatorio.findMany({
      include: {
        files: true,
      },
    });
    return relatorios;
  }

  async findMany(produtorId: number) {
    const relatorios = await this.prismaService.relatorio.findMany({ where: { produtorId } });
    return relatorios;
  }

  async findOne(id: number) {
    const relatorio = await this.prismaService.relatorio.findUnique({
      where: { id: id },
      include: { files: true },
      // include: { files: { where: { relatorioId: id } } },
    });

    const pics = await this.prismaService.pictureFile.findMany({
      where: { id: { in: [relatorio.assinaturaURI, relatorio.pictureURI] } },
    });
    relatorio.files = pics;

    return relatorio;
  }

  async update(update: UpdateRelatorioDto) {
    // const demeterUpdate = await this.graphQLAPI.updateRelatorio(update);
    // console.log('🚀 relatorios.service.ts:63 ~ RelatorioService ~ demeterUpdate:', demeterUpdate);
    const updated = await this.prismaService.relatorio.update({
      where: { id: update.id },
      data: update,
    });
    return updated;
  }

  async remove(id: number) {
    const demeterResult = await this.graphQLAPI.deleteRelatorio(id);
    console.log(
      '🚀 ~ file: relatorios.service.ts:70 ~ RelatorioService ~ remove ~ demeterResult:',
      demeterResult,
    );
    await this.prismaService.relatorio.delete({ where: { id } });
    return `Relatorio ${id} removed.`;
  }
}
