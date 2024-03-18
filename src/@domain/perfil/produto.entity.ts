import { parseNumbers } from 'src/utils/parseNumbers';
import {
  GrupoProdutos,
  ProdutoDTO,
  ProdutoModel,
} from '../../modules/perfil/types';
import {
  CreateGrupoProdutosInputDTO,
  CreateProdutosInputDTO,
} from './dto/create-produtos.dto';

export class Produto {
  productGroupToDTO(grupoProdutos: GrupoProdutos) {
    return {
      ...grupoProdutos,
      nm_grupo: grupoProdutos.at_prf_grupo_produto.nm_grupo,
      at_prf_see_produto: grupoProdutos.at_prf_see_produto.map(
        this.productToDTO,
      ),
    };
  }

  productGroupInputToOutputDTO(grupoProdutos: CreateGrupoProdutosInputDTO) {
    this.parseProducaoValues(grupoProdutos);
    grupoProdutos.at_prf_see_produto.forEach(this.parseProducaoValues);
  }

  private productToDTO(produto: ProdutoModel): ProdutoDTO {
    const produtoDTO: ProdutoDTO = {
      ...produto,
      nm_produto: produto.at_prf_produto.nm_produto,
      sg_und_medida: produto.at_prf_produto.sg_und_medida,
    };
    return produtoDTO;
  }

  private parseProducaoValues(
    obj: CreateGrupoProdutosInputDTO | CreateProdutosInputDTO,
  ) {
    if (!obj) return;
    if (obj.producao_aproximada_ultimo_ano_pnae) {
      obj.producao_aproximada_ultimo_ano_pnae = parseNumbers(
        obj.producao_aproximada_ultimo_ano_pnae,
      );
    }
    if (obj.producao_aproximada_ultimo_ano_total) {
      obj.producao_aproximada_ultimo_ano_total = parseNumbers(
        obj.producao_aproximada_ultimo_ano_total,
      );
    }
  }
}
