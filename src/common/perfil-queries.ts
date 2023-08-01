import { gql } from 'graphql-request';

export const createPerfilMutation = gql`
  mutation CreatePerfil($input: CreatePerfilInput) {
    createPerfil(input: $input) {
      id
      grau_interesse_pnae
      tipo_perfil
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
  query PerfisPorProdutor($produtorId: Int) {
    perfisPorProdutor(produtorId: $produtorId) {
      id
      tipo_perfil
      id_tecnico
      id_cliente
      data_preenchimento
      data_atualizacao
      participa_organizacao
      id_dados_producao_in_natura
      nivel_tecnologico_cultivo
      sistema_producao
      condicao_posse
      dap_caf_vigente
      credito_rural
      fonte_captacao_agua
      forma_esgotamento_sanitario
      possui_cadastro_car
      aderiu_pra
      ciente_iniciativas_regularizacao_pra
      realiza_escalonamento_producao
      procedimento_pos_colheita
      tipo_gestao_unidade
      pessoas_processamento_alimentos
      tipo_estabelecimento
      tipo_pessoa_juridica
      agroindustria_precisa_adaptacao_reforma
      possui_registro_orgao_fiscalizacao_sanitaria
      orgao_fiscalizacao_sanitaria
      atividades_usam_recursos_hidricos
      atividades_com_regularizacao_ambiental
      possui_agroindustria_propria
      grau_interesse_pnae
      id_dados_producao_agro_industria
      dados_producao {
        controla_custos_producao
        dificuldade_fornecimento
        forma_entrega_produtos
        informacoes_adicionais
        local_comercializacao
        tipo_regularizacao_ambiental
        tipo_regularizacao_uso_recursos_hidricos
        valor_total_obtido_outros
        valor_total_obtido_pnae
      }
      atividade {
        atividade
        id_propriedade
      }
    }
  }
`;

export const perfilQuery = gql`
  query Perfil {
    perfil {
      id
      tipo_perfil
      data_preenchimento
      data_atualizacao
      grau_interesse_pnae
      fonte_captacao_agua
      procedimento_pos_colheita
      sistema_producao
      id_cliente
      dados_producao {
        controla_custos_producao
        dificuldade_fornecimento
        forma_entrega_produtos
        informacoes_adicionais
        local_comercializacao
        tipo_regularizacao_ambiental
        tipo_regularizacao_uso_recursos_hidricos
        valor_total_obtido_outros
        valor_total_obtido_pnae
      }
      atividade {
        atividade
        id_propriedade
        propriedade {
          nome_propriedade
          bairro
          area_total
          produtor_propriedade {
            produtor {
              nm_pessoa
              nr_cpf_cnpj
            }
          }
        }
      }
    }
  }
`;
