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
      propriedades {
        id_pl_propriedade
        nome_propriedade
        area_total
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
        usuario {
          nome_usuario
          matricula_usuario
          digito_matricula
          login_usuario
          id_usuario
        }
        at_prf_see_propriedade {
          atividade
          producao_dedicada_pnae
        }
        dados_producao_agro_industria {
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
        dados_producao_in_natura {
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
      }
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
