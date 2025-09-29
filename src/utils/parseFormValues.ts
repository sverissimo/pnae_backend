import { formatDate } from './dateUtils';

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
        return parsedData;
      }
    case 'boolean':
      return value ? 'Sim' : 'Não';
    default:
      return '';
  }
};
