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

export const getUsuariosQuery = gql`
  query Usuarios($ids: String, $matriculas: String) {
    usuarios(ids: $ids, matriculas: $matriculas) {
      id_usuario
      matricula_usuario
      digito_matricula
      nome_usuario
      login_usuario
      id_und_empresa
      perfil_demeter {
        perfil {
          descricao_perfil
        }
      }
    }
  }
`;
