import { getToken } from './getToken';

export const config = () => ({
  url: process.env.GRAPHQL_SERVER_URL,
  token: getToken(),
});
