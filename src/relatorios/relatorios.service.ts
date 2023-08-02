import { Injectable } from '@nestjs/common';
import { CreateRelatorioDto } from './dto/create-relatorio.dto';
import { UpdateRelatorioDto } from './dto/update-relatorio.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { RelatorioAPI } from 'src/@graphQL-server/relatorio-api.service';
import { Relatorio } from '@prisma/client';

@Injectable()
export class RelatorioService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly relatorioGraphQLAPI: RelatorioAPI,
  ) {}

  async create(createRelatorioDto: CreateRelatorioDto): Promise<Relatorio> {
    const relatorio = await this.prismaService.relatorio.create({
      data: {
        produtorId: createRelatorioDto.produtorId,
        numeroRelatorio: createRelatorioDto.numeroRelatorio,
        assunto: createRelatorioDto.assunto,
        orientacao: createRelatorioDto.orientacao,
      },
    });
    const demeterUpdate = await this.relatorioGraphQLAPI.createRelatorio(relatorio);
    console.log('🚀 ~ file: relatorios.service.ts:25 ~ create ~ demeterUpdate:', demeterUpdate);

    /* ### TODO - avaliar a utilização de criação com transaction para garantir Sync
     const relatorio = await this.prismaService.createSync(
      createRelatorioDto,
      'relatorio',
      this.relatorioGraphQLAPI,
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
    const relatorios = await this.prismaService.relatorio.findUnique({
      where: { id: id },
      include: { files: true },
    });
    return relatorios;
  }

  async update(update: UpdateRelatorioDto) {
    const demeterUpdate = await this.relatorioGraphQLAPI.updateRelatorio(update);
    console.log('🚀 relatorios.service.ts:63 ~ RelatorioService ~ demeterUpdate:', demeterUpdate);
    const updated = await this.prismaService.relatorio.update({
      where: { id: update.id },
      data: update,
    });
    return updated;
  }

  async remove(id: number) {
    const demeterResult = await this.relatorioGraphQLAPI.deleteRelatorio(id);
    console.log(
      '🚀 ~ file: relatorios.service.ts:70 ~ RelatorioService ~ remove ~ demeterResult:',
      demeterResult,
    );
    await this.prismaService.relatorio.delete({ where: { id } });
    return `Relatorio ${id} removed.`;
  }
}
