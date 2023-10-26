import { Test, TestingModule } from '@nestjs/testing';
import { AtendimentoController } from './atendimento.controller';
import { AtendimentoService } from './atendimento.service';

describe('AtendimentoController', () => {
  let controller: AtendimentoController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AtendimentoController],
      providers: [AtendimentoService],
    }).compile();

    controller = module.get<AtendimentoController>(AtendimentoController);
  });

  it.skip('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
