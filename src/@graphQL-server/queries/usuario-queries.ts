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
