import { gql } from 'graphql-request';

export const produtorQuery = gql`
  query Produtor($id: Int, $cpf: String) {
    produtor(id: $id, cpf: $cpf) {
      id_pessoa_demeter
      nm_pessoa
      dap
      caf
      tp_sexo
      nr_cpf_cnpj
      dt_nascimento
      sn_ativo
      dt_update_record
      id_und_empresa
      propriedades {
        id_pl_propriedade
        nome_propriedade
        area_total
        municipio {
          nm_municipio
        }
        ger_und_empresa {
          id_und_empresa
          fk_und_empresa
          nm_und_empresa
          ger_und_empresa {
            id_und_empresa
            nm_und_empresa
          }
        }
        geo_ponto_texto
        id_municipio
        atividade_principal
        at_prf_see_propriedade {
          producao_dedicada_pnae
          atividade
        }
      }
      perfis {
        id
        id_cliente
        id_contrato
        data_preenchimento
        data_atualizacao
        tipo_perfil
        participa_organizacao
        grau_interesse_pnae
        at_prf_see_propriedade {
          atividade
        }
        usuario {
          id_usuario
          nome_usuario
          matricula_usuario
          digito_matricula
          login_usuario
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
          total_obtido_pnae
          total_obtido_outros
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
        possui_agroindustria_propria
        tipo_gestao_unidade
        pessoas_processamento_alimentos
        tipo_estabelecimento
        tipo_pessoa_juridica
        agroindustria_precisa_adaptacao_reforma
        possui_registro_orgao_fiscalizacao_sanitaria
        orgao_fiscalizacao_sanitaria
        dados_producao_agro_industria {
          tipo_regularizacao_uso_recursos_hidricos
          tipo_regularizacao_ambiental
          controla_custos_producao
          local_comercializacao
          valor_total_obtido_pnae
          valor_total_obtido_outros
          total_obtido_pnae
          total_obtido_outros
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
  }
`;

export const produtoresQuery = gql`
  query Produtores($ids: [String]) {
    produtores(ids: $ids) {
      id_pessoa_demeter
      nm_pessoa
      nr_cpf_cnpj
      id_und_empresa
      perfis {
        at_prf_see_propriedade {
          pl_propriedade {
            municipio {
              nm_municipio
            }
            regional_sre
            ger_und_empresa {
              id_und_empresa
              fk_und_empresa
              nm_und_empresa
              ger_und_empresa {
                id_und_empresa
                nm_und_empresa
              }
            }
          }
        }
      }
    }
  }
`;

export const produtorUnidadeEmpresaQuery = gql`
  query GetUnidadeEmpresa($produtorId: Int) {
    getUnidadeEmpresa(produtorId: $produtorId) {
      nr_cpf_cnpj
      id_und_empresa
    }
  }
`;

export const produtorSQLJoinQuery = (cpf: string) => `
SELECT
    p."id",
    p."produtor_id",
    p."propriedade_id",
    s."id",
    s."tipo_perfil",
    s."id_tecnico",
    s."id_cliente",
    s."data_preenchimento",
    -- include other fields from at_prf_see
    pp."id",
    pp."produtor_id",
    pp."propriedade_id",
    g."nr_cpf_cnpj"
FROM "public"."ProdutorPropriedades" p
LEFT JOIN "public"."at_prf_see" s ON p."produtor_id" = s."id_cliente"
LEFT JOIN "public"."ProdutorPropriedades" pp ON pp."produtor_id" = p."produtor_id"
INNER JOIN "public"."ger_pessoa" g ON p."produtor_id" = g."id_pessoa_demeter"
WHERE g."nr_cpf_cnpj" = ${cpf}::text
`;
