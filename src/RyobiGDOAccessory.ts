import { API, Characteristic, CharacteristicValue, Logger, LogLevel, PlatformAccessory, Service } from 'homebridge';
import { DoorState, RyobiGDOApi } from './RyobiGDOApi';
import { RyobiGDODevice } from './RyobiGDODevice';
import { RyobiGDOPlatform } from './RyobiGDOPlatform';

const POLL_SHORT_DEFAULT = 15e3;
const POLL_LONG_DEFAULT = 90e3;

export class RyobiGDOAccessory {
  serial_number: string;
  poll_short_delay = 15e3;
  poll_long_delay = 90e3;
  ryobi: RyobiGDOApi;
  lastStateSeen: DoorState | undefined;
  stateTimer: NodeJS.Timer | undefined;
  service: Service;

  public readonly logger: Logger = this.platform.logger;
  public readonly api: API = this.platform.api;
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  constructor(
    private readonly platform: RyobiGDOPlatform,
    private readonly accessory: PlatformAccessory,
    public readonly ryobi_device: Partial<RyobiGDODevice> = {},
  ) {
    this.ryobi_device = accessory.context.device;
    const config = platform.config;

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

    if (this.poll_short_delay < POLL_SHORT_DEFAULT) {
      this.logger.warn('poll_short_delay values reset to default value--see doc.');
      this.poll_short_delay = POLL_SHORT_DEFAULT;
    }

    if (this.poll_long_delay < this.poll_short_delay) {
      this.logger.warn('poll_long_delay values reset to default value--see doc.');
      this.poll_long_delay = POLL_LONG_DEFAULT;
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

    this.accessory
      .getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.Characteristic.Manufacturer, 'Ryobi Garage-door Opener')
      .setCharacteristic(this.Characteristic.Model, 'Homebridge Plugin')
      .setCharacteristic(this.Characteristic.SerialNumber, this.serial_number);

    this.service =
      this.accessory.getService(this.platform.Service.GarageDoorOpener) ??
      this.accessory.addService(this.platform.Service.GarageDoorOpener);
    this.service.setCharacteristic(
      this.platform.Characteristic.Name,
      'Garage Door: ' + this.ryobi_device.name ?? 'Unnamed Device',
    );

    this.service
      .getCharacteristic(this.Characteristic.CurrentDoorState)
      .onGet(async () => (await this.getState()) ?? 0);

    this.service
      .getCharacteristic(this.Characteristic.TargetDoorState)
      .onGet(async () => (await this.getState()) ?? 0)
      .onSet(async (value) => await this.setState(value));

    this.pollStateNow();
  }

  async setState(targetState: CharacteristicValue) {
    if (targetState === undefined) {
      this.logger.debug('Error: target state is undefined');
      return;
    }

    this.logger.info('Changing ' + this.ryobi_device.name + ' to ' + targetState);

    if (targetState == this.Characteristic.TargetDoorState.CLOSED) {
      this.service.setCharacteristic(
        this.Characteristic.CurrentDoorState,
        this.Characteristic.CurrentDoorState.CLOSING,
      );
      await this.ryobi.closeDoor(this.ryobi_device);
      // add 3 seconds to account for the warning beeps
      this.schedulePollState(this.poll_short_delay + 3e3);
    } else {
      this.service.setCharacteristic(
        this.Characteristic.CurrentDoorState,
        this.Characteristic.CurrentDoorState.OPENING,
      );
      await this.ryobi.openDoor(this.ryobi_device);
      this.schedulePollState();
    }
  }

  getState(): number | undefined {
    const doorState = this.Characteristic.CurrentDoorState[this.lastStateSeen ?? 'CLOSED'];
    return doorState;
  }

  public schedulePollState(delay: number = this.poll_short_delay) {
    if (this.stateTimer) {
      clearTimeout(this.stateTimer);
      this.stateTimer = undefined;
    }

    this.stateTimer = setTimeout(() => this.pollStateNow(), delay);
  }

  private async pollStateNow() {
    if (this.stateTimer) {
      clearTimeout(this.stateTimer);
      this.stateTimer = undefined;
    }

    const status = await this.ryobi.getStatus(this.ryobi_device);
    if (status !== this.lastStateSeen) {
      const currentDeviceState = this.Characteristic.CurrentDoorState[status ?? 'CLOSED'];
      this.service.setCharacteristic(this.Characteristic.CurrentDoorState, currentDeviceState);
      this.logger.info(this.ryobi_device.name + ' state: ' + currentDeviceState);
    }

    this.stateTimer = setTimeout(() => this.pollStateNow(), this.poll_long_delay);
  }
}
