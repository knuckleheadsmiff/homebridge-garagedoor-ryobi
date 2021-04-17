import {
  AccessoryConfig,
  AccessoryPlugin,
  API,
  Characteristic,
  CharacteristicValue,
  Logger,
  Logging,
  LogLevel,
  Service,
} from 'homebridge';
import { RyobiGDOApi } from './RyobiGDOApi';
import { RyobiGDODevice } from './RyobiGDODevice';

const POLL_SHORT_DEFAULT = 15;
const POLL_LONG_DEFAULT = 90;

export class RyobiGDOAccessory implements AccessoryPlugin {
  name: string;
  ryobi_email: string;
  ryobi_password: string;
  ryobi_device: Partial<RyobiGDODevice>;
  serial_number: string;
  debug_sensitive: boolean;
  poll_short_delay: number;
  poll_long_delay: number;
  ryobi: RyobiGDOApi;
  lastStateSeen: string | undefined;
  stateTimer: NodeJS.Timer | undefined;
  informationService: Service | undefined;
  garageDoorService: Service | undefined;

  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  constructor(public readonly logger: Logger, public readonly config: AccessoryConfig, public readonly api: API) {
    this.name = config.name;

    this.ryobi_email = config.email;
    this.ryobi_password = config.password;
    this.ryobi_device = { id: config.garagedoor_id };

    this.serial_number = '001';
    if (config.serial_number) {
      this.serial_number = config.serial_number;
    }

    if (!config.garagedoor_id) {
      const garagedoor_name = config.garagedoor_name;
      if (!config.name) {
        this.name = 'Garage Door: ' + garagedoor_name;
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
        credentials: {
          email: this.ryobi_email,
          password: this.ryobi_password,
        },
        cookies: {},
      },
      this.logger
    );

    this.pollState(); // kick off periodic polling;
  }

  async setState(targetState: CharacteristicValue) {
    if (targetState === undefined) {
      this.logger.debug('Error: target state is undefined');
      return;
    }

    const result =
      targetState == this.Characteristic.CurrentDoorState.CLOSED
        ? await this.ryobi.closeDoor(this.ryobi_device)
        : await this.ryobi.openDoor(this.ryobi_device);

    this.logger.debug('Set ' + this.name + ' to ' + targetState);
    if (targetState == this.Characteristic.CurrentDoorState.CLOSED) {
      this.garageDoorService?.setCharacteristic(
        this.Characteristic.CurrentDoorState,
        this.Characteristic.CurrentDoorState.OPENING
      );
    } else {
      this.garageDoorService?.setCharacteristic(
        this.Characteristic.CurrentDoorState,
        this.Characteristic.CurrentDoorState.CLOSING
      );
    }
    this.pollState();
  }

  async getState() {
    const state = await this.ryobi.getStatus(this.ryobi_device);
    if (this.lastStateSeen != state) {
      this.logger.debug('State of ' + this.name + ' is: ' + state);
    }
    this.lastStateSeen = state;
    this.logger.debug(
      'State of Characteristic.CurrentDoorState[state] is: ' + this.Characteristic.CurrentDoorState[state]
    );
    return this.Characteristic.CurrentDoorState[state];
  }

  pollState() {
    if (this.poll_short_delay < POLL_SHORT_DEFAULT * 1000) {
      this.logger.debug('***WARNING**: poll_short_delay values reset to default value--see doc.');
      this.poll_short_delay = POLL_SHORT_DEFAULT * 1000;
    }
    if (this.poll_long_delay < this.poll_short_delay) {
      this.logger.debug(
        '***WARNING**: poll_long_delay values too short. reset to default value--see doc. Recommend setting much longer'
      );
      this.poll_long_delay = POLL_LONG_DEFAULT * 1000;
    }

    // Clear any existing timer
    if (this.stateTimer) {
      clearTimeout(this.stateTimer);
      this.stateTimer = undefined;
    }

    //this.logger.debug("pollShort");
    this.stateTimer = setTimeout(() => this.pollStateNow(), this.poll_short_delay);
  }

  async pollStateNow() {
    const currentDeviceState = await this.getState();

    this.logger.log(LogLevel.INFO, 'GarageCmdAccessory.prototype.pollState: ' + currentDeviceState);

    if (
      currentDeviceState == this.Characteristic.CurrentDoorState.OPENING ||
      currentDeviceState == this.Characteristic.CurrentDoorState.CLOSING
    ) {
      this.stateTimer = setTimeout(() => this.pollStateNow(), this.poll_short_delay);
    } else {
      this.garageDoorService?.setCharacteristic(this.Characteristic.CurrentDoorState, currentDeviceState);
      this.stateTimer = setTimeout(() => this.pollStateNow(), this.poll_long_delay);
    }
  }

  getServices() {
    this.informationService = new this.api.hap.Service.AccessoryInformation();
    this.garageDoorService = new this.api.hap.Service.GarageDoorOpener(this.name);

    this.informationService
      .setCharacteristic(this.Characteristic.Manufacturer, 'Ryobi Garage-door Opener')
      .setCharacteristic(this.Characteristic.Model, 'Homebridge Plugin')
      .setCharacteristic(this.Characteristic.SerialNumber, this.serial_number);

    this.garageDoorService
      .getCharacteristic(this.Characteristic.TargetDoorState)
      .on('set', (value) => this.setState(value));

    this.garageDoorService.getCharacteristic(this.Characteristic.CurrentDoorState).on('get', this.getState.bind(this));

    this.garageDoorService.getCharacteristic(this.Characteristic.TargetDoorState).on('get', this.getState.bind(this));

    return [this.informationService, this.garageDoorService];
  }
}
