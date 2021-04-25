"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("jest");
const RyobiGDOApi_1 = require("../src/RyobiGDOApi");
it('should parse cookies', () => {
    var _a;
    const session = { cookies: {} };
    RyobiGDOApi_1.updateSessionFromCookies(session, ['test=1234a; expires=Sun, 15 Jul 2012 00:00:01 GMT']);
    expect(session.cookies.test).toBe('1234a');
    expect((_a = session.cookieExpires) === null || _a === void 0 ? void 0 : _a.toUTCString()).toBe('Sun, 15 Jul 2012 00:00:01 GMT');
});
//# sourceMappingURL=RyobiGDOApi.test.js.map