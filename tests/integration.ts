import { RyobiGDOApi } from '../src/RyobiGDOApi';

const api = new RyobiGDOApi(
  {
    email: '',
    password: '',
  },
  { name: '' },
  console
);

(async function main() {
  await api.closeDoor();
  //await api.getStatus();
})();
