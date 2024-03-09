export function parseNumbers(input: string): string {
  const formattedInput = input.replace(/\./g, '').replace(/,/g, '.');

  const numberValue = Number(formattedInput);
  const result = Math.round(numberValue);
  return String(result);
}
