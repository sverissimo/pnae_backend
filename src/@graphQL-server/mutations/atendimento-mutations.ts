import { gql } from 'graphql-request';
export const createAtendimentoMutation = gql`
  mutation createAtendimento($input: CreateAtendimentoInput) {
    id_at_atendimento: createAtendimento(input: $input)
  }
`;
