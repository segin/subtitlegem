export const parseSRTTime = (timeStr: string): number => {
  // Expected format: 00:00:01,000
  const [hms, ms] = timeStr.split(',');
  const [h, m, s] = hms.split(':').map(Number);
  return h * 3600 + m * 60 + s + Number(ms) / 1000;
};
