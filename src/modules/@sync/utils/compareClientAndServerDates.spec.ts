import { compareClientAndServerDates } from './compareClientAndServerDates';

describe('compareClientAndServerDates', () => {
  it('should return "upToDate" when both dates are null', () => {
    expect(compareClientAndServerDates(null, null)).toBe('upToDate');
  });

  it('should return "upToDate" when both dates are undefined', () => {
    expect(compareClientAndServerDates(undefined, undefined)).toBe('upToDate');
  });

  it('should return "upToDate" when both dates are equal', () => {
    const date = new Date();
    expect(compareClientAndServerDates(date, date)).toBe('upToDate');
  });

  it('should return "outdatedOnClient" when client date is less than (before) server date', () => {
    const clientDate = new Date('2020-01-01');
    const serverDate = new Date('2021-01-01');
    expect(compareClientAndServerDates(clientDate, serverDate)).toBe('outdatedOnClient');
  });

  it('should return "outdatedOnServer" when client date is greater than (after) server date', () => {
    const clientDate = new Date('2021-01-01');
    const serverDate = new Date('2020-01-01');
    expect(compareClientAndServerDates(clientDate, serverDate)).toBe('outdatedOnServer');
  });

  it('should return "outdatedOnClient" when client date is null and server date is defined', () => {
    const serverDate = new Date('2021-01-01');
    expect(compareClientAndServerDates(null, serverDate)).toBe('outdatedOnClient');
  });

  it('should return "outdatedOnServer" when server date is null and client date is defined', () => {
    const clientDate = new Date('2021-01-01');
    expect(compareClientAndServerDates(clientDate, null)).toBe('outdatedOnServer');
  });

  it('should return "outdatedOnClient" when client date is undefined and server date is defined', () => {
    const serverDate = new Date('2021-01-01');
    expect(compareClientAndServerDates(undefined, serverDate)).toBe('outdatedOnClient');
  });

  it('should return "outdatedOnServer" when server date is undefined and client date is defined', () => {
    const clientDate = new Date('2021-01-01');
    expect(compareClientAndServerDates(clientDate, undefined)).toBe('outdatedOnServer');
  });
});
