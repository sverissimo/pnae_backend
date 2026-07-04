import {
  RegionalZipGroup,
  ZipRelatorioItem,
} from '../dto/zip-job.dtos';

export function groupZipItemsByRegional(
  items: ZipRelatorioItem[],
): RegionalZipGroup[] {
  const byRegional = new Map<string, Map<string, ZipRelatorioItem[]>>();

  for (const item of items) {
    if (!byRegional.has(item.regional)) {
      byRegional.set(item.regional, new Map());
    }
    const municipios = byRegional.get(item.regional);
    if (!municipios.has(item.municipio)) {
      municipios.set(item.municipio, []);
    }
    municipios.get(item.municipio).push(item);
  }

  return [...byRegional.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([regional, municipios]) => ({
      regional,
      municipios: [...municipios.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([municipio, municipioItems]) => ({
          municipio,
          items: municipioItems,
        })),
    }));
}
