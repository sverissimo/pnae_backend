import { Test, TestingModule } from '@nestjs/testing';
import { RelatorioController } from './relatorios.controller';
import { RelatorioService } from './relatorios.service';

describe('RelatorioController', () => {
  let controller: RelatorioController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RelatorioController],
      providers: [RelatorioService],
    }).compile();

    controller = module.get<RelatorioController>(RelatorioController);
  });

  it('should be defined', async () => {
    const a = await controller.update('3', { produtorId: 1667278 });
    console.log('🚀 ~ file: visitas.controller.spec.ts:19 ~ it ~ a:', a);
    expect(controller).toBeDefined();
  });
});
