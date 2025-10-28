import { Module } from '@nestjs/common';
import { PerfilService } from './perfil.service';
import { PerfilController } from './perfil.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { PerfilGraphQLAPI } from 'src/@graphQL-server/perfil-api.service';
import { RestAPI } from 'src/@rest-api-server/rest-api.service';
import { WinstonLoggerService } from 'src/common/logging/winston-logger.service';

@Module({
  controllers: [PerfilController],
  providers: [
    PerfilService,
    PrismaService,
    PerfilGraphQLAPI,
    RestAPI,
    { provide: WinstonLoggerService, useClass: WinstonLoggerService },
  ],
  exports: [PerfilService],
})
export class PerfilModule {}
