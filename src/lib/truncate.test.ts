import { truncateText } from './truncate';

describe('truncateText', () => {
  it('keeps short text', () => expect(truncateText('abc', 5)).toBe('abc'));
  it('cuts long text with an ellipsis', () => expect(truncateText('abcdef', 3)).toBe('abc…'));
  it('does not split an emoji', () => expect(truncateText('a😀b😀c', 2)).toBe('a😀…'));
});
