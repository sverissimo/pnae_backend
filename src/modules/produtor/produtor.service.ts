import { Injectable } from '@nestjs/common';
import { CreateProdutorDto } from './dto/create-produtor.dto';
import { UpdateProdutorDto } from './dto/update-produtor.dto';
import { ProdutorGraphQLAPI } from 'src/@graphQL-server/produtor-api.service';
import { Propriedade } from './entities';
import { Perfil } from 'src/modules/perfil/entities';
import { ProdutorDTO } from './dto';

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
    console.log('🚀 - ProdutorService - findByCpf - produtor:', produtor);

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
