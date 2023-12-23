import { Injectable } from '@nestjs/common';
import { CreatePerfilDto } from './dto/create-perfil.dto';
import { UpdatePerfilDto } from './dto/update-perfil.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { PerfilGraphQLAPI } from 'src/@graphQL-server/perfil-api.service';
import { RestAPI } from 'src/@rest-api-server/rest-api.service';

@Injectable()
export class PerfilService {
  constructor(
    private prismaService: PrismaService,
    private graphQLAPI: PerfilGraphQLAPI,
    private restAPI: RestAPI,
  ) {}

  async create(createPerfilDto: CreatePerfilDto) {
    return await this.graphQLAPI.createPerfil(createPerfilDto);
  }

  async findAll() {
    const perfis = await this.graphQLAPI.getPerfis();
    return perfis;
  }

  async findByProdutorId(produtorId: string) {
    const localPerfil = await this.prismaService.perfil.findMany({
      where: { id_cliente: BigInt(produtorId) },
    });
    if (localPerfil.length) {
      return localPerfil;
    }
    const perfis = await this.graphQLAPI.getPerfilByProdutorId(produtorId);
    return perfis;
  }

  findOne = async (id: number) => await this.prismaService.perfil.findFirst({ where: { id } });

  async update(id: number, updatePerfilDto: UpdatePerfilDto) {
    return await this.graphQLAPI.updatePerfil(id, updatePerfilDto);
  }

  async remove(id: number) {
    return await this.graphQLAPI.deletePerfil(id);
  }

  getPerfilOptions = async () => {
    const data = await this.restAPI.getPerfilOptions();
    return data;
  };

  getProdutos = async () => {
    const produtos = await this.restAPI.getGruposProdutos();
    console.log(
      '🚀 - file: perfil.service.ts:53 - PerfilService - getProdutos= - produtos:',
      produtos,
    );

    return produtos;
  };
}
