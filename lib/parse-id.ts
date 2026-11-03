const POSTGRES_INT_MAX = 2147483647;

export function parseId(value: string | undefined | null): number | null {
  if (!value || !/^[1-9]\d{0,9}$/.test(value)) return null;
  const id = Number(value);
  return id <= POSTGRES_INT_MAX ? id : null;
}
