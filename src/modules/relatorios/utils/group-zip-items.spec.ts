import { ZipRelatorioItem } from '../dto/zip-job.dtos';
import { groupZipItemsByRegional } from './group-zip-items';

const pnaeItem = (
  atendimentoId: string,
  regional: string,
  municipio: string,
): ZipRelatorioItem => ({
  source: 'pnae',
  atendimentoId,
  regional,
  municipio,
  relatorio: { id: `r${atendimentoId}` } as any,
});

const demeterItem = (
  atendimentoId: string,
  regional: string,
  municipio: string,
): ZipRelatorioItem => ({
  source: 'demeter',
  atendimentoId,
  regional,
  municipio,
  demeter: { id_at_atendimento: atendimentoId } as any,
});

describe('groupZipItemsByRegional', () => {
  it('buckets mixed PNAE and Demeter items by regional then município, sorted alphabetically', () => {
    const groups = groupZipItemsByRegional([
      demeterItem('4', 'SRE Sul', 'Varginha'),
      pnaeItem('1', 'SRE Norte', 'Montes Claros'),
      pnaeItem('2', 'SRE Sul', 'Lavras'),
      demeterItem('3', 'SRE Norte', 'Montes Claros'),
    ]);

    expect(groups).toEqual([
      {
        regional: 'SRE Norte',
        municipios: [
          {
            municipio: 'Montes Claros',
            items: [
              expect.objectContaining({ source: 'pnae', atendimentoId: '1' }),
              expect.objectContaining({
                source: 'demeter',
                atendimentoId: '3',
              }),
            ],
          },
        ],
      },
      {
        regional: 'SRE Sul',
        municipios: [
          {
            municipio: 'Lavras',
            items: [expect.objectContaining({ atendimentoId: '2' })],
          },
          {
            municipio: 'Varginha',
            items: [expect.objectContaining({ atendimentoId: '4' })],
          },
        ],
      },
    ]);
  });

  it('preserves paste order within a município bucket', () => {
    const groups = groupZipItemsByRegional([
      pnaeItem('9', 'SRE Sul', 'Lavras'),
      demeterItem('2', 'SRE Sul', 'Lavras'),
      pnaeItem('5', 'SRE Sul', 'Lavras'),
    ]);

    expect(
      groups[0].municipios[0].items.map((i) => i.atendimentoId),
    ).toEqual(['9', '2', '5']);
  });

  it('returns an empty list for no items', () => {
    expect(groupZipItemsByRegional([])).toEqual([]);
  });
});
