import {
  formatScheduledDateTime,
  formatCountdown,
} from '../../../components/trip-map-screen/hooks/useScheduledDeliveries';

describe('formatScheduledDateTime', () => {
  it('formats a ISO string as dd/mm h:mm AM/PM', () => {
    const date = new Date(2026, 9, 8, 15, 30); // 8 oct 2026 15:30 local
    expect(formatScheduledDateTime(date.toISOString())).toBe('08/10 3:30 PM');
  });

  it('formats midnight as 12 AM', () => {
    const date = new Date(2026, 9, 8, 0, 0);
    expect(formatScheduledDateTime(date.toISOString())).toBe('08/10 12:00 AM');
  });

  it('formats noon as 12 PM', () => {
    const date = new Date(2026, 9, 8, 12, 0);
    expect(formatScheduledDateTime(date.toISOString())).toBe('08/10 12:00 PM');
  });

  it('returns null for null/undefined/invalid input', () => {
    expect(formatScheduledDateTime(null)).toBeNull();
    expect(formatScheduledDateTime(undefined)).toBeNull();
    expect(formatScheduledDateTime('not-a-date')).toBeNull();
  });
});

describe('formatCountdown', () => {
  const now = new Date(2026, 9, 8, 14, 0, 0).getTime(); // 2:00 PM

  it('formats hours and minutes in the future', () => {
    const target = new Date(2026, 9, 8, 15, 30).toISOString(); // +1h30
    expect(formatCountdown(target, now)).toBe('en 1h 30m');
  });

  it('formats only minutes when less than an hour', () => {
    const target = new Date(2026, 9, 8, 14, 45).toISOString(); // +45min
    expect(formatCountdown(target, now)).toBe('en 45min');
  });

  it('formats sub-minute as "en menos de 1 min"', () => {
    const target = new Date(now + 30_000).toISOString();
    expect(formatCountdown(target, now)).toBe('en menos de 1 min');
  });

  it('returns liberation message when the hour is due', () => {
    const target = new Date(now - 60_000).toISOString();
    expect(formatCountdown(target, now)).toBe('Hora cumplida — liberando…');
  });

  it('returns empty string for invalid dates', () => {
    expect(formatCountdown('bad-date', now)).toBe('');
  });
});
