import { PartialType } from '@nestjs/mapped-types';
import { CreateVisitaDto } from './create-visita.dto';

export class UpdateVisitaDto extends PartialType(CreateVisitaDto) {}
