import { RyobiGDOCredentials } from './RyobiGDOCredentials';

export interface RyobiGDOSession {
  credentials: RyobiGDOCredentials;
  apiKey?: string | undefined;
  cookies: Record<string, string>;
  cookieExpires?: Date | undefined;
}
