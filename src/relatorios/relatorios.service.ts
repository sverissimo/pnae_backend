import { Injectable } from '@nestjs/common';
import { CreateRelatorioDto } from './dto/create-relatorio.dto';
import { UpdateRelatorioDto } from './dto/update-relatorio.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class VisitasService {
  constructor(private readonly prismaService: PrismaService) {}

  async create(createRelatorioDto: CreateRelatorioDto): Promise<number> {
    console.log(
      '🚀 ~ file: visitas.service.ts:11 ~ VisitasService ~ create ~ createRelatorioDto:',
      createRelatorioDto,
    );

    const relatorio = await this.prismaService.relatorio.create({
      data: {
        numeroRelatorio: createRelatorioDto.numeroRelatorio,
        assunto: createRelatorioDto.assunto,
        orientacao: createRelatorioDto.orientacao,
        propriedade: {
          connect: {
            id: createRelatorioDto.propriedadeId,
          },
        },
      },
    });
    return relatorio.id;
  }

  async findAll() {
    const visitas = this.prismaService.relatorio.findMany({
      include: {
        files: true,
      },
    });
    const props = tst();
    const result = await Promise.all([visitas, props]);
    return { result: [...result[0], result[1]?.data] };
  }

  async findOne(id: number) {
    const visitas = await this.prismaService.relatorio.findMany({
      where: { id: id },
      include: { files: true },
    });

    return visitas;
  }

  async update(id: number, updateRelatorioDto: Omit<UpdateRelatorioDto, 'fotos'>) {
    const updated = await this.prismaService.relatorio.update({
      where: { id },
      data: { ...updateRelatorioDto },
    });
    return updated;
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
    console.log('🚀 ~ file: visitas.controller.ts:60 ~ VisitasController ~ tst ~ fk2:', fk2);
    return fk2;
  } catch (error) {
    console.error(error);
    throw new Error(error.message);
  }
};
