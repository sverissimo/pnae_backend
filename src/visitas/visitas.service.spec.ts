import { Test, TestingModule } from '@nestjs/testing';
import { VisitasService } from './visitas.service';

describe('VisitasService', () => {
  let service: VisitasService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [VisitasService],
    }).compile();

    service = module.get<VisitasService>(VisitasService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
