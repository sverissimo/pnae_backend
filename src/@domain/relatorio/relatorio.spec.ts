import { Relatorio } from './relatorio';
import { RelatorioModel } from './relatorio-model';

describe('Relatorio domain', () => {
  // const relatorioModel: RelatorioModel = { ...relatorioModel };
  const relatorioModel: RelatorioModel = {
    id: '8cf3bcec-bfb7-450b-95f5-dc667b80be45',
    produtorId: '91025',
    tecnicoId: '2681',
    contratoId: 1,
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

  it('should throw an error if numeroRelatorio is not defined', () => {
    const relatorio = { ...relatorioModel, numeroRelatorio: undefined };
    expect(() => new Relatorio(relatorio)).toThrow('Número do relatório não pode ser vazio');
  });

  it('should throw an error if contratoId is not defined', () => {
    const relatorio = { ...relatorioModel, contratoId: undefined };
    expect(() => new Relatorio(relatorio)).toThrow('Contrato não pode ser vazio');
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

  describe('updateFieldsToDTO', () => {
    const update = { ...relatorioModel, updatedAt: '2023-10-20T21:08:41.841Z' };
    it('should return a Partial<RelatorioDto> object with the correct properties', () => {
      const expectedRelatorioDto = {
        id: '8cf3bcec-bfb7-450b-95f5-dc667b80be45',
        produtorId: BigInt(91025),
        tecnicoId: BigInt(2681),
        contratoId: 1,
        numeroRelatorio: 99,
        assunto: 'Ass99',
        orientacao: '<div>ndndkw djjd. en</div>',
        pictureURI: '3fda0351-af84-44c4-9c44-f646c6f95028',
        assinaturaURI: '1697836053683',
        outroExtensionista: '237,2309',
        readOnly: false,
        coordenadas: '-43.9505977,-19.8643355',
        createdAt: new Date('2023-10-20T21:08:41.841Z'),
        updatedAt: new Date('2023-10-20T21:08:41.841Z'),
      };

      const relatorioDto = Relatorio.updateFieldsToDTO(update);

      expect(relatorioDto).toEqual(expectedRelatorioDto);
    });

    it('should return a Partial<RelatorioDto> object with undefined properties when the input has undefined properties', () => {
      const update = {
        orientacao: '<div>ndndkw djjd. en</div>',
        assinaturaURI: '1697836053683',
        outroExtensionista: 'Changed outroExtensionista',
        coordenadas: '-43.9505977,-19.8643355',
        updatedAt: '2023-10-20T21:08:41.841Z',
      };

      const expectedRelatorioDto = {
        orientacao: '<div>ndndkw djjd. en</div>',
        assinaturaURI: '1697836053683',
        outroExtensionista: 'Changed outroExtensionista',
        coordenadas: '-43.9505977,-19.8643355',
        updatedAt: new Date('2023-10-20T21:08:41.841Z'),
      };

      const relatorioDto = Relatorio.updateFieldsToDTO(update);

      expect(relatorioDto).toEqual(expectedRelatorioDto);
    });

    it('should return an object with parsed produtorID, tecnicoId, numeroRelatorio and readOnly props', () => {
      const relatorioModel = {
        id: '8cf3bcec-bfb7-450b-95f5-dc667b80be45',
        produtorId: '91025',
        tecnicoId: '2681',
        numeroRelatorio: '99',
        orientacao: '<div>ndndkw djjd. en</div>',
        pictureURI: '3fda0351-af84-44c4-9c44-f646c6f95028',
        assinaturaURI: '1697836053683',
        outroExtensionista: '237,2309',
        readOnly: 'true',
        coordenadas: '-43.9505977,-19.8643355',
        updatedAt: '2023-10-20T21:08:41.841Z',
      } as any;

      const expectedRelatorioDto = {
        id: '8cf3bcec-bfb7-450b-95f5-dc667b80be45',
        produtorId: BigInt(91025),
        tecnicoId: BigInt(2681),
        numeroRelatorio: 99,
        orientacao: '<div>ndndkw djjd. en</div>',
        pictureURI: '3fda0351-af84-44c4-9c44-f646c6f95028',
        assinaturaURI: '1697836053683',
        outroExtensionista: '237,2309',
        readOnly: true,
        coordenadas: '-43.9505977,-19.8643355',
        updatedAt: new Date('2023-10-20T21:08:41.841Z'),
      };

      const relatorioDto = Relatorio.updateFieldsToDTO(relatorioModel);

      expect(relatorioDto).toEqual(expectedRelatorioDto);
    });

    it('should return a Partial<RelatorioDto> object with readOnly set to false when the input has readOnly set to false', () => {
      const relatorioModel = {
        tecnicoId: '2681',
        numeroRelatorio: 99,
        assunto: 'Ass99',
        orientacao: '<div>ndndkw djjd. en</div>',
        pictureURI: '3fda0351-af84-44c4-9c44-f646c6f95028',
        assinaturaURI: '1697836053683',
        outroExtensionista: '237,2309',
        readOnly: 'false',
        coordenadas: '-43.9505977,-19.8643355',
        createdAt: '2023-10-20T21:08:41.841Z',
        updatedAt: '2023-10-20T21:08:41.841Z',
      } as any;

      const expectedRelatorioDto = {
        tecnicoId: BigInt(2681),
        numeroRelatorio: 99,
        assunto: 'Ass99',
        orientacao: '<div>ndndkw djjd. en</div>',
        pictureURI: '3fda0351-af84-44c4-9c44-f646c6f95028',
        assinaturaURI: '1697836053683',
        outroExtensionista: '237,2309',
        readOnly: false,
        coordenadas: '-43.9505977,-19.8643355',
        createdAt: new Date('2023-10-20T21:08:41.841Z'),
        updatedAt: new Date('2023-10-20T21:08:41.841Z'),
      };

      const relatorioDto = Relatorio.updateFieldsToDTO(relatorioModel);

      expect(relatorioDto).toEqual(expectedRelatorioDto);
    });

    it('should return a Partial<RelatorioDto> object with readOnly set to undefined when the input has readOnly set to undefined', () => {
      const relatorioModel = {
        produtorId: undefined,
        tecnicoId: undefined,
        numeroRelatorio: undefined,
        assunto: 'Ass99',
        orientacao: '<div>ndndkw djjd. en</div>',
        pictureURI: '3fda0351-af84-44c4-9c44-f646c6f95028',
        assinaturaURI: undefined,
        outroExtensionista: undefined,
        readOnly: undefined,
        coordenadas: '-43.9505977,-19.8643355',
        updatedAt: '2023-10-20T21:08:41.841Z',
      };

      const expectedRelatorioDto = {
        assunto: 'Ass99',
        orientacao: '<div>ndndkw djjd. en</div>',
        pictureURI: '3fda0351-af84-44c4-9c44-f646c6f95028',
        coordenadas: '-43.9505977,-19.8643355',
        updatedAt: new Date('2023-10-20T21:08:41.841Z'),
      };

      const relatorioDto = Relatorio.updateFieldsToDTO(relatorioModel);

      expect(relatorioDto).toEqual(expectedRelatorioDto);
    });
  });
});
