export function correctValoresPnaeOrder(data: Record<string, any>) {
  const ValorPnae = data.ValorPnae;

  const extractValue = (str: string) => {
    if (str.includes('até')) {
      return parseFloat(
        str.replace('até R$ ', '').replace('.', '').replace(',', '.'),
      );
    } else if (str.includes('entre')) {
      return parseFloat(
        str
          .split(' e ')[0]
          .replace('entre R$ ', '')
          .replace('.', '')
          .replace(',', '.'),
      );
    } else if (str.includes('acima')) {
      return parseFloat(
        str.replace('acima de R$ ', '').replace('.', '').replace(',', '.'),
      );
    }
    return 0;
  };

  ValorPnae.sort((a: string, b: string) => extractValue(a) - extractValue(b));
}
