import { gql } from 'graphql-request';

export const usuarioQuery = gql`
  query Usuario($id: String) {
    usuario(id: $id) {
      id_usuario
      matricula_usuario
      digito_matricula
      nome_usuario
      login_usuario
    }
  }
`;
export const usuarioByMatriculaQuery = gql`
  query Usuario($id: String, $matricula_usuario: String) {
    usuario(id: $id, matricula_usuario: $matricula_usuario) {
      id_usuario
      matricula_usuario
      digito_matricula
      nome_usuario
      login_usuario
    }
  }
`;

export const getUsuariosQuery = gql`
  query Usuarios($ids: String, $matriculas: String) {
    usuarios(ids: $ids, matriculas: $matriculas) {
      id_usuario
      matricula_usuario
      digito_matricula
      nome_usuario
      login_usuario
    }
  }
`;
