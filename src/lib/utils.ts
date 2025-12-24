export const parseSRTTime = (timeStr: string): number => {
  if (!timeStr) return 0;
  
  const parts = timeStr.trim().split(/[:,.]/);
  
  let h = 0, m = 0, s = 0, ms = 0;
  
  if (parts.length === 4) {
    [h, m, s, ms] = parts.map(Number);
  } else if (parts.length === 3) {
    [m, s, ms] = parts.map(Number);
  } else {
    return 0;
  }
  
  return h * 3600 + m * 60 + s + (ms || 0) / 1000;
};
