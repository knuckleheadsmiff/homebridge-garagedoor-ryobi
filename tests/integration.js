"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const RyobiGDOApi_1 = require("../src/RyobiGDOApi");
const api = new RyobiGDOApi_1.RyobiGDOApi({
    cookies: {},
}, {
    email: '',
    password: '',
}, console);
(async function main() {
    //await api.closeDoor();
    console.log(await api.getStatus({ name: 'Main Bay' }));
})();
//# sourceMappingURL=integration.js.map