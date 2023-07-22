import { Test, TestingModule } from '@nestjs/testing';
import { VisitasController } from './relatorios.controller';
import { VisitasService } from './relatorios.service';

describe('VisitasController', () => {
  let controller: VisitasController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VisitasController],
      providers: [VisitasService],
    }).compile();

    controller = module.get<VisitasController>(VisitasController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
