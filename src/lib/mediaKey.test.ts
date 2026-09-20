import { damageReportPhotoKey, sanitizeMediaFilename } from './mediaKey';

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

describe('damageReportPhotoKey', () => {
  it('strips the /media/ prefix the backend adds to produce a bare key', () => {
    expect(damageReportPhotoKey('/media/club-1/uuid-photo.jpg')).toBe('club-1/uuid-photo.jpg');
  });

  it('returns null when there is no photo', () => {
    expect(damageReportPhotoKey(null)).toBeNull();
  });

  it('passes through a value that is already a bare key unchanged', () => {
    expect(damageReportPhotoKey('club-1/uuid-photo.jpg')).toBe('club-1/uuid-photo.jpg');
  });
});
