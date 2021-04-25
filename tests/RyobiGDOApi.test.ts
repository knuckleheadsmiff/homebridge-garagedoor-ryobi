import 'jest';
import { updateSessionFromCookies } from '../src/RyobiGDOApi';
import { RyobiGDOSession } from '../src/RyobiGDOSession';

it('should parse cookies', () => {
  const session: RyobiGDOSession = { cookies: {} };
  updateSessionFromCookies(session, ['test=1234a; expires=Sun, 15 Jul 2012 00:00:01 GMT']);
  expect(session.cookies.test).toBe('1234a');
  expect(session.cookieExpires?.toUTCString()).toBe('Sun, 15 Jul 2012 00:00:01 GMT');
});
