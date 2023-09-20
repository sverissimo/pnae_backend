export function getPerfisUsuarios(usuarios: any[]) {
  const perfis = usuarios.map((u) => u.perfil_demeter.map((p) => p.perfil?.descricao_perfil));
  const usuariosWithPerfis = usuarios.map((u, index) => {
    const { perfil_demeter, ...rest } = u;
    return { ...rest, perfis: perfis[index] };
  });
  return usuariosWithPerfis;
}
