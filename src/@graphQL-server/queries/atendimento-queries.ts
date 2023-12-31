import { gql } from 'graphql-request';

export const atendimentoQuery = gql`
  query {
    atendimentos {
      id_at_atendimento
      id_at_acao
      id_at_status
      ativo
      id_und_empresa
      link_pdf
      data_criacao
      data_atualizacao
      data_inicio_atendimento
      data_fim_atendimento
    }
  }
`;

export const createAtendimentoMutation = gql`
  mutation createAtendimento($input: CreateAtendimentoInput!) {
    createAtendimento(createAtendimentoInput: $input) {
      id_at_atendimento
    }
  }
`;

// export const atendimentoQueries = gql`
//   query {
//     atendimento {
//       id_at_atendimento
//       id_at_grupo_indicador
//       id_at_acao
//       at_id_status
//       ativo
//       id_und_empresa
//       link_pdf
//       data_criacao
//       data_atualizacao
//       data_inicio_atendimento
//       data_fim_atendimento
//       atendimento_usuario {
//         id_usuario
//         id_at_atendimento
//         id_und_empresa
//       }
//       atendimento_indicador {
//         id_at_indicador
//         id_at_atendimento
//         id_und_empresa
//       }
//       at_cli_atend_prop {
//         id_pessoa_demeter
//         id_pl_propriedade
//         id_at_atendimento
//         id_und_empresa
//       }
//     }
//   }
// `;
