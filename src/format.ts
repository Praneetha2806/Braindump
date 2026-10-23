const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export const dayKey = (ts: number) => {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

export function formatDay(ts: number) {
  const d = new Date(ts);
  const today = dayKey(Date.now());
  const yesterday = dayKey(Date.now() - 86_400_000);
  const rel = dayKey(ts) === today ? "Today · " : dayKey(ts) === yesterday ? "Yesterday · " : "";
  const year = d.getFullYear() !== new Date().getFullYear() ? `, ${d.getFullYear()}` : "";
  return { rel, date: `${MONTHS[d.getMonth()]} ${d.getDate()}${year}`, weekday: WEEKDAYS[d.getDay()] };
}

export const formatTime = (ts: number) =>
  new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

export function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

/** Groups items in order by a key, keeping first-seen order of the keys. */
export function groupBy<T>(list: T[], key: (t: T) => string): [string, T[]][] {
  const map = new Map<string, T[]>();
  for (const t of list) {
    const k = key(t);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(t);
  }
  return [...map];
}
