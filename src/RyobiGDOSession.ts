export interface RyobiGDOSession {
  apiKey?: string | undefined;
  cookies: Record<string, string>;
  cookieExpires?: Date | undefined;
}
