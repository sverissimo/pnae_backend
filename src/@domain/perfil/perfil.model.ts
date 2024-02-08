import { GrupoProdutos } from '../../modules/perfil/types';

export type at_prf_see_propriedade = {
  atividade: 'ATIVIDADE_PRIMARIA' | 'ATIVIDADE_SECUNDARIA' | 'AMBAS';
  producao_dedicada_pnae?: boolean;
};

export type PerfilModel = {
  id: string;
  id_cliente: string;
  id_tecnico: string;
  id_propriedade: string;
  id_contrato: number;
  aderiu_pra: boolean;
  agroindustria_precisa_adaptacao_reforma: boolean;
  at_prf_see_propriedade: at_prf_see_propriedade[];
  atividades_com_regularizacao_ambiental: string;
  atividades_usam_recursos_hidricos: string;
  ciente_iniciativas_regularizacao_pra: boolean;
  condicao_posse: string;
  credito_rural: boolean;
  dados_producao_agro_industria: {
    controla_custos_producao: boolean;
    dificuldade_fornecimento: string;
    forma_entrega_produtos: string;
    informacoes_adicionais: string;
    local_comercializacao: string;
    tipo_regularizacao_ambiental: string;
    tipo_regularizacao_uso_recursos_hidricos: string;
    valor_total_obtido_outros: string;
    valor_total_obtido_pnae: string;
    at_prf_see_grupos_produtos: GrupoProdutos[];
  };
  dados_producao_in_natura: {
    controla_custos_producao: boolean;
    dificuldade_fornecimento: string;
    forma_entrega_produtos: string;
    informacoes_adicionais: string;
    local_comercializacao: string;
    tipo_regularizacao_ambiental: string;
    tipo_regularizacao_uso_recursos_hidricos: string;
    valor_total_obtido_outros: string;
    valor_total_obtido_pnae: string;
    at_prf_see_grupos_produtos: GrupoProdutos[];
  };
  dap_caf_vigente: boolean;
  data_atualizacao: string;
  data_preenchimento: string;
  fonte_captacao_agua: string;
  forma_esgotamento_sanitario: string;
  grau_interesse_pnae: 'BAIXO' | 'MODERADO' | 'ALTO';
  id_dados_producao_agro_industria: string;
  id_dados_producao_in_natura: string;
  nivel_tecnologico_cultivo: string;
  orgao_fiscalizacao_sanitaria: 'IMA' | 'VIGILANCIA_SANITARIA' | 'SIM' | 'MAPA' | 'NAO_SE_APLICA';
  participa_organizacao: boolean;
  pessoas_processamento_alimentos: number;
  possui_agroindustria_propria?: boolean;
  possui_cadastro_car: boolean;
  possui_registro_orgao_fiscalizacao_sanitaria: boolean;
  procedimento_pos_colheita: string;
  realiza_escalonamento_producao: boolean;
  sistema_producao: string;
  tipo_estabelecimento: 'PF' | 'PJ';
  tipo_gestao_unidade: 'COLETIVA | FAMILIAR';
  tipo_perfil: string;
  tipo_pessoa_juridica: 'ASSOCIACAO' | 'COOPERATIVA' | 'OUTROS';
  usuario: {
    digito_matricula: string;
    id_usuario: string;
    login_usuario: string;
    matricula_usuario: string;
    nome_usuario: string;
  };
};
