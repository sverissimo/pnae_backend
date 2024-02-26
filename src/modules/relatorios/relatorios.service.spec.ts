jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn().mockResolvedValue('folderSubPath'),
    writeFile: jest.fn().mockResolvedValue('fileId'),
  },
  createWriteStream: jest.fn(),
  existsSync: jest.fn().mockReturnValue(false),
  mkdirSync: jest.fn().mockResolvedValue('folderSubPath'),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { RelatorioService } from './relatorios.service';
import { RelatorioModel } from 'src/@domain/relatorio/relatorio-model';
import { RelatorioModule } from './relatorios.module';
import { PrismaService } from 'src/prisma/prisma.service';
import { UsuarioGraphQLAPI } from 'src/@graphQL-server/usuario-api.service';
import { ProdutorGraphQLAPI } from 'src/@graphQL-server/produtor-api.service';
import { AtendimentoService } from '../atendimento/atendimento.service';
import { FileService } from 'src/common/files/file.service';
import { RestAPI } from 'src/@rest-api-server/rest-api.service';
import relatorioInput from '../../../db/mockData/create-relatorio-input.dto.json';
// import { WinstonLoggerService } from 'src/common/logging/winston-logger.service';

jest.mock('src/prisma/prisma.service');
jest.mock('src/@graphQL-server/usuario-api.service');
jest.mock('src/@graphQL-server/produtor-api.service');
jest.mock('../atendimento/atendimento.service');
jest.mock('src/common/files/file.service');
jest.mock('src/@rest-api-server/rest-api.service');
jest.mock('src/common/logging/winston-logger.service');

describe('RelatorioService', () => {
  let relatorioService: RelatorioService;

  beforeEach(async () => {
    // const module: TestingModule = await Test.createTestingModule({
    //   imports: [RelatorioModule],
    // })
    // .overrideProvider(PrismaService)
    // .useValue({})
    // .overrideProvider(UsuarioGraphQLAPI)
    // .useValue({})
    // .overrideProvider(ProdutorGraphQLAPI)
    // .useValue({})
    // .overrideProvider(AtendimentoService)
    // .useValue({})
    // .overrideProvider(FileService)
    // .useValue({})
    // .overrideProvider(RestAPI)
    // .useValue({})
    // .overrideProvider(WinstonLoggerService)
    // .useValue({})
    //   .compile();
    // relatorioService = module.get<RelatorioService>(RelatorioService);
  });

  it('should be defined', () => {
    console.log('To be defined');
    // expect(relatorioService).toBeDefined();
  });

  it('Testing create new relatorio', async () => {
    // const result = await relatorioService.create(relatorioInput);
    // console.log('🚀 ~ file: relatorios.service.spec.ts:27 ~ it ~ result:', result);
    // expect(result).toBeDefined();
  });
});
