import {
  buildDashboardData,
  buildRelatoriosByRegional,
  buildSummary,
  buildTopSREs,
  buildTopTecnicos,
  buildTopTecnicosAprovados,
  DashboardRelatorioInput,
  formatRegionalName,
} from './relatorio-dashboard-stats';

const today = new Date();
const isoToday = today.toISOString();
const isoYesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString();

const baseRelatorio: DashboardRelatorioInput = {
  createdAt: isoYesterday,
  data_validacao: null,
  data_sei: null,
  data_see: null,
  dt_export_ok: null,
  sn_pendencia: null,
  regional_sre: null,
  usuario: null,
  nm_und_empresa: null,
  id_reg_empresa: null,
};

describe('relatorio-dashboard-stats', () => {
  describe('buildSummary', () => {
    it('counts each status field and today separately', () => {
      const summary = buildSummary([
        {
          ...baseRelatorio,
          createdAt: isoToday,
          data_validacao: '2026-01-01',
          data_sei: '2026-01-02',
        },
        {
          ...baseRelatorio,
          data_see: '2026-01-01',
          dt_export_ok: '2026-01-02',
        },
        { ...baseRelatorio },
      ]);

      expect(summary.totalRelatorios).toBe(3);
      expect(summary.approvedRegional).toBe(1);
      expect(summary.approvedDetec).toBe(1);
      expect(summary.approvedSEE).toBe(1);
      expect(summary.exportedSEI).toBe(1);
      expect(summary.relatoriosCreatedToday).toBe(1);
      expect(summary.semAprovacaoRegional).toBe(2);
    });
  });

  describe('buildTopSREs / buildTopTecnicos', () => {
    it('groups, sorts desc, and slices to the requested limit', () => {
      const data: DashboardRelatorioInput[] = [
        { ...baseRelatorio, regional_sre: 'SRE-A', usuario: 'Alice' },
        { ...baseRelatorio, regional_sre: 'SRE-A', usuario: 'Alice' },
        { ...baseRelatorio, regional_sre: 'SRE-B', usuario: 'Bob' },
      ];
      expect(buildTopSREs(data, 10)).toEqual([
        { sre: 'SRE-A', visitas: 2 },
        { sre: 'SRE-B', visitas: 1 },
      ]);
      expect(buildTopTecnicos(data, 1)).toEqual([{ tecnico: 'Alice', visitas: 2 }]);
    });
  });

  describe('buildTopTecnicosAprovados', () => {
    it('only counts relatorios with data_validacao and no sn_pendencia', () => {
      const data: DashboardRelatorioInput[] = [
        // approved
        { ...baseRelatorio, usuario: 'Alice', data_validacao: '2026-01-01', sn_pendencia: 0 },
        { ...baseRelatorio, usuario: 'Alice', data_validacao: '2026-01-02', sn_pendencia: null },
        // not validated
        { ...baseRelatorio, usuario: 'Alice', data_validacao: null },
        // validated but pending
        { ...baseRelatorio, usuario: 'Bob', data_validacao: '2026-01-03', sn_pendencia: 1 },
        // approved Bob
        { ...baseRelatorio, usuario: 'Bob', data_validacao: '2026-01-04', sn_pendencia: 0 },
      ];
      expect(buildTopTecnicosAprovados(data, 10)).toEqual([
        { tecnico: 'Alice', visitas: 2 },
        { tecnico: 'Bob', visitas: 1 },
      ]);
    });
  });

  describe('buildRelatoriosByRegional', () => {
    it('normalizes names, drops NON_REGIONAIS, and adds empty entries from regionais list', () => {
      const result = buildRelatoriosByRegional(
        [
          { ...baseRelatorio, nm_und_empresa: 'Unidade Regional de Uberlândia' },
          { ...baseRelatorio, nm_und_empresa: 'Unidade Regional de Uberlândia' },
          { ...baseRelatorio, nm_und_empresa: 'Unidade Regional de Montes Claros' },
        ],
        [
          { nm_und_empresa: 'Unidade Regional de Uberlândia' },
          { nm_und_empresa: 'Unidade Regional de Bambuí' }, // NON_REGIONAL, ignored
          { nm_und_empresa: 'Unidade Regional de Pouso Alegre' },
        ],
      );

      const byName = Object.fromEntries(result.map((r) => [r.regional, r.count]));
      expect(byName['Uberlândia']).toBe(2);
      expect(byName['Montes Claros']).toBe(1);
      expect(byName['Pouso Alegre']).toBe(0);
      expect(byName['Bambuí']).toBeUndefined();
    });
  });

  describe('formatRegionalName', () => {
    it.each([
      ['Unidade Regional de Belo Horizonte', 'Belo Horizonte'],
      ['Escritório Local de Itajubá', 'ESLOC Itajubá'],
      ['', ''],
    ])('formats %s -> %s', (input, expected) => {
      expect(formatRegionalName(input)).toBe(expected);
    });
  });

  describe('buildDashboardData', () => {
    const data: DashboardRelatorioInput[] = [
      {
        ...baseRelatorio,
        id_reg_empresa: 'REG-1',
        usuario: 'Alice',
        regional_sre: 'SRE-A',
        nm_und_empresa: 'Unidade Regional de Uberlândia',
      },
      {
        ...baseRelatorio,
        id_reg_empresa: 'REG-2',
        usuario: 'Bob',
        regional_sre: 'SRE-B',
        nm_und_empresa: 'Unidade Regional de Montes Claros',
      },
    ];

    it('uses scoped set for summary/line and full set for tops/by-regional (non-admin)', () => {
      const out = buildDashboardData({
        fullRelatorios: data,
        scopedRelatorios: data.filter((r) => r.id_reg_empresa === 'REG-1'),
        regionais: [],
        role: 'staff',
        regionalLabel: 'Uberlândia',
        topTecnicosLimit: 20,
        topSREsLimit: 10,
      });

      expect(out.summary.totalRelatorios).toBe(1);
      expect(out.topSREs).toBeNull();
      expect(out.topTecnicos).toHaveLength(2);
      expect(out.relatoriosByRegional).toHaveLength(2);
      expect(out.lineChart.seriesField).toBe('data_sei');
      expect(out.scope.regionalLabel).toBe('Uberlândia');
    });

    it('admin sees everything and uses data_see for line chart', () => {
      const out = buildDashboardData({
        fullRelatorios: data,
        scopedRelatorios: data,
        regionais: [],
        role: 'admin',
        regionalLabel: null,
        topTecnicosLimit: 20,
        topSREsLimit: 10,
      });

      expect(out.summary.totalRelatorios).toBe(2);
      expect(out.topSREs).toHaveLength(2);
      expect(out.lineChart.seriesField).toBe('data_see');
    });
  });
});
