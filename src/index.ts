import { API } from "homebridge";
import { GarageDoorAccessory } from "./GarageDoorAccessory";

export = (homebridge: API) => {
  homebridge.registerAccessory(
    "homebridge-garagedoor-ryobi",
    "RyobiGarageCommand",
    GarageDoorAccessory
  );
};
