import { CreateAtendimentoDto } from '../dto/create-atendimento.dto';

type at_atendimento_usuario = {
  id_at_atendimento?: string;
  id_usuario: string;
  id_und_empresa: string;
};

type at_atendimento_indicador = {
  id_at_atendimento_indicador?: string;
  id_at_atendimento?: string;
  id_at_indicador: string;
  id_und_empresa: string;
};

type at_cli_atend_prop = {
  id_at_cli_atend_prop?: string;
  id_at_atendimento?: string;
  id_pessoa_demeter: string;
  id_pl_propriedade: string;
  id_und_empresa: string;
};

export class Atendimento {
  id_at_atendimento?: string;
  id_at_acao: string;
  id_at_status: number;
  ativo: boolean;
  id_und_empresa: string;
  link_pdf: string;
  data_criacao: string;
  data_inicio_atendimento: string;
  data_fim_atendimento: string;
  data_atualizacao: string;
  sn_pendencia: number;

  at_atendimento_usuario?: at_atendimento_usuario;
  atendimento_indicador?: at_atendimento_indicador;
  at_cli_atend_prop?: at_cli_atend_prop;

  constructor(input: CreateAtendimentoDto) {
    this.id_at_acao = '1';
    this.id_at_status = 1;
    this.ativo = true;
    this.sn_pendencia = 0;
    const createdAt = new Date().toISOString();

    this.id_und_empresa = input.id_und_empresa;
    this.link_pdf = input.link_pdf;
    this.data_criacao = createdAt;
    this.data_atualizacao = createdAt;
    this.data_inicio_atendimento = createdAt;
    this.data_fim_atendimento = createdAt;

    this.at_atendimento_usuario = {
      id_usuario: input.id_usuario,
      id_und_empresa: input.id_und_empresa,
    };

    this.at_cli_atend_prop = {
      id_pessoa_demeter: input.id_pessoa_demeter,
      id_pl_propriedade: input.id_pl_propriedade,
      id_und_empresa: input.id_und_empresa,
    };

    this.atendimento_indicador = {
      id_at_indicador: '4026',
      id_und_empresa: input.id_und_empresa,
    };
  }
  addAtendimentoId(id: string) {
    this.id_at_atendimento = id;
    this.at_atendimento_usuario.id_at_atendimento = id;
    this.atendimento_indicador.id_at_atendimento = id;
    this.at_cli_atend_prop.id_at_atendimento = id;
  }

  getAtendimento() {
    const { at_atendimento_usuario, atendimento_indicador, at_cli_atend_prop, ...atendimento } =
      this;
    return atendimento;
  }

  getAtendimentoUsuario() {
    return this.at_atendimento_usuario;
  }

  getAtendimentoIndicador() {
    return this.atendimento_indicador;
  }

  getAtendimentoCliAtendProp() {
    return this.at_cli_atend_prop;
  }
}
