import { Injectable } from '@nestjs/common';
import { UpdatePerfilDto } from '../../@domain/perfil/dto/update-perfil.dto';
import { PerfilGraphQLAPI } from 'src/@graphQL-server/perfil-api.service';
import { RestAPI } from 'src/@rest-api-server/rest-api.service';
import { Perfil } from '../../@domain/perfil';
import { CreatePerfilInputDto } from 'src/@domain/perfil/dto/create-perfil.dto';
import { PerfilDataMapper } from './data-mapper/perfil.data-mapper';

@Injectable()
export class PerfilService {
  constructor(private graphQLAPI: PerfilGraphQLAPI, private restAPI: RestAPI) {}

  async create(createPerfilInputDto: CreatePerfilInputDto) {
    const perfilOptionsRaw = await this.getPerfilOptionsRaw();

    const createPerfilOutputDTO = new Perfil(
      createPerfilInputDto,
    ).inputDTOToOutputDTO();

    PerfilDataMapper.convertStringPropsToPrimeNumbers(
      createPerfilOutputDTO,
      perfilOptionsRaw,
    );

    const result = this.graphQLAPI.createPerfil(createPerfilOutputDTO);

    return result;
  }

  async findAll() {
    const perfis = await this.graphQLAPI.getPerfis();
    return perfis;
  }

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

  getPerfilOptionsRaw = () => this.restAPI.getPerfilOptionsRaw();

  getProdutos = async () => {
    const produtos = await this.restAPI.getGruposProdutos();
    return produtos;
  };

  getContractInfo = async () => {
    const contractInfo = await this.restAPI.getContractInfo();
    return contractInfo;
  };
}
