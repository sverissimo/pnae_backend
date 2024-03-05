export function formatCPF(document: string | undefined) {
  if (typeof document !== 'string') return document;
  if (document.length === 11) {
    return document.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  } else if (document.length === 14) {
    return document.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  } else {
    return document;
  }
}

export function unformatCPF(document: string | undefined) {
  if (typeof document !== 'string') return document;
  return document.replace(/[\.\-\/]/g, '');
}
