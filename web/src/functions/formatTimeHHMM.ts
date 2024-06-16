export const formatTimeHHMM = (seconds: number): string => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) {
    return `${hrs} ч ${mins < 10 ? '0' : ''}${mins} мин ${secs < 10 ? '0' : ''}${secs} сек`;
  }
  return `${mins} мин ${secs < 10 ? '0' : ''}${secs} сек`;
};

