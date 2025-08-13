/**
 * Calculate sleep duration in minutes between bedtime and wakeup time.
 * @param bedtime - Bedtime in ISO 8601 string format (e.g. "2025-08-12T23:30:00Z")
 * @param wakeupTime - Wake-up time in ISO 8601 string format (e.g. "2025-08-13T07:15:00Z")
 * @returns Duration in minutes
 */
export function calculateSleepDuration(
  bedtime: string,
  wakeupTime: string
): number {
  const bed = new Date(bedtime);
  const wake = new Date(wakeupTime);

  // If wakeup time is earlier than bedtime, assume it is the next day
  if (wake <= bed) {
    wake.setDate(wake.getDate() + 1);
  }

  const diffMs = wake.getTime() - bed.getTime();
  return Math.round(diffMs / (1000 * 60)); // Convert ms to minutes
}
