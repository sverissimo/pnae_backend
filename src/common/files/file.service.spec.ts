jest.mock('graphql-request', () => ({
  gql: (literals: TemplateStringsArray) => literals[0],
  GraphQLClient: jest.fn().mockImplementation(() => ({
    request: jest.fn(),
  })),
}));

jest.mock('fs', () => ({
  promises: {
    mkdir: jest.fn().mockResolvedValue('folderSubPath'),
    writeFile: jest.fn().mockResolvedValue('fileId'),
  },
  existsSync: jest.fn().mockReturnValue(false),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { FileService } from './file.service';
import { existsSync } from 'fs';
import { PrismaService } from 'src/prisma/prisma.service';
import { FileModule } from './file.module';
import { ProdutorService } from 'src/modules/produtor/produtor.service';
import { ProdutorGraphQLAPI } from 'src/@graphQL-server/produtor-api.service';

const relatorioMock = { id: '123', contratoId: 1 };
const produtorMock = { nr_cpf_cnpj: '12345678901', id_und_empresa: 'HA0605' };
const produtorGraphQLAPIMock = {
  getProdutor: jest.fn().mockResolvedValue(produtorMock),
};

const mockPrismaService = {};
const mockProdutorService = {
  getUnidadeEmpresa: jest.fn().mockResolvedValue(produtorMock),
};

describe('FileService', () => {
  let fileService: any;
  beforeEach(async () => {
    process.env.FILES_FOLDER = 'path/to/mock/folder';

    const module: TestingModule = await Test.createTestingModule({
      imports: [FileModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .overrideProvider(ProdutorService)
      .useValue(mockProdutorService)
      .overrideProvider(ProdutorGraphQLAPI)
      .useValue(produtorGraphQLAPIMock)
      .compile();

    fileService = module.get<FileService>(FileService);
  });

  afterEach(() => {
    delete process.env.FILES_FOLDER;
    jest.clearAllMocks();
  });

  it('Should create right folder name given relatorioModel object', async () => {
    fileService.createFileMetadata = jest.fn();
    fileService.saveMetadata = jest.fn();

    await fileService.save([], relatorioMock);

    expect(fileService).toBeDefined();
    expect(existsSync).toHaveBeenCalledWith(
      'path/to/mock/folder/contrato_1/HA0605/12345678901',
    );
  });
});
