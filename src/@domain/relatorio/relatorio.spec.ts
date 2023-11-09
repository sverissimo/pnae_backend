import { Relatorio } from './relatorio';
import { RelatorioModel } from './relatorio-model';
import relatorios from '../../../_mockData/relatorios.json';

describe('Relatorio domain', () => {
  // const relatorioModel: RelatorioModel = { ...relatorioModel };
  const relatorioModel: RelatorioModel = {
    id: '8cf3bcec-bfb7-450b-95f5-dc667b80be45',
    produtorId: '91025',
    tecnicoId: '2681',
    numeroRelatorio: 99,
    assunto: 'Ass99',
    orientacao: '<div>ndndkw djjd. en</div>',
    pictureURI: '3fda0351-af84-44c4-9c44-f646c6f95028',
    assinaturaURI: '1697836053683',
    outroExtensionista: '237,2309',
    readOnly: false,
    coordenadas: '-43.9505977,-19.8643355',
    createdAt: '2023-10-20T21:08:41.841Z',
  };

  it('should create a Relatorio instance', () => {
    const relatorio = new Relatorio(relatorioModel);
    expect(relatorio).toBeDefined();
  });

  it('should throw an error if produtorId is not defined', () => {
    const relatorio = { ...relatorioModel, produtorId: undefined };

    expect(() => new Relatorio(relatorio)).toThrow('Produtor não pode ser vazio');
  });

  it('should throw an error if tecnicoId is not defined', () => {
    const relatorio = { ...relatorioModel, tecnicoId: undefined };
    expect(() => new Relatorio(relatorio)).toThrow('Técnico não pode ser vazio');
  });

  it('should return the RelatorioModel object', () => {
    const relatorio = new Relatorio(relatorioModel);
    expect(relatorio.toModel()).toEqual(relatorioModel);
  });

  it('should return a RelatorioDto object', () => {
    const relatorio = new Relatorio(relatorioModel);
    const relatorioDto = relatorio.toDto();
    expect(relatorioDto.produtorId).toBe(BigInt(relatorioModel.produtorId));
    expect(relatorioDto.tecnicoId).toBe(BigInt(relatorioModel.tecnicoId));
    expect(relatorioDto.numeroRelatorio).toBe(+relatorioModel.numeroRelatorio);
  });
});
