import { Injectable, Res } from '@nestjs/common';
import { CreatePerfilDto } from './dto/create-perfil.dto';
import { UpdatePerfilDto } from './dto/update-perfil.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { GraphQLApiGateway } from 'src/common/graphql-api.service';

@Injectable()
export class PerfilService {
  constructor(private prismaService: PrismaService, private api: GraphQLApiGateway) {}

  async create(createPerfilDto: CreatePerfilDto) {
    return await this.api.createPerfil(createPerfilDto);
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

  findOne = async (id: number) => await this.prismaService.perfil.findFirst({ where: { id } });

  async update(id: number, updatePerfilDto: UpdatePerfilDto) {
    return await this.api.updatePerfil(id, updatePerfilDto);
  }

  async remove(id: number) {
    return await this.api.deletePerfil(id);
  }
}
