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

type at_atendimento_indi_camp_acess = {
  id_at_aten_indi_camp_acess?: string;
  id_at_atendimento_indicador?: string;
  id_at_indicador_camp_acessorio?: string;
  valor_campo_acessorio?: string | null;
  id_und_empresa?: string | null;
  id_sincronismo?: string | null;
  id_sincronismo_aten_indicador?: string | null;
  dt_update_record?: Date | null;
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
  at_atendimento_indicador?: at_atendimento_indicador;
  at_cli_atend_prop?: at_cli_atend_prop;
  at_atendimento_indi_camp_acess?: at_atendimento_indi_camp_acess[];

  constructor(input: CreateAtendimentoDto) {
    this.id_at_acao = '1';
    this.id_at_status = 1;
    this.ativo = true;
    this.sn_pendencia = 0;
    const createdAt = new Date().toISOString();

    const {
      id_pessoa_demeter,
      id_pl_propriedade,
      id_und_empresa,
      id_usuario,
      link_pdf,
      numero_relatorio,
    } = input;

    this.id_und_empresa = id_und_empresa;
    this.link_pdf = link_pdf;
    this.data_criacao = createdAt;
    this.data_atualizacao = createdAt;
    this.data_inicio_atendimento = createdAt;
    this.data_fim_atendimento = createdAt;

    this.at_atendimento_usuario = {
      id_usuario,
      id_und_empresa,
    };

    this.at_cli_atend_prop = {
      id_pessoa_demeter,
      id_pl_propriedade,
      id_und_empresa,
    };

    this.at_atendimento_indicador = {
      id_at_indicador: '4026',
      id_und_empresa,
    };

    this.at_atendimento_indi_camp_acess = this.createIndicadoresCampoAssessorio(numero_relatorio);
  }

  addAtendimentoId(id: string) {
    this.id_at_atendimento = id;
    this.at_atendimento_usuario.id_at_atendimento = id;
    this.at_atendimento_indicador.id_at_atendimento = id;
    this.at_cli_atend_prop.id_at_atendimento = id;
  }

  createIndicadoresCampoAssessorio(numero_relatorio): at_atendimento_indi_camp_acess[] {
    return [
      {
        id_at_indicador_camp_acessorio: '13896',
        valor_campo_acessorio: 'Não',
        id_und_empresa: this.id_und_empresa,
      },
      {
        id_at_indicador_camp_acessorio: '13895',
        valor_campo_acessorio: String(numero_relatorio),
        id_und_empresa: this.id_und_empresa,
      },
    ];
  }

  getAtendimento() {
    const {
      at_atendimento_usuario,
      at_atendimento_indicador,
      at_cli_atend_prop,
      at_atendimento_indi_camp_acess,
      ...atendimento
    } = this;
    return atendimento;
  }

  getAtendimentoUsuario() {
    return this.at_atendimento_usuario;
  }

  getAtendimentoIndicador() {
    return this.at_atendimento_indicador;
  }

  getAtendimentoCliAtendProp() {
    return this.at_cli_atend_prop;
  }
}
