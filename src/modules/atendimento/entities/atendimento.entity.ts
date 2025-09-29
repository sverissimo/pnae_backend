import { CreateAtendimentoInputDto } from '../dto/create-atendimento.dto';

export type at_atendimento_usuario = {
  id_at_atendimento?: string;
  id_usuario: string;
  id_und_empresa: string;
};

export type at_atendimento_indicador = {
  id_at_atendimento_indicador?: string;
  id_at_atendimento?: string;
  id_at_indicador: string;
  id_und_empresa: string;
};

export type at_cli_atend_prop = {
  id_at_cli_atend_prop?: string;
  id_at_atendimento?: string;
  id_pessoa_demeter: string;
  id_pl_propriedade: string;
  id_und_empresa: string;
};

export type at_atendimento_indi_camp_acess = {
  id_at_aten_indi_camp_acess?: string;
  id_at_atendimento_indicador?: string;
  id_at_indicador_camp_acessorio?: string;
  valor_campo_acessorio?: string | null;
  possui_lista_valores?: boolean | null;
  id_und_empresa?: string | null;
  id_sincronismo?: string | null;
  id_sincronismo_aten_indicador?: string | null;
  dt_update_record?: Date | null;
};

export class Atendimento {
  private temas_atendimento_list: string[] = [
    'Agroindústria',
    'Culturas',
    'Pecuária',
  ];
  id_at_atendimento?: string;
  id_at_acao: string;
  id_at_status: number;
  ativo: boolean;
  link_pdf: string;
  temas_atendimento?: string[];
  data_inicio_atendimento: string;
  data_see?: Date | null;
  data_fim_atendimento: string;
  sn_pendencia: number;
  id_at_anterior?: string;
  sn_validado?: number | null;
  dt_export_ok?: Date | null;
  id_und_empresa: string;
  fk_und_empresa?: string | null;
  data_atualizacao?: string;
  data_criacao: string;

  at_atendimento_usuario?: at_atendimento_usuario;
  at_atendimento_indicador?: at_atendimento_indicador;
  at_cli_atend_prop?: at_cli_atend_prop;
  at_atendimento_indi_camp_acess?: at_atendimento_indi_camp_acess[];

  constructor(input: CreateAtendimentoInputDto) {
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
      id_at_anterior,
      temas_atendimento,
    } = input;

    this.id_und_empresa = id_und_empresa;
    this.link_pdf = link_pdf;
    this.temas_atendimento = temas_atendimento;
    this.data_criacao = createdAt;
    this.data_atualizacao = createdAt;
    this.data_inicio_atendimento = createdAt;
    this.data_fim_atendimento = createdAt;
    this.id_at_anterior = id_at_anterior || undefined;

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
      id_at_indicador: '4550',
      id_und_empresa,
    };
  }

  static create(input: CreateAtendimentoInputDto) {
    const instance = new Atendimento(input);
    instance.at_atendimento_indi_camp_acess =
      instance.createIndicadoresCampoAssessorio(input.numero_relatorio);
    return instance;
  }

  static recreate(input: CreateAtendimentoInputDto) {
    const instance = new Atendimento(input);
    instance.at_atendimento_indi_camp_acess =
      instance.updateIndicadoresCampoAssessorio(input.numero_relatorio);
    return instance;
  }

  static temasAtendimentoListToDTO(temas_atendimento: string) {
    const temas_atendimento_list = ['Agroindústria', 'Culturas', 'Pecuária'];
    return temas_atendimento
      .split(',')
      .reduce((acc, curr) => {
        if (!temas_atendimento) return acc;
        const atendimentoCode = temas_atendimento_list.findIndex(
          (item) => item === curr,
        );
        if (atendimentoCode !== -1) {
          return acc + String(atendimentoCode + 1) + ';';
        }
        return acc;
      }, '')
      .replace(/;$/, '');
  }

  private createIndicadoresCampoAssessorio(
    numero_relatorio: string,
  ): at_atendimento_indi_camp_acess[] {
    const valor_campo_acessorio = this.createTemasAtendimentoDTO();
    return [
      {
        id_at_indicador_camp_acessorio: '14032',
        valor_campo_acessorio: String(numero_relatorio),
        id_und_empresa: this.id_und_empresa,
      },
      {
        id_at_indicador_camp_acessorio: '14033',
        valor_campo_acessorio,
        id_und_empresa: this.id_und_empresa,
      },
      // VERIFICAR SE VAI MANTER PARA O NOVO CONTRATO
      // {
      //   id_at_indicador_camp_acessorio: '13895',
      //   valor_campo_acessorio: 'Não',
      //   id_und_empresa: this.id_und_empresa,
      // },
    ];
  }

  private updateIndicadoresCampoAssessorio(
    numero_relatorio,
  ): at_atendimento_indi_camp_acess[] {
    const valor_campo_acessorio = this.createTemasAtendimentoDTO();
    return [
      {
        id_at_indicador_camp_acessorio: '14032',
        valor_campo_acessorio: String(numero_relatorio),
        id_und_empresa: this.id_und_empresa,
      },
      {
        id_at_indicador_camp_acessorio: '14033',
        valor_campo_acessorio,
        id_und_empresa: this.id_und_empresa,
      },
      // VERIFICAR SE VAI MANTER PARA O NOVO CONTRATO
      // {
      //   id_at_indicador_camp_acessorio: '13895',
      //   valor_campo_acessorio: 'Sim',
      //   id_und_empresa: this.id_und_empresa,
      // },
    ];
  }

  private createTemasAtendimentoDTO(): string {
    const temasAtendimento = this.temas_atendimento || [];
    return temasAtendimento
      .reduce((acc, curr) => {
        if (!this.temas_atendimento) return acc;
        const atendimentoCode = this.temas_atendimento_list.findIndex(
          (item) => item === curr,
        );
        if (atendimentoCode !== -1) {
          return acc + String(atendimentoCode + 1) + ';';
        }
        return acc;
      }, '')
      .replace(/;$/, '');
  }
}
