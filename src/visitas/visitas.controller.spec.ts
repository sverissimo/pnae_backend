import { Test, TestingModule } from '@nestjs/testing';
import { VisitasController } from './visitas.controller';
import { VisitasService } from './visitas.service';

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
