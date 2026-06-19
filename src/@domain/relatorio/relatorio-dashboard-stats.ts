import { UsuarioRole } from 'src/@domain/usuario/usuario.entity';

export type DashboardRelatorioInput = {
  createdAt?: string | null;
  data_validacao?: string | null;
  data_sei?: string | null;
  data_see?: string | null;
  dt_export_ok?: string | null;
  sn_pendencia?: number | null;
  sn_validado?: number | null;
  regional_sre?: string | null;
  usuario?: string | null;
  nm_und_empresa?: string | null;
  id_reg_empresa?: string | null;
};

const NON_REGIONAIS = [
  'Unidade Regional de Araguari',
  'Unidade Regional de Bambuí',
  'Barbacena',
  'Escritório Local de Caxambú',
  'Escritório Local de Itajubá',
  'Escritório Local  de Pirapora',
  'Unidade Regional de Ituiutaba',
  'Projeto Jaíba',
];

const LINE_CHART_DAYS = 30;

export type DashboardSummary = {
  totalRelatorios: number;
  approvedRegional: number;
  approvedDetec: number;
  approvedSEE: number;
  exportedSEI: number;
  relatoriosCreatedToday: number;
  semAprovacaoRegional: number;
};

export type DashboardLineChart = {
  seriesField: 'data_sei' | 'data_see';
  seriesName: string;
  categories: string[];
  created: number[];
  approved: number[];
};

export type DashboardData = {
  summary: DashboardSummary;
  topSREs: { sre: string; visitas: number }[] | null;
  topTecnicos: { tecnico: string; total: number; aprovados: number }[];
  relatoriosByRegional: {
    regional: string;
    total: number;
    aprovados: number;
  }[];
  lineChart: DashboardLineChart;
  scope: {
    role: UsuarioRole;
    regionalLabel: string | null;
  };
};

// Approval rule (covers a legacy DB edge case):
// - sn_validado=1 alone means approved (it overrides a sn_pendencia=1).
// - sn_validado=0 + data_validacao present + no pendência is also approved
//   (legacy rows where the validation timestamp was set without sn_validado being raised).
export const isAprovado = (r: DashboardRelatorioInput): boolean =>
  r.sn_validado === 1 || (!!r.data_validacao && !r.sn_pendencia);

type RegionalInput = { nm_und_empresa: string; id_und_empresa?: string };

export function formatRegionalName(name?: string | null): string {
  if (!name) return '';
  return name
    .replace('  ', ' ')
    .replace('Unidade ', '')
    .replace('Regional de', '')
    .replace('Escritório Local de ', 'ESLOC ')
    .trim();
}

function isRealRegional(r: RegionalInput): boolean {
  return !NON_REGIONAIS.includes(r.nm_und_empresa?.trim?.() ?? '');
}

export function buildSummary(
  relatorios: DashboardRelatorioInput[],
): DashboardSummary {
  const todayStr = new Date().toDateString();
  const summary: DashboardSummary = {
    totalRelatorios: 0,
    approvedRegional: 0,
    approvedDetec: 0,
    approvedSEE: 0,
    exportedSEI: 0,
    relatoriosCreatedToday: 0,
    semAprovacaoRegional: 0,
  };

  for (const r of relatorios) {
    summary.totalRelatorios += 1;
    if (isAprovado(r)) summary.approvedRegional += 1;
    if (r.data_sei) summary.approvedDetec += 1;
    if (r.data_see) summary.approvedSEE += 1;
    if (r.dt_export_ok) summary.exportedSEI += 1;
    if (r.createdAt && new Date(r.createdAt).toDateString() === todayStr) {
      summary.relatoriosCreatedToday += 1;
    }
  }

  summary.semAprovacaoRegional =
    summary.totalRelatorios - summary.approvedRegional;
  return summary;
}

export function buildTopSREs(
  relatorios: DashboardRelatorioInput[],
  limit: number,
): { sre: string; visitas: number }[] {
  const map = new Map<string, number>();
  for (const r of relatorios) {
    if (r.regional_sre) {
      map.set(r.regional_sre, (map.get(r.regional_sre) ?? 0) + 1);
    }
  }
  return [...map.entries()]
    .map(([sre, visitas]) => ({ sre, visitas }))
    .sort((a, b) => b.visitas - a.visitas)
    .slice(0, limit);
}

export function buildTopTecnicos(
  relatorios: DashboardRelatorioInput[],
  limit: number,
): { tecnico: string; total: number; aprovados: number }[] {
  const totals = new Map<string, number>();
  const aprovados = new Map<string, number>();
  for (const r of relatorios) {
    if (!r.usuario) continue;
    totals.set(r.usuario, (totals.get(r.usuario) ?? 0) + 1);
    if (isAprovado(r)) {
      aprovados.set(r.usuario, (aprovados.get(r.usuario) ?? 0) + 1);
    }
  }
  return [...totals.entries()]
    .map(([tecnico, total]) => ({
      tecnico,
      total,
      aprovados: aprovados.get(tecnico) ?? 0,
    }))
    // Default order for non-toggle consumers; the web dashboard may resort by `total` via RankSortToggle.
    .sort((a, b) => b.aprovados - a.aprovados || b.total - a.total)
    .slice(0, limit);
}

export function buildRelatoriosByRegional(
  relatorios: DashboardRelatorioInput[],
  regionais: RegionalInput[],
): { regional: string; total: number; aprovados: number }[] {
  const totals: Record<string, number> = {};
  const aprovados: Record<string, number> = {};

  for (const r of relatorios) {
    const name = formatRegionalName(r.nm_und_empresa);
    if (!name) continue;
    totals[name] = (totals[name] ?? 0) + 1;
    if (isAprovado(r)) {
      aprovados[name] = (aprovados[name] ?? 0) + 1;
    }
  }

  for (const r of regionais) {
    if (!isRealRegional(r)) continue;
    const name = formatRegionalName(r.nm_und_empresa);
    if (name && !(name in totals)) totals[name] = 0;
  }

  return Object.entries(totals)
    .map(([regional, total]) => ({
      regional,
      total,
      aprovados: aprovados[regional] ?? 0,
    }))
    // Alphabetical base, then aprovados-first — default order for non-toggle consumers;
    // the web dashboard may resort by `total` via RankSortToggle.
    .sort((a, b) => a.regional.localeCompare(b.regional))
    .sort((a, b) => b.aprovados - a.aprovados || b.total - a.total);
}

function countByDay(
  relatorios: DashboardRelatorioInput[],
  prop: keyof DashboardRelatorioInput,
): number[] {
  const counts = new Array(LINE_CHART_DAYS).fill(0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const r of relatorios) {
    const raw = r[prop] as string | null | undefined;
    if (!raw) continue;
    const d = new Date(raw);
    if (isNaN(d.getTime())) continue;
    d.setHours(0, 0, 0, 0);
    const diffDays = Math.floor(
      (today.getTime() - d.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (diffDays >= 0 && diffDays < LINE_CHART_DAYS) {
      counts[LINE_CHART_DAYS - 1 - diffDays] += 1;
    }
  }
  return counts;
}

export function buildLineChart(
  relatorios: DashboardRelatorioInput[],
  isAdminView: boolean,
): DashboardLineChart {
  const seriesField: 'data_sei' | 'data_see' = isAdminView
    ? 'data_see'
    : 'data_sei';
  const seriesName = isAdminView
    ? 'Aprovados pela SEE'
    : 'Aprovados pelo DETEC';

  const categories: string[] = Array.from({ length: LINE_CHART_DAYS }, (_, i) =>
    new Date(
      Date.now() - (LINE_CHART_DAYS - 1 - i) * 24 * 60 * 60 * 1000,
    ).toLocaleDateString('pt-BR'),
  );

  return {
    seriesField,
    seriesName,
    categories,
    created: countByDay(relatorios, 'createdAt'),
    approved: countByDay(relatorios, seriesField),
  };
}

export type DashboardRole = DashboardData['scope']['role'];

export function buildDashboardData(input: {
  fullRelatorios: DashboardRelatorioInput[];
  scopedRelatorios: DashboardRelatorioInput[];
  regionais: RegionalInput[];
  role: DashboardRole;
  regionalLabel: string | null;
  topTecnicosLimit: number;
  topSREsLimit: number;
}): DashboardData {
  const {
    fullRelatorios,
    scopedRelatorios,
    regionais,
    role,
    regionalLabel,
    topTecnicosLimit,
    topSREsLimit,
  } = input;

  const isAdminView = role === 'admin';

  return {
    summary: buildSummary(scopedRelatorios),
    topSREs: isAdminView ? buildTopSREs(fullRelatorios, topSREsLimit) : null,
    topTecnicos: buildTopTecnicos(fullRelatorios, topTecnicosLimit),
    relatoriosByRegional: buildRelatoriosByRegional(fullRelatorios, regionais),
    lineChart: buildLineChart(scopedRelatorios, isAdminView),
    scope: { role, regionalLabel },
  };
}
