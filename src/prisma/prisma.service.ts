import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { RelatorioGraphQLAPI } from 'src/@graphQL-server/relatorio-api.service';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    super({
      //log: ['query', 'info', 'warn', 'error'],
      log: ['info', 'warn', 'error'],
    });
  }
  async onModuleInit() {
    await this.$connect();
  }

  async enableShutDownHooks(app: any) {
    this.$on('beforeExit', async () => await app.close());
  }

  /** ### TODO - avaliar necessidade de uso e criar interfaces para repositorioAPI
   console.log("🚀 ~ file: prisma.service.ts:26 ~ PrismaService ~ ### TODO - avaliar necessidade de uso e criar interfaces para repositorioAPI:", ### TODO - avaliar necessidade de uso e criar interfaces para repositorioAPI)
   * Transaction para criar um registro em ambos os banco de dados Demeter e PNAE App */
  async createSync<T>(
    entity: T,
    table: string,
    grapQLAPI: RelatorioGraphQLAPI,
  ): Promise<T & { id: number; createdAt: Date }> {
    return await this.$transaction(async (prismaClient) => {
      try {
        const created = await prismaClient[table].create({ data: entity });
        console.log(
          '🚀 ~ file: prisma.service.ts:26 ~ PrismaService ~ returnawaitthis.$transaction ~ created:',
          created,
        );
        const demeterUpdate = await grapQLAPI.createRelatorio(entity);
        console.log(
          '🚀 ~ file: prisma.service.ts:23 ~ PrismaService ~ returnawaitthis.$transaction ~ demeterUpdate:',
          demeterUpdate,
        );

        /* Parse bigInt?
        for (const key in created) {
          if (typeof created[key] === 'bigint') {
            created[key] = parseInt(created[key]);
          }
        } */

        return created;
      } catch (error) {
        console.log(
          '🚀 ~ file: prisma.service.ts:29 ~ PrismaService ~ returnawaitthis.$transaction ~ error:',
          error,
        );
        throw new Error(error);
      }
    });
  }
}
