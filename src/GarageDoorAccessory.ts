import {
  AccessoryConfig,
  AccessoryPlugin,
  API,
  Characteristic,
  CharacteristicValue,
  Logging,
  LogLevel,
  Service,
} from "homebridge";
import { RyobiGDOApi } from "./RyobiGDOApi";

const POLL_SHORT_DEFAULT = 15;
const POLL_LONG_DEFAULT = 90;

export class GarageDoorAccessory implements AccessoryPlugin {
  log: Logging;
  name: string;
  ryobi_email: string;
  ryobi_password: string;
  ryobi_device: { id?: string; name?: string } | undefined;
  serial_number: string;
  debug_sensitive: boolean;
  poll_short_delay: number;
  poll_long_delay: number;
  ryobi: RyobiGDOApi;
  lastStateSeen: string | undefined;
  stateTimer: NodeJS.Timer | undefined;
  informationService: Service | undefined;
  api: API;
  garageDoorService: Service | undefined;
  characteristic: typeof Characteristic;

  constructor(log: Logging, config: AccessoryConfig, api: API) {
    this.api = api;
    this.log = log;
    this.name = config.name;
    this.characteristic = api.hap.Characteristic;

    this.ryobi_email = config.email;
    this.ryobi_password = config.password;
    this.ryobi_device = { id: config.garagedoor_id };

    this.serial_number = "001";
    if (config.serial_number) {
      this.serial_number = config.serial_number;
    }

    if (!config.garagedoor_id) {
      const garagedoor_name = config.garagedoor_name;
      if (!config.name) {
        this.name = "Garage Door: " + garagedoor_name;
      }

      if (garagedoor_name) {
        this.ryobi_device = { name: garagedoor_name };
      }
    }

    this.debug_sensitive = config.debug_sensitive;

    this.poll_short_delay = config.poll_short_delay || 15;
    this.poll_long_delay = config.poll_long_delay || 90;

    this.poll_long_delay = this.poll_long_delay * 1000;
    this.poll_short_delay = this.poll_short_delay * 1000;

    this.ryobi = new RyobiGDOApi(
      {
        email: this.ryobi_email,
        password: this.ryobi_password,
      },
      this.ryobi_device,
      this.log,
      this.debug_sensitive
    );

    this.pollState(); // kick off periodic polling;
  }

  async setState(targetState: CharacteristicValue) {
    if (targetState === undefined) {
      this.log("Error: target state is undefined");
      return;
    }

    const result =
      targetState == this.characteristic.CurrentDoorState.CLOSED
        ? await this.ryobi.closeDoor()
        : await this.ryobi.openDoor();

    this.log("Set " + this.name + " to " + targetState);
    if (targetState == this.characteristic.CurrentDoorState.CLOSED) {
      this.garageDoorService?.setCharacteristic(
        this.characteristic.CurrentDoorState,
        this.characteristic.CurrentDoorState.OPENING
      );
    } else {
      this.garageDoorService?.setCharacteristic(
        this.characteristic.CurrentDoorState,
        this.characteristic.CurrentDoorState.CLOSING
      );
    }
    this.pollState();
  }

  async getState() {
    const state = await this.ryobi.update();
    if (this.lastStateSeen != state) {
      //what to log any change;
      this.log("State of " + this.name + " is: " + state);
    }
    this.lastStateSeen = state;
    this.log(
      "State of Characteristic.CurrentDoorState[state] is: " +
        this.characteristic.CurrentDoorState[state]
    );
    return this.characteristic.CurrentDoorState[state];
  }

  pollState() {
    if (this.poll_short_delay < POLL_SHORT_DEFAULT * 1000) {
      this.log(
        "***WARNING**: poll_short_delay values reset to default value--see doc."
      );
      this.poll_short_delay = POLL_SHORT_DEFAULT * 1000;
    }
    if (this.poll_long_delay < this.poll_short_delay) {
      this.log(
        "***WARNING**: poll_long_delay values too short. reset to default value--see doc. Recommend setting much longer"
      );
      this.poll_long_delay = POLL_LONG_DEFAULT * 1000;
    }

    // Clear any existing timer
    if (this.stateTimer) {
      clearTimeout(this.stateTimer);
      this.stateTimer = undefined;
    }

    //this.log("pollShort");
    this.stateTimer = setTimeout(
      () => this.pollStateNow(),
      this.poll_short_delay
    );
  }

  async pollStateNow() {
    const currentDeviceState = await this.getState();

    this.log.log(
      LogLevel.INFO,
      "GarageCmdAccessory.prototype.pollState: " + currentDeviceState
    );

    if (
      currentDeviceState == this.characteristic.CurrentDoorState.OPENING ||
      currentDeviceState == this.characteristic.CurrentDoorState.CLOSING
    ) {
      this.stateTimer = setTimeout(
        () => this.pollStateNow(),
        this.poll_short_delay
      );
    } else {
      this.garageDoorService?.setCharacteristic(
        this.characteristic.CurrentDoorState,
        currentDeviceState
      );
      this.stateTimer = setTimeout(
        () => this.pollStateNow(),
        this.poll_long_delay
      );
    }
  }

  getServices() {
    this.informationService = new this.api.hap.Service.AccessoryInformation();
    this.garageDoorService = new this.api.hap.Service.GarageDoorOpener(
      this.name
    );

    this.informationService
      .setCharacteristic(
        this.characteristic.Manufacturer,
        "Ryobi Garage-door Opener"
      )
      .setCharacteristic(this.characteristic.Model, "Homebridge Plugin")
      .setCharacteristic(this.characteristic.SerialNumber, this.serial_number);

    this.garageDoorService
      .getCharacteristic(this.characteristic.TargetDoorState)
      .on("set", (value) => this.setState(value));

    this.garageDoorService
      .getCharacteristic(this.characteristic.CurrentDoorState)
      .on("get", this.getState.bind(this));

    this.garageDoorService
      .getCharacteristic(this.characteristic.TargetDoorState)
      .on("get", this.getState.bind(this));

    return [this.informationService, this.garageDoorService];
  }
}
