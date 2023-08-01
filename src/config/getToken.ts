import * as jwt from 'jsonwebtoken';

export const getToken = () => {
  const auth = process.env.GRAPHQL_SERVER_AUTH;
  const service = { service: 'emater_PNAE' };
  const token = jwt.sign(service, auth);
  return token;
};
