import {
  AccessoryConfig,
  AccessoryPlugin,
  API,
  Characteristic,
  CharacteristicValue,
  Logger,
  LogLevel,
  PlatformConfig,
  Service,
} from 'homebridge';
import { RyobiGDOApi } from './RyobiGDOApi';
import { RyobiGDODevice } from './RyobiGDODevice';

const POLL_SHORT_DEFAULT = 15;
const POLL_LONG_DEFAULT = 90;

export class RyobiGDOAccessory implements AccessoryPlugin {
  serial_number: string;
  poll_short_delay: number = 15e3;
  poll_long_delay: number = 90e3;
  ryobi: RyobiGDOApi;
  lastStateSeen: string | undefined;
  stateTimer: NodeJS.Timer | undefined;
  informationService: Service | undefined;
  garageDoorService: Service | undefined;

  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  constructor(
    public readonly logger: Logger,
    public readonly config: AccessoryConfig | PlatformConfig,
    public readonly api: API,
    public readonly ryobi_device: Partial<RyobiGDODevice> = {},
  ) {
    this.ryobi_device = { id: config.garagedoor_id, name: config.name ?? config.garagedoor_name };

    this.serial_number = '001';
    if (config.serial_number) {
      this.serial_number = config.serial_number;
    }

    if (typeof config.poll_short_delay === 'number' && config.poll_short_delay) {
      this.poll_short_delay = config.poll_short_delay * 1000;
    }
    if (typeof config.poll_long_delay === 'number' && config.poll_long_delay) {
      this.poll_long_delay = config.poll_long_delay * 1000;
    }

    this.ryobi = new RyobiGDOApi(
      {
        cookies: {},
      },
      {
        email: config.email,
        password: config.password,
      },
      this.logger,
    );

    this.pollState();
  }

  async setState(targetState: CharacteristicValue) {
    if (targetState === undefined) {
      this.logger.debug('Error: target state is undefined');
      return;
    }

    if (targetState === this.Characteristic.CurrentDoorState.CLOSED) {
      await this.ryobi.closeDoor(this.ryobi_device);
    } else {
      await this.ryobi.openDoor(this.ryobi_device);
    }

    this.logger.debug('Set ' + this.ryobi_device.name + ' to ' + targetState);
    if (targetState === this.Characteristic.CurrentDoorState.CLOSED) {
      this.garageDoorService?.setCharacteristic(
        this.Characteristic.CurrentDoorState,
        this.Characteristic.CurrentDoorState.OPENING,
      );
    } else {
      this.garageDoorService?.setCharacteristic(
        this.Characteristic.CurrentDoorState,
        this.Characteristic.CurrentDoorState.CLOSING,
      );
    }
    this.pollState();
  }

  async getState(): Promise<number | undefined> {
    const state = await this.ryobi.getStatus(this.ryobi_device);
    if (state === undefined) {
      this.logger.error('Unable to query door state');
      return;
    }

    if (this.lastStateSeen !== state) {
      this.logger.debug('State of ' + this.ryobi_device.name + ' is: ' + state);
    }
    this.lastStateSeen = state;

    const doorState = this.Characteristic.CurrentDoorState[state];
    this.logger.debug('State of Characteristic.CurrentDoorState[state] is: ' + doorState);
    return doorState;
  }

  pollState() {
    if (this.poll_short_delay < POLL_SHORT_DEFAULT * 1000) {
      this.logger.warn('poll_short_delay values reset to default value--see doc.');
      this.poll_short_delay = POLL_SHORT_DEFAULT * 1000;
    }

    if (this.poll_long_delay < this.poll_short_delay) {
      this.logger.warn(
        'poll_long_delay values too short. reset to default value--see doc. Recommend setting much longer',
      );
      this.poll_long_delay = POLL_LONG_DEFAULT * 1000;
    }

    if (this.stateTimer) {
      clearTimeout(this.stateTimer);
      this.stateTimer = undefined;
    }

    this.stateTimer = setTimeout(() => this.pollStateNow(), this.poll_short_delay);
  }

  async pollStateNow() {
    const currentDeviceState = await this.getState();
    this.logger.log(LogLevel.INFO, 'GarageCmdAccessory.prototype.pollState: ' + currentDeviceState);
    if (currentDeviceState === undefined) {
      return;
    }

    if (
      currentDeviceState === this.Characteristic.CurrentDoorState.OPENING ||
      currentDeviceState === this.Characteristic.CurrentDoorState.CLOSING
    ) {
      this.stateTimer = setTimeout(() => this.pollStateNow(), this.poll_short_delay);
    } else {
      this.garageDoorService?.setCharacteristic(this.Characteristic.CurrentDoorState, currentDeviceState);
      this.stateTimer = setTimeout(() => this.pollStateNow(), this.poll_long_delay);
    }
  }

  getServices() {
    this.informationService = new this.api.hap.Service.AccessoryInformation();
    this.garageDoorService = new this.api.hap.Service.GarageDoorOpener(this.ryobi_device.name);

    this.informationService
      .setCharacteristic(this.Characteristic.Manufacturer, 'Ryobi Garage-door Opener')
      .setCharacteristic(this.Characteristic.Model, 'Homebridge Plugin')
      .setCharacteristic(this.Characteristic.SerialNumber, this.serial_number);

    this.garageDoorService
      .getCharacteristic(this.Characteristic.TargetDoorState)
      .on('set', (value) => this.setState(value));

    this.garageDoorService.getCharacteristic(this.Characteristic.CurrentDoorState).on('get', () => this.getState());
    this.garageDoorService.getCharacteristic(this.Characteristic.TargetDoorState).on('get', () => this.getState());

    return [this.informationService, this.garageDoorService];
  }
}
