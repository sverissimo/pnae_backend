import { CachedMunicipiosReader } from './cached-municipios.reader';

describe('CachedMunicipiosReader', () => {
  const municipios = [
    {
      id_und_empresa: 'H1234',
      nome_municipio: 'Viçosa',
      municipio_id: 1,
      regional_id: 'G0040',
      nome_regional: 'Regional Viçosa',
    },
    {
      id_und_empresa: 'H9999',
      nome_municipio: null,
      municipio_id: null,
      regional_id: 'G0099',
      nome_regional: null,
    },
  ];

  const buildReader = (cached?: unknown) => {
    const redis = {
      get: jest.fn().mockResolvedValue(cached ? JSON.stringify(cached) : null),
      setex: jest.fn().mockResolvedValue('OK'),
    };
    const restAPI = {
      getMunicipiosEmater: jest.fn().mockResolvedValue(municipios),
    };
    const logger = { error: jest.fn() };

    return {
      reader: new CachedMunicipiosReader(redis as any, restAPI as any, logger as any),
      redis,
      restAPI,
    };
  };

  it('keeps the existing unidade→regional map behavior', async () => {
    const { reader } = buildReader();

    await expect(reader.getUnidadeToRegionalMap()).resolves.toEqual(
      new Map([
        ['H1234', 'G0040'],
        ['H9999', 'G0099'],
      ]),
    );
  });

  it('builds a unidade→localidade map from the same cached municipios data', async () => {
    const { reader, restAPI } = buildReader();

    const map = await reader.getUnidadeToLocalidadeMap();

    expect(map.get('H1234')).toEqual({
      nomeMunicipio: 'Viçosa',
      id_reg_empresa: 'G0040',
      nomeRegional: 'Regional Viçosa',
    });
    expect(map.get('H9999')).toEqual({
      nomeMunicipio: null,
      id_reg_empresa: 'G0099',
      nomeRegional: null,
    });
    expect(restAPI.getMunicipiosEmater).toHaveBeenCalledTimes(1);
  });

  it('loads from redis without calling the REST API when cached', async () => {
    const { reader, restAPI } = buildReader(municipios);

    const map = await reader.getUnidadeToLocalidadeMap();

    expect(map.get('H1234')?.nomeMunicipio).toBe('Viçosa');
    expect(restAPI.getMunicipiosEmater).not.toHaveBeenCalled();
  });
});
