import { gql } from 'graphql-request';

export const relatorioQuery = gql`
  query Relatorio($id: Int, $produtorId: Int) {
    relatorio(id: $id, produtorId: $produtorId) {
      assunto
      orientacao
      produtorId
    }
  }
`;

export const relatoriosFindAllQuery = gql`
  query Relatorios {
    relatorios {
      assunto
      orientacao
    }
  }
`;

export const createRelatorioMutation = gql`
  mutation CreateRelatorio($createRelatorioInput: CreateRelatorioInput) {
    createRelatorio(createRelatorioInput: $createRelatorioInput) {
      id
      produtorId
      numeroRelatorio
      assunto
      orientacao
      createdAt
    }
  }
`;

export const updateRelatorioMutation = gql`
  mutation UpdateRelatorio($input: UpdateRelatorioInput) {
    updateRelatorio(input: $input) {
      produtorId
      numeroRelatorio
      assunto
      orientacao
      createdAt
    }
  }
`;

export const deleteRelatorioMutation = gql`
  mutation DeleteRelatorio($id: Int) {
    deleteRelatorio(id: $id) {
      id
      produtorId
      assunto
      orientacao
    }
  }
`;
