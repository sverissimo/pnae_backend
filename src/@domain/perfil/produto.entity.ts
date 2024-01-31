import { GrupoProdutos, ProdutoDTO, ProdutoModel } from '../../modules/perfil/types';

export class Produto {
  productGroupToDTO(grupoProdutos: GrupoProdutos) {
    return {
      ...grupoProdutos,
      nm_grupo: grupoProdutos.at_prf_grupo_produto.nm_grupo,
      at_prf_see_produto: grupoProdutos.at_prf_see_produto.map(this.productToDTO),
    };
  }

  private productToDTO(produto: ProdutoModel): ProdutoDTO {
    const produtoDTO: ProdutoDTO = {
      ...produto,
      nm_produto: produto.at_prf_produto.nm_produto,
      sg_und_medida: produto.at_prf_produto.sg_und_medida,
    };
    return produtoDTO;
  }
}
