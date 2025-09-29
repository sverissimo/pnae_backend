import { formatDate, formatReverseDate } from './dateUtils';

describe('formatDate', () => {
  it('should format a Date object correctly', () => {
    const date = new Date();
    const formattedDate = formatDate(date);
    console.log('🚀 - it - formattedDate:', formattedDate);

    expect(typeof formattedDate).toBe('string');
  });

  it('should format a string date correctly', () => {
    const dateString = '2022-12-31T03:00:00Z';
    const formattedDate = formatDate(dateString);
    expect(formattedDate).toBe('31/12/2022');
  });

  it('should return undefined if the input is undefined', () => {
    const formattedDate = formatDate(undefined);
    expect(formattedDate).toBeUndefined();
  });
});

describe('formatReverseDate', () => {
  it('should format a Date object correctly', () => {
    const date = new Date();
    const reverseDate = formatReverseDate(date);
    console.log('🚀 - it - reverseDate:', reverseDate);
    expect(typeof reverseDate).toBe('string');
  });
});
