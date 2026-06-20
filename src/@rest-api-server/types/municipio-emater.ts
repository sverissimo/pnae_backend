// Shape returned by the gateway `GET /api/getMunicipiosEmater`. `id_und_empresa`
// is a local unit ("H…"); `regional_id` is its parent regional ("G…").
export type MunicipioEmater = {
  id_und_empresa: string;
  nome_municipio: string | null;
  municipio_id: number | string | null;
  regional_id: string;
  nome_regional: string | null;
};
