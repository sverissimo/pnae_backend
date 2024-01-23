import { gql } from 'graphql-request';

export const createPerfilMutation = gql`
  mutation createPerfil($input: CreatePerfilInput) {
    createPerfil(input: $input)
  }
`;

export const updatePerfilMutation = gql`
  mutation UpdatePerfil($id: Int, $updatePerfilInput: UpdatePerfilInput) {
    updatePerfil(id: $id, updatePerfilInput: $updatePerfilInput) {
      id
      grau_interesse_pnae
      tipo_perfil
    }
  }
`;

export const deletePerfilMutation = gql`
  mutation DeletePerfil($id: Int) {
    deletePerfil(id: $id) {
      id
    }
  }
`;

export const perfisPorProdutorQuery = gql`
  query PerfisPorProdutor($produtorId: String) {
    perfisPorProdutor(produtorId: $produtorId) {
      id
      id_cliente
      tipo_perfil
      participa_organizacao
      grau_interesse_pnae
      at_prf_see_propriedade {
        atividade
      }
      nivel_tecnologico_cultivo
      sistema_producao
      condicao_posse
      dap_caf_vigente
      credito_rural
      fonte_captacao_agua
      forma_esgotamento_sanitario
      atividades_usam_recursos_hidricos
      atividades_com_regularizacao_ambiental
      possui_cadastro_car
      aderiu_pra
      ciente_iniciativas_regularizacao_pra
      realiza_escalonamento_producao

      procedimento_pos_colheita

      procedimento_pos_colheita
      dados_producao_in_natura {
        tipo_regularizacao_uso_recursos_hidricos
        tipo_regularizacao_ambiental
        controla_custos_producao
        local_comercializacao
        valor_total_obtido_pnae
        valor_total_obtido_outros
        forma_entrega_produtos
        dificuldade_fornecimento
        informacoes_adicionais
      }
      dados_producao_agro_industria {
        tipo_regularizacao_uso_recursos_hidricos
        tipo_regularizacao_ambiental
        controla_custos_producao
        local_comercializacao
        valor_total_obtido_pnae
        valor_total_obtido_outros
        forma_entrega_produtos
        dificuldade_fornecimento
        informacoes_adicionais
      }
    }
  }
`;

export const perfilQuery = gql`
  query Perfil {
    perfil {
      id
      id_cliente
      tipo_perfil
      participa_organizacao
      grau_interesse_pnae
      at_prf_see_propriedade {
        atividade
      }
      nivel_tecnologico_cultivo
      sistema_producao
      condicao_posse
      dap_caf_vigente
      credito_rural
      fonte_captacao_agua
      forma_esgotamento_sanitario
      atividades_usam_recursos_hidricos
      atividades_com_regularizacao_ambiental
      possui_cadastro_car
      aderiu_pra
      ciente_iniciativas_regularizacao_pra
      realiza_escalonamento_producao
      procedimento_pos_colheita
      dados_producao_in_natura {
        tipo_regularizacao_uso_recursos_hidricos
        tipo_regularizacao_ambiental
        controla_custos_producao
        local_comercializacao
        valor_total_obtido_pnae
        valor_total_obtido_outros
        forma_entrega_produtos
        dificuldade_fornecimento
        informacoes_adicionais
        at_prf_see_grupos_produtos {
          id
          area_utilizada
          producao_aproximada_ultimo_ano_pnae
          producao_aproximada_ultimo_ano_total
          at_prf_grupo_produto {
            nm_grupo
          }
          at_prf_see_produto {
            id_produto
            area_utilizada
            producao_aproximada_ultimo_ano_pnae
            producao_aproximada_ultimo_ano_total
            at_prf_produto {
              nm_produto
              sg_und_medida
            }
          }
        }
      }
      dados_producao_agro_industria {
        tipo_regularizacao_uso_recursos_hidricos
        tipo_regularizacao_ambiental
        controla_custos_producao
        local_comercializacao
        valor_total_obtido_pnae
        valor_total_obtido_outros
        forma_entrega_produtos
        dificuldade_fornecimento
        informacoes_adicionais
        at_prf_see_grupos_produtos {
          id
          producao_aproximada_ultimo_ano_pnae
          producao_aproximada_ultimo_ano_total
          at_prf_grupo_produto {
            nm_grupo
          }
          at_prf_see_produto {
            id_produto
            producao_aproximada_ultimo_ano_pnae
            producao_aproximada_ultimo_ano_total
            at_prf_produto {
              nm_produto
              sg_und_medida
            }
          }
        }
      }
    }
  }
`;
