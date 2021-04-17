import { RyobiGDOApi } from '../src/RyobiGDOApi';

const api = new RyobiGDOApi(
  {
    cookies: {},
  },
  {
    email: '',
    password: '',
  },
  console
);

(async function main() {
  //await api.closeDoor();
  console.log(await api.getStatus({ name: 'Main Bay' }));
})();
