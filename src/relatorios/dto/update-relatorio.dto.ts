import { PartialType } from '@nestjs/mapped-types';
import { CreateRelatorioDto } from './create-relatorio.dto';

export class UpdateRelatorioDto extends PartialType(CreateRelatorioDto) {
  id: string;
  updatedAt?: String;
}
