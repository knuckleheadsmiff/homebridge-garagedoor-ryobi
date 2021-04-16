import { findDeviceIdByName, RyobiGDOApi } from "../src/RyobiGDOApi";

const api = new RyobiGDOApi(
  {
    email: "",
    password: "",
  },
  { name: "Main Bay" },
  undefined,
  true
);

api.closeDoor();
