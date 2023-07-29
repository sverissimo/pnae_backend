import { Test, TestingModule } from '@nestjs/testing';
import { RelatorioService } from './relatorios.service';

describe('RelatorioService', () => {
  let service: RelatorioService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RelatorioService],
    }).compile();

    service = module.get<RelatorioService>(RelatorioService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('Testing create new relatorio', async () => {
    const newRelatorio = {
      produtorId: 12808,
      numeroRelatorio: 2,
      assunto: 'Ass 2 Joseli',
      orientacao: 'whatever 2',
    };
    const result = await service.create(newRelatorio);
    console.log('🚀 ~ file: relatorios.service.spec.ts:27 ~ it ~ result:', result);
    expect(result).toBeGreaterThan(0);
  });
});
