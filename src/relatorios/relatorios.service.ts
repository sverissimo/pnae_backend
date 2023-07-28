import { Injectable } from '@nestjs/common';
import { CreateRelatorioDto } from './dto/create-relatorio.dto';
import { UpdateRelatorioDto } from './dto/update-relatorio.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class RelatorioService {
  constructor(private readonly prismaService: PrismaService) {}

  async create(createRelatorioDto: CreateRelatorioDto): Promise<number> {
    const relatorio = await this.prismaService.relatorio.create({
      data: {
        numeroRelatorio: createRelatorioDto.numeroRelatorio,
        assunto: createRelatorioDto.assunto,
        orientacao: createRelatorioDto.orientacao,
      },
    });
    return relatorio.id;
  }

  async findAll() {
    const relatorios = this.prismaService.relatorio.findMany({
      include: {
        files: true,
      },
    });
    const props = tst();
    const result = await Promise.all([relatorios, props]);
    return { result: [...result[0], result[1]?.data] };
  }

  async findMany(perfilId: number) {
    const relatorios = await this.prismaService.relatorio.findMany({ where: { perfilId } });
    return relatorios;
  }

  async findOne(id: number) {
    const relatorios = await this.prismaService.relatorio.findMany({
      where: { id: id },
      include: { files: true },
    });

    return relatorios;
  }

  async update(id: number, updateRelatorioDto: Omit<UpdateRelatorioDto, 'fotos'>) {
    try {
      const updated = await this.prismaService.relatorio.update({
        where: { id },
        data: { ...updateRelatorioDto },
      });
      return updated;
    } catch (error) {
      console.log(
        '🚀 ~ file: relatorios.service.ts:56 ~ RelatorioService ~ update ~ error:',
        error,
      );
    }
  }

  async remove(id: number) {
    await this.prismaService.relatorio.delete({ where: { id } });
    return 'Relatorio removed.';
  }
}

const tst = async () => {
  try {
    const bd = {
      query:
        'query Produtor($id: Int, $cpf: String) {\r\n  produtor(id: $id, cpf: $cpf), {    \r\n    nm_pessoa\r\n    propriedades {\r\n      nome_propriedade\r\n id_pl_propriedade\r\n    }\r\n  }\r\n}',
      variables: {
        id: 700002,
        cpf: '45826560649',
      },
      operationName: 'Produtor',
    };
    //const fk = await fetch('http://localhost:4000', {

    const fk = await fetch('http://172.17.0.1:4000', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bd),
    });
    const fk2 = await fk.json();
    console.log('🚀 ~ file: relatorios.controller.ts:60 ~ RelatorioController ~ tst ~ fk2:', fk2);
    return fk2;
  } catch (error) {
    console.error(error);
    throw new Error(error.message);
  }
};
