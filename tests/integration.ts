import { RyobiGDOApi } from '../src/RyobiGDOApi';

const api = new RyobiGDOApi(
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
