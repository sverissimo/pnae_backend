import { Atendimento } from './atendimento.entity';

const input = {
  id_usuario: '3201',
  id_und_empresa: 'H0395',
  data_criacao: '2023-10-26T12:15:19.849Z',
  link_pdf: 'http://teste-pnae-mobile-app.com',
  id_pessoa_demeter: '1707715',
  id_pl_propriedade: '59327',
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
      const atendimento = new Atendimento(input);
      expect(atendimento.id_at_acao).toEqual('2');
      expect(atendimento.id_at_status).toEqual(1);
      expect(atendimento.ativo).toEqual(true);
      expect(atendimento.id_und_empresa).toEqual(input.id_und_empresa);
      expect(atendimento.link_pdf).toEqual(input.link_pdf);
      expect(atendimento.data_criacao).toHaveLength(24);
      expect(atendimento.data_atualizacao).toHaveLength(24);
      expect(atendimento.data_inicio_atendimento).toHaveLength(24);
      expect(atendimento.data_fim_atendimento).toHaveLength(24);
      expect(atendimento.atendimento_usuario).toEqual({
        id_usuario: input.id_usuario,
        id_und_empresa: input.id_und_empresa,
      });
      expect(atendimento.at_cli_atend_prop).toEqual({
        id_pessoa_demeter: input.id_pessoa_demeter,
        id_pl_propriedade: input.id_pl_propriedade,
        id_und_empresa: input.id_und_empresa,
      });
      expect(atendimento.atendimento_indicador).toEqual({
        id_at_indicador: '4026',
        id_und_empresa: input.id_und_empresa,
      });
    });
  });

  describe('addAtendimentoId', () => {
    it('should set id_at_atendimento and update related objects', () => {
      const atendimento = new Atendimento(input);
      const id = '123';
      atendimento.addAtendimentoId(id);
      expect(atendimento.id_at_atendimento).toEqual(id);
      expect(atendimento.atendimento_usuario?.id_at_atendimento).toEqual(id);
      expect(atendimento.atendimento_indicador?.id_at_atendimento).toEqual(id);
      expect(atendimento.at_cli_atend_prop?.id_at_atendimento).toEqual(id);
    });
  });

  describe('getAtendimento', () => {
    it('should return atendimento object without related objects', () => {
      const atendimento = new Atendimento(input);
      const expected = {
        id_at_acao: '2',
        id_at_status: 1,
        ativo: true,
        id_und_empresa: input.id_und_empresa,
        link_pdf: input.link_pdf,
        data_criacao: input.data_criacao,
        data_atualizacao: input.data_criacao,
        data_inicio_atendimento: input.data_criacao,
        data_fim_atendimento: input.data_criacao,
      };
      expect(atendimento.getAtendimento()).toEqual(expected);
    });
  });

  describe('getAtendimentoUsuario', () => {
    it('should return atendimento_usuario object', () => {
      const atendimento = new Atendimento(input);
      const expected = {
        id_usuario: input.id_usuario,
        id_und_empresa: input.id_und_empresa,
      };
      expect(atendimento.getAtendimentoUsuario()).toEqual(expected);
    });
  });

  describe('getAtendimentoIndicador', () => {
    it('should return atendimento_indicador object', () => {
      const atendimento = new Atendimento(input);
      const expected = {
        id_at_indicador: '4026',
        id_und_empresa: input.id_und_empresa,
      };
      expect(atendimento.getAtendimentoIndicador()).toEqual(expected);
    });
  });

  describe('getAtendimentoCliAtendProp', () => {
    it('should return at_cli_atend_prop object', () => {
      const atendimento = new Atendimento(input);
      const expected = {
        id_pessoa_demeter: input.id_pessoa_demeter,
        id_pl_propriedade: input.id_pl_propriedade,
        id_und_empresa: input.id_und_empresa,
      };
      expect(atendimento.getAtendimentoCliAtendProp()).toEqual(expected);
    });
  });
});
