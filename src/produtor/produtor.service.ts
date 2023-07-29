import { Injectable } from '@nestjs/common';
import { CreateProdutorDto } from './dto/create-produtor.dto';
import { UpdateProdutorDto } from './dto/update-produtor.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { GraphQLApiGateway } from 'src/common/graphql-api.service';
import { RelatorioService } from 'src/relatorios/relatorios.service';

@Injectable()
export class ProdutorService {
  constructor(
    private prismaService: PrismaService,
    private api: GraphQLApiGateway,
    private relatorioService: RelatorioService,
  ) {}

  create(createProdutorDto: CreateProdutorDto) {
    return 'This action adds a new produtor';
  }

  findAll() {
    return `This action returns all produtor`;
  }

  async findOne(cpfProdutor: string) {
    const { produtor }: any = await this.api.getProdutor(cpfProdutor);

    const relatorios = await this.relatorioService.findMany(produtor.id_pessoa_demeter);
    produtor.relatorios = relatorios;

    return produtor;

    /**** TODO: Implementar isso depois (procurar na memória interna primeiro?)
    const produtorLocal = await this.prismaService.produtor.findFirst({
      where: {
        cpfCnpj: '123.456.789-99',
      },
      if(produtorLocal) {
        return produtorLocal
      }
    }); */
  }

  update(id: number, updateProdutorDto: UpdateProdutorDto) {
    return `This action updates a #${id} produtor`;
  }

  remove(id: number) {
    return `This action removes a #${id} produtor`;
  }
}
