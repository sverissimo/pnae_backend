import { AtendimentoUpdate } from './types/atendimento-updates';
import { RelatorioDomainService } from './relatorio-domain-service';
import { RelatorioModel } from './relatorio-model';

const BASE_RELATORIO: RelatorioModel = {
  id: 'relatorio-1',
  produtorId: 'produtor-1',
  tecnicoId: 'tecnico-1',
  contratoId: 123,
  numeroRelatorio: 1,
  assunto: 'Assunto teste',
  orientacao: 'Orientação teste',
  pictureURI: 'http://example.com/pic.png',
  assinaturaURI: 'http://example.com/sign.png',
  atendimentoId: 'base-id',
  // atendimentoAnteriorId is optional, leave unset in base
  readOnly: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('RelatorioDomainService.updateAtendimentoIds', () => {
  test('returns input as-is when updates are empty', () => {
    const relatorios = [
      { ...BASE_RELATORIO, atendimentoId: '10' },
      { ...BASE_RELATORIO, atendimentoId: '20' },
    ];
    const result = RelatorioDomainService.updateAtendimentoIds(relatorios, []);
    expect(result).toEqual(relatorios);
  });

  test('no matching updates → unchanged (preserves atendimentoAnteriorId)', () => {
    const relatorios = [
      {
        ...BASE_RELATORIO,
        atendimentoId: '100',
      },
      {
        ...BASE_RELATORIO,
        atendimentoId: '200',
      },
    ];
    const updates: AtendimentoUpdate[] = [
      { atendimentoAnteriorId: '1', atendimentoId: '2' },
    ];
    const updatedRelatorios = RelatorioDomainService.updateAtendimentoIds(
      relatorios,
      updates,
    );
    expect(updatedRelatorios[0].atendimentoId).toBe('100');
    expect(updatedRelatorios[0].atendimentoAnteriorId).toBeUndefined();
    expect(updatedRelatorios[1].atendimentoId).toBe('200');
    expect(updatedRelatorios[1].atendimentoAnteriorId).toBeUndefined();
  });

  test('single hop: 5→6', () => {
    const relatorios = [
      { ...BASE_RELATORIO, atendimentoId: '5' },
      { ...BASE_RELATORIO, atendimentoId: '15' },
    ];
    const updates: AtendimentoUpdate[] = [
      { atendimentoAnteriorId: '5', atendimentoId: '6' },
    ];

    const [updated, updated2] = RelatorioDomainService.updateAtendimentoIds(
      relatorios,
      updates,
    );
    expect(updated.atendimentoId).toBe('6');
    expect(updated.atendimentoAnteriorId).toBe('5');
    expect(updated2.atendimentoId).toBe('15');
    expect(updated2.atendimentoAnteriorId).toBeUndefined();
  });

  test('multi-hop chain: 1→2→3', () => {
    const relatorios = [
      { ...BASE_RELATORIO, atendimentoId: '1' },
      { ...BASE_RELATORIO, atendimentoId: '10' },
    ];

    const updates: AtendimentoUpdate[] = [
      { atendimentoAnteriorId: '1', atendimentoId: '2' },
      { atendimentoAnteriorId: '2', atendimentoId: '3' },
    ];
    const [updated, notUpdated] = RelatorioDomainService.updateAtendimentoIds(
      relatorios,
      updates,
    );
    expect(updated.atendimentoId).toBe('3');
    expect(updated.atendimentoAnteriorId).toBe('2');
    expect(notUpdated.atendimentoId).toBe('10');
    expect(notUpdated.atendimentoAnteriorId).toBeUndefined();
  });

  test('out-of-order updates still resolve correctly', () => {
    const relatorio = { ...BASE_RELATORIO, atendimentoId: '1' };
    const updates: AtendimentoUpdate[] = [
      { atendimentoAnteriorId: '2', atendimentoId: '3' },
      { atendimentoAnteriorId: '1', atendimentoId: '2' },
    ];
    const [updated] = RelatorioDomainService.updateAtendimentoIds(
      [relatorio],
      updates,
    );
    expect(updated.atendimentoId).toBe('3');
    expect(updated.atendimentoAnteriorId).toBe('2');
  });

  test('cycle (A→B, B→A) stops safely', () => {
    const relatorio = { ...BASE_RELATORIO, atendimentoId: 'A' };
    const updates: AtendimentoUpdate[] = [
      { atendimentoAnteriorId: 'A', atendimentoId: 'B' },
      { atendimentoAnteriorId: 'B', atendimentoId: 'A' },
    ];
    const [updated] = RelatorioDomainService.updateAtendimentoIds(
      [relatorio],
      updates,
    );

    expect(['A', 'B']).toContain(updated.atendimentoId);
  });

  test('self-loop (X→X) does not change', () => {
    const relatorio = { ...BASE_RELATORIO, atendimentoId: 'X' };
    const updates: AtendimentoUpdate[] = [
      { atendimentoAnteriorId: 'X', atendimentoId: 'X' },
    ];
    const [updated] = RelatorioDomainService.updateAtendimentoIds(
      [relatorio],
      updates,
    );
    expect(updated.atendimentoId).toBe('X');
  });

  test('conflicting mapping → last wins', () => {
    const relatorio = { ...BASE_RELATORIO, atendimentoId: '10' };
    const updates: AtendimentoUpdate[] = [
      { atendimentoAnteriorId: '10', atendimentoId: '11' },
      { atendimentoAnteriorId: '10', atendimentoId: '12' }, // later wins
    ];
    const [updated] = RelatorioDomainService.updateAtendimentoIds(
      [relatorio],
      updates,
    );
    expect(updated.atendimentoId).toBe('12');
    expect(updated.atendimentoAnteriorId).toBe('10');
  });

  test('multiple relatorios processed independently', () => {
    const relatorios = [
      { ...BASE_RELATORIO, atendimentoId: '1' },
      { ...BASE_RELATORIO, atendimentoId: '5' },
      { ...BASE_RELATORIO, atendimentoId: '42' },
    ];
    const updates: AtendimentoUpdate[] = [
      { atendimentoAnteriorId: '1', atendimentoId: '2' },
      { atendimentoAnteriorId: '2', atendimentoId: '3' },
      { atendimentoAnteriorId: '5', atendimentoId: '6' },
    ];
    const result = RelatorioDomainService.updateAtendimentoIds(
      relatorios,
      updates,
    );

    expect(result[0].atendimentoId).toBe('3');
    expect(result[0].atendimentoAnteriorId).toBe('2');

    expect(result[1].atendimentoId).toBe('6');
    expect(result[1].atendimentoAnteriorId).toBe('5');

    expect(result[2].atendimentoId).toBe('42');
  });

  test('no false updates when nothing changes', () => {
    const relatorios = [
      {
        ...BASE_RELATORIO,
        atendimentoId: '777',
        atendimentoAnteriorId: '666',
      },
      {
        ...BASE_RELATORIO,
        atendimentoId: '888',
      },
    ];
    const updates: AtendimentoUpdate[] = [];
    const [notUpdated, notUpdated2] =
      RelatorioDomainService.updateAtendimentoIds(relatorios, updates);
    expect(notUpdated.atendimentoId).toBe('777');
    expect(notUpdated.atendimentoAnteriorId).toBe('666');
    expect(notUpdated2.atendimentoId).toBe('888');
    expect(notUpdated2.atendimentoAnteriorId).toBeUndefined();
  });
});
