import { Module } from '@nestjs/common';
import { UsuarioController } from './usuario.controller';
import { UsuarioService } from './usuario.service';
import { RestAPI } from 'src/@rest-api-server/rest-api.service';
import { WinstonLogger } from 'nest-winston';
import { UsuarioGraphQLAPI } from 'src/@graphQL-server/usuario-api.service';
import { JwtModule } from '@nestjs/jwt';

@Module({
  controllers: [UsuarioController],
  providers: [RestAPI, UsuarioGraphQLAPI, WinstonLogger, UsuarioService],
  imports: [JwtModule],
  exports: [UsuarioService],
})
export class UsuarioModule {}
