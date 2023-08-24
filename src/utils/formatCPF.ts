export function formatCPF(document: string | undefined) {
  if (typeof document !== 'string') return document;
  if (document.length === 11) {
    return document.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4'); // Format CPF
  } else if (document.length === 14) {
    return document.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5'); // Format CNPJ
  } else {
    return document; // No formatting if length doesn't match
  }
}
