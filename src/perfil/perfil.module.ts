import { Module } from '@nestjs/common';
import { PerfilService } from './perfil.service';
import { PerfilController } from './perfil.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { GraphQLApiGateway } from 'src/common/graphql-api.service';

@Module({
  controllers: [PerfilController],
  providers: [PerfilService, PrismaService, GraphQLApiGateway],
})
export class PerfilModule {}
