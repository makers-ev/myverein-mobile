import { absoluteFeedUrl, createFeedBody, webcalFeedUrl } from './calendarFeeds';

describe('calendar feed helpers', () => {
  it('omits an empty label and trims/limits a long one', () => {
    expect(createFeedBody(null, '  ')).toEqual({ calendarId: null });
    expect(createFeedBody('c', ' Handy ')).toEqual({ calendarId: 'c', label: 'Handy' });
    expect(createFeedBody('c', 'x'.repeat(80)).label).toHaveLength(60);
  });

  it('prefixes relative dev urls with the backend base and keeps absolute ones', () => {
    expect(absoluteFeedUrl('/feeds/t.ics', 'http://localhost:3000/')).toBe('http://localhost:3000/feeds/t.ics');
    expect(absoluteFeedUrl('https://api.x.de/feeds/t.ics', 'http://localhost')).toBe('https://api.x.de/feeds/t.ics');
    expect(webcalFeedUrl('/feeds/t.ics', 'https://api.x.de/feeds/t.ics')).toBe('webcal://api.x.de/feeds/t.ics');
    expect(webcalFeedUrl('webcal://api.x.de/feeds/t.ics', 'https://api.x.de/feeds/t.ics')).toBe('webcal://api.x.de/feeds/t.ics');
  });
});
