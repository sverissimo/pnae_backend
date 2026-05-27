import {
  buildDashboardData,
  buildRelatoriosByRegional,
  buildSummary,
  buildTopSREs,
  buildTopTecnicos,
  DashboardRelatorioInput,
  formatRegionalName,
  isAprovado,
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

    it('excludes data_validacao with sn_pendencia=1 from approvedRegional (matches isAprovado)', () => {
      const summary = buildSummary([
        { ...baseRelatorio, data_validacao: '2026-01-01', sn_pendencia: 0 },
        { ...baseRelatorio, data_validacao: '2026-01-01', sn_pendencia: 1 },
        { ...baseRelatorio, data_validacao: '2026-01-01', sn_pendencia: null },
      ]);

      expect(summary.totalRelatorios).toBe(3);
      expect(summary.approvedRegional).toBe(2);
      expect(summary.semAprovacaoRegional).toBe(1);
    });

    it('counts sn_validado=1 as approved even when sn_pendencia=1 (validado overrides pendência)', () => {
      const summary = buildSummary([
        { ...baseRelatorio, data_validacao: '2026-01-01', sn_pendencia: 1, sn_validado: 1 },
        { ...baseRelatorio, data_validacao: '2026-01-01', sn_pendencia: 1, sn_validado: 0 },
        { ...baseRelatorio, sn_validado: 1 },
      ]);

      expect(summary.totalRelatorios).toBe(3);
      expect(summary.approvedRegional).toBe(2);
      expect(summary.semAprovacaoRegional).toBe(1);
    });
  });

  describe('isAprovado', () => {
    it('covers the legacy edge case and the validado-overrides-pendência rule', () => {
      // Legacy edge case: data_validacao set, sn_validado=0, no pendência → approved.
      expect(
        isAprovado({ data_validacao: '2026-01-01', sn_pendencia: 0, sn_validado: 0 }),
      ).toBe(true);
      // sn_validado=1 alone wins, even with sn_pendencia=1.
      expect(
        isAprovado({ data_validacao: null, sn_pendencia: 1, sn_validado: 1 }),
      ).toBe(true);
      // data_validacao set, sn_pendencia=1, sn_validado=0 → not approved.
      expect(
        isAprovado({ data_validacao: '2026-01-01', sn_pendencia: 1, sn_validado: 0 }),
      ).toBe(false);
      // Brand new: nothing set → not approved.
      expect(isAprovado({})).toBe(false);
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
      expect(buildTopTecnicos(data, 1)).toEqual([
        { tecnico: 'Alice', total: 2, aprovados: 0 },
      ]);
    });

    it('ranks tecnicos by aprovados desc, then total desc', () => {
      const data: DashboardRelatorioInput[] = [
        // Alice: 3 total, 1 aprovado
        { ...baseRelatorio, usuario: 'Alice', data_validacao: '2026-01-01' },
        { ...baseRelatorio, usuario: 'Alice' },
        { ...baseRelatorio, usuario: 'Alice' },
        // Bob: 2 total, 2 aprovados
        { ...baseRelatorio, usuario: 'Bob', data_validacao: '2026-01-01' },
        { ...baseRelatorio, usuario: 'Bob', data_validacao: '2026-01-01' },
        // Carol: 2 total, 1 aprovado (tiebreaker on total against Alice loses)
        { ...baseRelatorio, usuario: 'Carol', data_validacao: '2026-01-01' },
        { ...baseRelatorio, usuario: 'Carol' },
      ];
      expect(buildTopTecnicos(data, 10)).toEqual([
        { tecnico: 'Bob', total: 2, aprovados: 2 },
        { tecnico: 'Alice', total: 3, aprovados: 1 },
        { tecnico: 'Carol', total: 2, aprovados: 1 },
      ]);
    });
  });

  describe('isAprovado', () => {
    it('requires data_validacao and falsy sn_pendencia', () => {
      expect(isAprovado({ ...baseRelatorio, data_validacao: '2026-01-01', sn_pendencia: 0 })).toBe(true);
      expect(isAprovado({ ...baseRelatorio, data_validacao: '2026-01-01', sn_pendencia: null })).toBe(true);
      expect(isAprovado({ ...baseRelatorio, data_validacao: null })).toBe(false);
      expect(isAprovado({ ...baseRelatorio, data_validacao: '2026-01-01', sn_pendencia: 1 })).toBe(false);
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

      const byName = Object.fromEntries(
        result.map((r) => [r.regional, { total: r.total, aprovados: r.aprovados }]),
      );
      expect(byName['Uberlândia']).toEqual({ total: 2, aprovados: 0 });
      expect(byName['Montes Claros']).toEqual({ total: 1, aprovados: 0 });
      expect(byName['Pouso Alegre']).toEqual({ total: 0, aprovados: 0 });
      expect(byName['Bambuí']).toBeUndefined();
    });

    it('counts aprovados per regional and ranks by aprovados desc, total desc', () => {
      const result = buildRelatoriosByRegional(
        [
          {
            ...baseRelatorio,
            nm_und_empresa: 'Unidade Regional de Uberlândia',
            data_validacao: '2026-01-01',
          },
          { ...baseRelatorio, nm_und_empresa: 'Unidade Regional de Uberlândia' },
          {
            ...baseRelatorio,
            nm_und_empresa: 'Unidade Regional de Montes Claros',
            data_validacao: '2026-01-01',
          },
          {
            ...baseRelatorio,
            nm_und_empresa: 'Unidade Regional de Montes Claros',
            data_validacao: '2026-01-01',
          },
        ],
        [],
      );
      expect(result).toEqual([
        { regional: 'Montes Claros', total: 2, aprovados: 2 },
        { regional: 'Uberlândia', total: 2, aprovados: 1 },
      ]);
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
        data_validacao: '2026-01-01',
        sn_pendencia: 0,
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
      expect(out.topTecnicos).toEqual([
        { tecnico: 'Alice', total: 1, aprovados: 1 },
        { tecnico: 'Bob', total: 1, aprovados: 0 },
      ]);
      expect(out.relatoriosByRegional).toEqual([
        { regional: 'Uberlândia', total: 1, aprovados: 1 },
        { regional: 'Montes Claros', total: 1, aprovados: 0 },
      ]);
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
