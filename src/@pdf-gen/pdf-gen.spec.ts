import { PdfGenerator } from './pdf-gen';
import { ManualPdfInput } from './types/create-pdf-input';

describe('PdfGenerator manual PDF templates', () => {
  it('renders the manual relatório template with the minimal-cover fallback', async () => {
    const input: ManualPdfInput = {
      perfilPDFModel: null,
      produtor: {
        nomeProdutor: 'João da Silva',
        cpf: '123.456.789-01',
        caf: 'CAF-1',
        id_und_empresa: 'H1234',
      },
      atendimento: {
        atendimentoId: '987',
        data: '2026-06-20',
        id_und_empresa: 'H1234',
        produtorId: '42',
        propriedadeId: '100',
        tecnicoId: '7',
      },
      nome_propriedade: 'Sítio A',
      dados_producao_in_natura: null,
      dados_producao_agro_industria: null,
      imagens: [
        {
          legenda: 'Relatório assinado',
          dataUri: 'data:application/pdf;base64,JVBERi0x',
        },
      ],
    };

    const { mainHtml, footerHtml } = await (PdfGenerator as any)
      .createManualHtmlTemplates(input);

    expect(mainHtml).toContain('Relatório Manual');
    expect(mainHtml).toContain('João da Silva');
    expect(mainHtml).toContain('Relatório assinado');
    expect(footerHtml).toContain('Visita nº 987');
  });
});
