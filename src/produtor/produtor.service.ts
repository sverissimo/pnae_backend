import { Injectable } from '@nestjs/common';
import { CreateProdutorDto } from './dto/create-produtor.dto';
import { UpdateProdutorDto } from './dto/update-produtor.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { RelatorioService } from 'src/relatorios/relatorios.service';
import { ProdutorGraphQLAPI } from 'src/@graphQL-server/produtor-api.service';
import { Propriedade } from './entities';
import { Perfil } from 'src/perfil/entities';

@Injectable()
export class ProdutorService {
  constructor(
    private prismaService: PrismaService,
    private api: ProdutorGraphQLAPI,
    private relatorioService: RelatorioService,
  ) {}

  create(createProdutorDto: CreateProdutorDto) {
    return 'This action adds a new produtor';
  }

  findAll() {
    return `This action returns all produtor`;
  }

  async findOne(cpfProdutor: string) {
    const produtor: any = await this.api.getProdutor(cpfProdutor);
    const propriedades = produtor.propriedades.map((p) => new Propriedade(p).toDTO());
    const perfis = produtor.perfis.map((p) => new Perfil(p).toDTO());
    return { ...produtor, propriedades, perfis };
  }

  update(id: number, updateProdutorDto: UpdateProdutorDto) {
    return `This action updates a #${id} produtor`;
  }

  remove(id: number) {
    return `This action removes a #${id} produtor`;
  }
}
