import { Module } from '@nestjs/common';
import { AtendimentoService } from './atendimento.service';
import { AtendimentoController } from './atendimento.controller';
import { AtendimentoGraphQLAPI } from 'src/@graphQL-server/atendimento-api.service';
import { WinstonLoggerService } from 'src/logging/winston-logger.service';
import { RestAPI } from 'src/@rest-api-server/rest-api.service';
import { REDIS_CLIENT } from 'src/modules/relatorios/cache/cache.constants';
import { RedisInvalidator } from 'src/modules/relatorios/cache/redis-invalidator';
import { CachedMunicipiosReader } from 'src/modules/relatorios/cache/cached-municipios.reader';
import { createRedisConnection } from 'src/redis/redis.provider';

@Module({
  controllers: [AtendimentoController],
  providers: [
    AtendimentoService,
    AtendimentoGraphQLAPI,
    RestAPI,
    WinstonLoggerService,
    RedisInvalidator,
    CachedMunicipiosReader,
    { provide: REDIS_CLIENT, useFactory: createRedisConnection },
  ],
  exports: [AtendimentoService],
})
export class AtendimentoModule {}
