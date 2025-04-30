import {
  CreateAtendimentoInputDto,
  CreateAtendimentoStorageDto,
} from './create-atendimento.dto';

export interface UpdateAtendimentoInputDto
  extends Partial<CreateAtendimentoInputDto> {
  ativo?: boolean;
}

export interface UpdateAtendimentoStorageDto
  extends Partial<CreateAtendimentoStorageDto> {
  id_at_atendimento?: string;
}
