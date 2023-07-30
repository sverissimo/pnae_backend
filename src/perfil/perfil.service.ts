import { Injectable } from '@nestjs/common';
import { CreatePerfilDto } from './dto/create-perfil.dto';
import { UpdatePerfilDto } from './dto/update-perfil.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { GraphQLApiGateway } from 'src/common/graphql-api.service';

@Injectable()
export class PerfilService {
  constructor(private prismaService: PrismaService, private api: GraphQLApiGateway) {}

  create(createPerfilDto: CreatePerfilDto) {
    return 'This action adds a new perfil';
  }

  async findAll() {
    const perfis = await this.api.getPerfis();
    return perfis;
  }

  async findByProdutorId(produtorId: number) {
    const localPerfil = await this.prismaService.perfil.findMany({
      where: { id_cliente: produtorId },
    });
    if (localPerfil.length) {
      return localPerfil;
    }
    const perfis = await this.api.getPerfilByProdutorId(produtorId);
    return perfis;
  }

  findOne = (id: number) => this.prismaService.perfil.findUnique({ where: { id } });

  update(id: number, updatePerfilDto: UpdatePerfilDto) {
    return `This action updates a #${id} perfil`;
  }

  remove(id: number) {
    return `This action removes a #${id} perfil`;
  }
}
