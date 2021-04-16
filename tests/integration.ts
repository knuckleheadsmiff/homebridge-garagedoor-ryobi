import { findDeviceIdByName, RyobiGDOApi } from "../src/RyobiGDOApi";

const api = new RyobiGDOApi(
  "",
  "",
  (x) => findDeviceIdByName(x, "Main Bay"),
  undefined,
  true
);

api.closeDoor();
