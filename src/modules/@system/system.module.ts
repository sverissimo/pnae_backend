import { Module } from '@nestjs/common';
import { SystemService } from './system.service';
import { SystemController } from './system.controller';
import { RelatorioModule } from '../relatorios/relatorios.module';
import { ProdutorModule } from '../produtor/produtor.module';

@Module({
  controllers: [SystemController],
  providers: [SystemService],
  imports: [ProdutorModule, RelatorioModule],
})
export class SystemModule {}
