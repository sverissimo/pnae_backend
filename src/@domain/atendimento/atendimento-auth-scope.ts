// Normalized authorization anchors for an atendimento, comparable to `Usuario`:
// `ownerId` = numeric `id_usuario`; `regionId` = regional `id_reg_empresa` ("G…").
export type AtendimentoAuthScope = {
  ownerId: string | null;
  regionId: string | null;
};
