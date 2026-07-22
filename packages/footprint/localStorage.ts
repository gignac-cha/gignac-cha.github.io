export const readLocalStorage = (key: string): string | undefined => {
  try {
    return localStorage.getItem(key) ?? undefined;
  } catch {
    return undefined;
  }
};

export const writeLocalStorage = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch {}
};
