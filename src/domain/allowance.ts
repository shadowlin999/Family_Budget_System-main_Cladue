import type { AllowanceSettings } from '../types/user';

/**
 * Given a reference date and allowance settings, compute the next ISO timestamp
 * when allowance should be distributed.
 * Pure function — no Firebase or React dependencies.
 */
export const getNextAllowanceDate = (current: Date, settings: AllowanceSettings): string => {
  const d = new Date(current);
  const targetHour = settings.hour ?? 0;
  const targetMinute = settings.minute ?? 0;

  if (settings.period === 'weekly') {
    // Find next scheduled time
    let bestNext: Date | null = null;

    // Sort days to check them in order
    const sortedDays = [...settings.days].sort((a, b) => a - b);

    // Check remaining days this week
    for (const day of sortedDays) {
      const test = new Date(current);
      const diff = (day - current.getDay() + 7) % 7;
      test.setDate(current.getDate() + diff);
      test.setHours(targetHour, targetMinute, 0, 0);

      if (test > current) {
        if (!bestNext || test < bestNext) bestNext = test;
      }
    }

    // If none found this week (or all in past), check next week's first day
    if (!bestNext && sortedDays.length > 0) {
      const firstDay = sortedDays[0];
      const test = new Date(current);
      const diff = (firstDay - current.getDay() + 7) % 7 || 7;
      test.setDate(current.getDate() + diff);
      test.setHours(targetHour, targetMinute, 0, 0);
      bestNext = test;
    }

    if (bestNext) return bestNext.toISOString();
  } else {
    // Monthly
    let bestNext: Date | null = null;
    const sortedDays = [...settings.days].sort((a, b) => a - b);

    for (const day of sortedDays) {
      let test = new Date(current.getFullYear(), current.getMonth(), day, targetHour, targetMinute, 0, 0);
      if (test <= current) {
        test = new Date(current.getFullYear(), current.getMonth() + 1, day, targetHour, targetMinute, 0, 0);
      }
      if (!bestNext || test < bestNext) bestNext = test;
    }

    if (bestNext) return bestNext.toISOString();
  }

  // Fallback
  const fallback = new Date(d);
  fallback.setDate(fallback.getDate() + 7);
  fallback.setHours(targetHour, targetMinute, 0, 0);
  return fallback.toISOString();
};
