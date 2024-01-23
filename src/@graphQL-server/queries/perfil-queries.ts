import { gql } from 'graphql-request';

export const createPerfilMutation = gql`
  mutation CreatePerfil($input: CreatePerfilInput) {
    createPerfil(input: $input) {
      data_preenchimento: DateTime
      data_atualizacao: DateTime
      tipo_perfil: String
      id_cliente: BigInt
      participa_organizacao: Boolean
      nivel_tecnologico_cultivo: BigInt
      sistema_producao: BigInt
      condicao_posse: BigInt
      dap_caf_vigente: Boolean
      credito_rural: Boolean
      fonte_captacao_agua: BigInt
      forma_esgotamento_sanitario: BigInt
      possui_cadastro_car: Boolean
      aderiu_pra: Boolean
      ciente_iniciativas_regularizacao_pra: Boolean
      realiza_escalonamento_producao: Boolean
      procedimento_pos_colheita: BigInt
      tipo_gestao_unidade: String
      pessoas_processamento_alimentos: Int
      tipo_estabelecimento: String
      tipo_pessoa_juridica: String
      agroindustria_precisa_adaptacao_reforma: Boolean
      possui_registro_orgao_fiscalizacao_sanitaria: Boolean
      orgao_fiscalizacao_sanitaria: String
      atividades_usam_recursos_hidricos: BigInt
      atividades_com_regularizacao_ambiental: BigInt
      possui_agroindustria_propria: Boolean
      grau_interesse_pnae: String
      id_tecnico: BigInt
      # id_dados_producao_agro_industria: BigInt
      # id_dados_producao_in_natura: BigInt
      dados_producao_agro_industria: DadosProducaoInput
      dados_producao_in_natura: DadosProducaoInput
      atividade: String
    }
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
