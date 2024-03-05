import { Injectable } from '@nestjs/common';
import { CreateProdutorDto } from './dto/create-produtor.dto';
import { UpdateProdutorDto } from './dto/update-produtor.dto';
import { ProdutorGraphQLAPI } from 'src/@graphQL-server/produtor-api.service';
import { Propriedade } from './entities';
import { Perfil } from 'src/@domain/perfil';
import { ProdutorDTO } from './dto';
import { Produtor } from 'src/@domain/produtor/produtor';

@Injectable()
export class ProdutorService {
  constructor(private api: ProdutorGraphQLAPI) {}

  create(createProdutorDto: CreateProdutorDto) {
    return 'This action adds a new produtor';
  }
  findAll() {
    return `This action returns all produtor`;
  }

  async findOne(produtorId: string) {
    const produtor: any = (await this.api.getProdutorById(produtorId)) as ProdutorDTO;
    const propriedades = produtor.propriedades.map((p) => new Propriedade(p).toDTO());
    const perfis = produtor.perfis.map((p) => new Perfil(p).toDTO());
    return { ...produtor, propriedades, perfis } as ProdutorDTO;
  }

  async findByCpf(cpfProdutor: string) {
    const produtor: any = await this.api.getProdutor(cpfProdutor);
    const propriedades = produtor.propriedades.map((p) => new Propriedade(p).toDTO());
    const perfis = produtor.perfis.map((p) => new Perfil(p).toDTO());

    return { ...produtor, propriedades, perfis };
  }

  async findManyById(ids: string[]) {
    const produtores: any = await this.api.getManyProdutores(ids);
    const parsedProdutores = produtores.produtores.map((p) => {
      const { perfis, ...produtor } = p;
      const municipio = Produtor.getMunicipioFromPerfis(perfis);
      return { ...produtor, municipio };
    });
    return parsedProdutores;
  }

  async getUnidadeEmpresa(produtorId: string) {
    return await this.api.getProdutorUnidadeEmpresaId(produtorId);
  }

  update(id: number, updateProdutorDto: UpdateProdutorDto) {
    return `This action updates a #${id} produtor`;
  }

  remove(id: number) {
    return `This action removes a #${id} produtor`;
  }
}
