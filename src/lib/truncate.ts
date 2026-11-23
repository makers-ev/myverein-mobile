/** Shortens to `max` characters without splitting a surrogate pair (emoji) in half. */
export function truncateText(text: string, max: number): string {
  const chars = Array.from(text);
  return chars.length > max ? `${chars.slice(0, max).join('')}…` : text;
}
