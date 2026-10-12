import { sanitizeMediaFilename } from './mediaKey';

describe('sanitizeMediaFilename', () => {
  it('leaves a plain alphanumeric filename unchanged', () => {
    expect(sanitizeMediaFilename('photo123.jpg')).toBe('photo123.jpg');
  });

  it('replaces spaces, #, and % (expo/expo#35619) with underscores', () => {
    expect(sanitizeMediaFilename('my photo #1 (100%).jpg')).toBe('my_photo__1__100__.jpg');
  });

  it('keeps dots, underscores, and hyphens', () => {
    expect(sanitizeMediaFilename('a-b_c.d.jpg')).toBe('a-b_c.d.jpg');
  });
});
