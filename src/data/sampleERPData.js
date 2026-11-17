// ERP dataset definitions (Clean state - no dummy data)
export const getFormattedToday = () => {
  const d = new Date();
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${String(d.getDate()).padStart(2, "0")}-${months[d.getMonth()]}-${d.getFullYear()}`;
};

export const SAMPLE_ABSENT_DATE = getFormattedToday();

export const SAMPLE_ABSENT_RECORDS = [];
