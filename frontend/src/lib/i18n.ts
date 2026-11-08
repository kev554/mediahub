export function t(french: string, english: string): string {
  return document.documentElement.lang === 'en'
    ? english
    : french
}
