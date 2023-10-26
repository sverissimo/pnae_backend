import { Module } from '@nestjs/common';
import { AtendimentoService } from './atendimento.service';
import { AtendimentoController } from './atendimento.controller';
import { AtendimentoGraphQLAPI } from 'src/@graphQL-server/atendimento-api.service';

@Module({
  controllers: [AtendimentoController],
  providers: [AtendimentoService, AtendimentoGraphQLAPI],
})
export class AtendimentoModule {}
