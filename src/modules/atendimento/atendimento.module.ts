import { Module } from '@nestjs/common';
import { AtendimentoService } from './atendimento.service';
import { AtendimentoController } from './atendimento.controller';
import { AtendimentoGraphQLAPI } from 'src/@graphQL-server/atendimento-api.service';
import { WinstonLoggerService } from 'src/common/logging/winston-logger.service';

@Module({
  controllers: [AtendimentoController],
  providers: [AtendimentoService, AtendimentoGraphQLAPI, WinstonLoggerService],
  exports: [AtendimentoService],
})
export class AtendimentoModule {}
