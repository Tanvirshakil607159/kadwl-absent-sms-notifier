export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function normalizeAttendanceDate(value) {
  if (!value) return "";
  const raw = String(value).trim();
  let year, month, day;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const local = raw.match(/^(\d{1,2})[-/\s]([A-Za-z]+|\d{1,2})[-/\s](\d{4})$/);
  if (iso) [, year, month, day] = iso;
  else if (local) {
    [, day, month, year] = local;
    if (/^[A-Za-z]+$/.test(month))
      month =
        [
          "jan",
          "feb",
          "mar",
          "apr",
          "may",
          "jun",
          "jul",
          "aug",
          "sep",
          "oct",
          "nov",
          "dec",
        ].indexOf(month.slice(0, 3).toLowerCase()) + 1;
  } else return "";
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (
    date.getFullYear() !== Number(year) ||
    date.getMonth() + 1 !== Number(month) ||
    date.getDate() !== Number(day)
  )
    return "";
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
