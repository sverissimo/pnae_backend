import { Test, TestingModule } from '@nestjs/testing';
import { AtendimentoService } from './atendimento.service';

describe('AtendimentoService', () => {
  let service: AtendimentoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AtendimentoService],
    }).compile();

    service = module.get<AtendimentoService>(AtendimentoService);
  });

  it.skip('should be defined', () => {
    expect(service).toBeDefined();
  });
});
