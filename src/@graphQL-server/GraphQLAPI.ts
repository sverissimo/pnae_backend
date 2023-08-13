import { GraphQLClient } from 'graphql-request';
import { ConfigService } from '@nestjs/config';
import { Injectable } from '@nestjs/common';

@Injectable()
export abstract class GraphQLAPI {
  client: GraphQLClient;
  url: string;

  constructor(private configService: ConfigService) {
    const token = this.configService.get('token');
    const url = this.configService.get('url');

    this.client = new GraphQLClient(url, {
      headers: {
        authorization: 'Bearer ' + token,
      },
    });
  }

  deserializeBigInt(value: string): bigint {
    return BigInt(value);
  }
}
