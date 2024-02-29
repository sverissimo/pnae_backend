import { Atendimento } from './atendimento.entity';

const input = {
  id_usuario: '3201',
  id_und_empresa: 'H0395',
  data_criacao: '2023-10-26T12:15:19.849Z',
  link_pdf: 'http://teste-pnae-mobile-app.com',
  id_pessoa_demeter: '1707715',
  id_pl_propriedade: '59327',
  sn_pendencia: 0,
  numero_relatorio: '123',
};

describe('Atendimento entity', () => {
  let originalDate: DateConstructor;
  let dateSpy: jest.SpyInstance;

  beforeEach(() => {
    // Save the original Date object and mock it locally for this describe block
    originalDate = global.Date;
    const DATE_TO_USE = new Date('2023-10-26T12:15:19.849Z');
    dateSpy = jest.spyOn(global, 'Date').mockImplementation(() => DATE_TO_USE as unknown as Date);
    Date.prototype.toISOString = jest.fn(() => DATE_TO_USE.toISOString());
  });

  afterAll(() => {
    dateSpy.mockRestore();
    global.Date = originalDate;
    jest.restoreAllMocks();
  });
  describe('constructor', () => {
    it('should set default values', () => {
      const atendimento = Atendimento.create(input);
      expect(atendimento.id_at_acao).toEqual('1');
      expect(atendimento.id_at_status).toEqual(1);
      expect(atendimento.ativo).toEqual(true);
      expect(atendimento.id_und_empresa).toEqual(input.id_und_empresa);
      expect(atendimento.link_pdf).toEqual(input.link_pdf);
      expect(atendimento.data_criacao).toHaveLength(24);
      expect(atendimento.data_atualizacao).toHaveLength(24);
      expect(atendimento.data_inicio_atendimento).toHaveLength(24);
      expect(atendimento.data_fim_atendimento).toHaveLength(24);
      expect(atendimento.at_atendimento_usuario).toEqual({
        id_usuario: input.id_usuario,
        id_und_empresa: input.id_und_empresa,
      });
      expect(atendimento.at_cli_atend_prop).toEqual({
        id_pessoa_demeter: input.id_pessoa_demeter,
        id_pl_propriedade: input.id_pl_propriedade,
        id_und_empresa: input.id_und_empresa,
      });
      expect(atendimento.at_atendimento_indicador).toEqual({
        id_at_indicador: '4026',
        id_und_empresa: input.id_und_empresa,
      });
    });
  });

  describe('getAtendimento', () => {
    it('should return atendimento object without related objects', () => {
      const atendimento = Atendimento.create(input);
      const expected = {
        id_at_acao: '1',
        id_at_status: 1,
        ativo: true,
        id_und_empresa: input.id_und_empresa,
        link_pdf: input.link_pdf,
        data_criacao: input.data_criacao,
        data_atualizacao: input.data_criacao,
        data_inicio_atendimento: input.data_criacao,
        data_fim_atendimento: input.data_criacao,
        sn_pendencia: 0,
      };

      const {
        at_atendimento_usuario,
        at_atendimento_indicador,
        at_cli_atend_prop,
        at_atendimento_indi_camp_acess,
        ...at
      } = atendimento;

      expect(at).toEqual(expected);
    });
  });

  describe('getAtendimentoUsuario', () => {
    it('should return at_atendimento_usuario object', () => {
      const atendimento = Atendimento.create(input);
      const expected = {
        id_usuario: input.id_usuario,
        id_und_empresa: input.id_und_empresa,
      };
      expect(atendimento.at_atendimento_usuario).toEqual(expected);
    });
  });

  describe('getAtendimentoIndicador', () => {
    it('should return at_atendimento_indicador object', () => {
      const atendimento = Atendimento.create(input);
      const expected = {
        id_at_indicador: '4026',
        id_und_empresa: input.id_und_empresa,
      };
      expect(atendimento.at_atendimento_indicador).toEqual(expected);
    });
  });

  describe('getAtendimentoCliAtendProp', () => {
    it('should return at_cli_atend_prop object', () => {
      const atendimento = Atendimento.create(input);
      const expected = {
        id_pessoa_demeter: input.id_pessoa_demeter,
        id_pl_propriedade: input.id_pl_propriedade,
        id_und_empresa: input.id_und_empresa,
      };
      expect(atendimento.at_cli_atend_prop).toEqual(expected);
    });
  });

  describe('createIndicadoresCampoAssessorio', () => {
    it('should return an array of at_atendimento_indi_camp_acess objects', () => {
      const atendimento = Atendimento.create(input);
      const campo1 = atendimento.at_atendimento_indi_camp_acess[0];
      const campo2 = atendimento.at_atendimento_indi_camp_acess[1];

      expect(campo1.id_at_indicador_camp_acessorio).toEqual('13896');
      expect(campo1.valor_campo_acessorio).toEqual('Não');
      expect(campo1.id_und_empresa).toEqual(atendimento.id_und_empresa);

      expect(campo2.id_at_indicador_camp_acessorio).toEqual('13895');
      expect(campo2.valor_campo_acessorio).toEqual(input.numero_relatorio);
      expect(campo2.id_und_empresa).toEqual(atendimento.id_und_empresa);
    });
  });

  describe('updateIndicadoresCampoAssessorio', () => {
    it('should return an array of at_atendimento_indi_camp_acess objects', () => {
      const atendimento = Atendimento.recreate(input);
      const campo1 = atendimento.at_atendimento_indi_camp_acess[0];
      const campo2 = atendimento.at_atendimento_indi_camp_acess[1];

      expect(campo1.id_at_indicador_camp_acessorio).toEqual('13896');
      expect(campo1.valor_campo_acessorio).toEqual('Sim');
      expect(campo1.id_und_empresa).toEqual(atendimento.id_und_empresa);

      expect(campo2.id_at_indicador_camp_acessorio).toEqual('13895');
      expect(campo2.valor_campo_acessorio).toEqual(input.numero_relatorio);
      expect(campo2.id_und_empresa).toEqual(atendimento.id_und_empresa);
    });
  });
});
