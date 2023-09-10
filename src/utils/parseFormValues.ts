import { formatDate } from './formatDate';

export const parseValue = (value: unknown) => {
  switch (typeof value) {
    case 'string':
      return value;
    case 'number':
      return value.toString();
    case 'object':
      if (value === null) {
        return '';
      }
      if (value instanceof Date) {
        const parsedData = formatDate(value.toISOString());
        return typeof parsedData === 'string' ? parsedData : parsedData.toLocaleDateString();
      }
    case 'boolean':
      return value ? 'Sim' : 'Não';
    default:
      return '';
  }
};
