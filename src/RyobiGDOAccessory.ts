import {
  AccessoryConfig,
  AccessoryPlugin,
  API,
  Characteristic,
  CharacteristicValue,
  Logger,
  PlatformAccessory,
  Service,
  UnknownContext,
} from 'homebridge';
import { RyobiGDOApi } from './RyobiGDOApi';
import { RyobiGDODevice } from './RyobiGDODevice';
import { RyobiGDOPlatform } from './RyobiGDOPlatform';
import { RyobiGDOSession } from './RyobiGDOSession';

const POLL_SHORT_DEFAULT = 15e3;
const POLL_LONG_DEFAULT = 90e3;

interface AccesoryOptions {
  platform?: RyobiGDOPlatform;
  api: API;
  accessory?: PlatformAccessory;
  logger?: Logger;
  config?: AccessoryConfig;
}

export class RyobiGDOAccessory {
  serial_number: string;
  poll_short_delay = 15e3;
  poll_long_delay = 90e3;
  ryobi: RyobiGDOApi;
  stateTimer: NodeJS.Timer | undefined;
  garageDoorService?: Service;

  public readonly logger: Logger;
  public readonly Service: typeof Service;
  public readonly Characteristic: typeof Characteristic;
  public readonly ryobi_device: Partial<RyobiGDODevice>;
  private readonly api: API;
  private readonly context?: UnknownContext;
  private readonly session: RyobiGDOSession;

  constructor(options: AccesoryOptions) {
    const logger = options.logger ?? options.platform?.logger;
    if (!logger) {
      throw new Error('logger must be provided');
    }
    this.logger = logger;
    this.api = options.api;
    this.Service = this.api.hap.Service;
    this.Characteristic = this.api.hap.Characteristic;

    this.context = options.accessory?.context;
    this.ryobi_device = options.accessory?.context.device ?? options.config ?? {};
    const config = options.platform?.config ?? options.config;
    if (!config) {
      throw new Error('config must be provided');
    }

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

    this.session = {
      cookies: {},
    };
    const accessory = options.accessory;
    if (accessory) {
      this.configureServices(
        accessory.getService(this.Service.AccessoryInformation)!,
        accessory.getService(this.Service.GarageDoorOpener) ?? accessory.addService(this.Service.GarageDoorOpener),
      );

      this.session.apiKey = accessory.context.apiKey;
      if (accessory.context.cookieExpires) {
        const expires = new Date(parseInt(accessory.context.cookieExpires));
        this.session.cookieExpires = expires.getTime() ? expires : undefined;
      }

      if (accessory.context.cookies) {
        try {
          Object.assign(this.session.cookies, JSON.parse(accessory.context.cookies));
        } catch {
          this.logger.warn('Unable to parse cookies: ' + accessory.context.cookies);
          this.session.cookies = {};
        }
      }
    }

    this.logger.info('Restored session: ' + JSON.stringify(this.session, null, 2));

    this.ryobi = new RyobiGDOApi(
      this.session,
      {
        email: config.email,
        password: config.password,
      },
      this.logger,
    );

    this.pollStateNow();
  }

  public configureServices(informationService: Service, garageDoorService: Service) {
    informationService
      .setCharacteristic(this.Characteristic.Manufacturer, 'Ryobi Garage-door Opener')
      .setCharacteristic(this.Characteristic.Model, 'Homebridge Plugin')
      .setCharacteristic(this.Characteristic.SerialNumber, this.serial_number);

    garageDoorService.setCharacteristic(this.Characteristic.Name, this.ryobi_device.name ?? 'Unnamed Device');

    garageDoorService.getCharacteristic(this.Characteristic.CurrentDoorState).onGet(() => this.getState() ?? 0);

    this.garageDoorService = garageDoorService;
    garageDoorService
      .getCharacteristic(this.Characteristic.TargetDoorState)
      .onGet(() => {
        const state = this.getState() ?? this.Characteristic.TargetDoorState.CLOSED;
        switch (state) {
          case this.Characteristic.CurrentDoorState.OPENING:
            return this.Characteristic.TargetDoorState.OPEN;
          case this.Characteristic.CurrentDoorState.CLOSING:
            return this.Characteristic.TargetDoorState.CLOSED;
          default:
            return state;
        }
      })
      .onSet(async (value) => await this.setState(value));
  }

  async setState(targetState: CharacteristicValue) {
    const { garageDoorService } = this;
    if (!garageDoorService) {
      this.logger.error('garageDoorServices is undefined');
      return;
    }

    if (targetState === undefined) {
      this.logger.debug('Error: target state is undefined');
      return;
    }

    this.logger.info('Changing ' + this.ryobi_device.name + ' to ' + targetState);

    if (targetState === this.Characteristic.TargetDoorState.CLOSED) {
      garageDoorService.setCharacteristic(this.Characteristic.CurrentDoorState, this.Characteristic.CurrentDoorState.CLOSING);
      await this.ryobi.closeDoor(this.ryobi_device);
      this.schedulePollState(this.poll_short_delay);
    } else {
      garageDoorService.setCharacteristic(this.Characteristic.CurrentDoorState, this.Characteristic.CurrentDoorState.OPENING);
      await this.ryobi.openDoor(this.ryobi_device);
      this.schedulePollState();
    }
    this.updateContext();
  }

  getState(): number | undefined {
    const value = this.garageDoorService?.getCharacteristic(this.Characteristic.CurrentDoorState).value ?? this.context?.state;
    if (typeof value === 'number') {
      return value;
    }
    if (value) {
      this.logger.error('typeof value is ' + typeof value + '; ' + value);
    }
    return this.Characteristic.CurrentDoorState.CLOSED;
  }

  private cancelPoll() {
    if (this.stateTimer) {
      clearTimeout(this.stateTimer);
      this.stateTimer = undefined;
    }
  }

  public schedulePollState(delay: number = this.poll_short_delay) {
    this.cancelPoll();
    this.stateTimer = setTimeout(() => this.pollStateNow(), delay);
  }

  private async pollStateNow() {
    this.cancelPoll();
    this.logger.info(`Polling state of ${this.ryobi_device.name}`);
    const status = await this.ryobi.getStatus(this.ryobi_device);
    this.updateContext();
    const state = this.Characteristic.CurrentDoorState[status ?? 'CLOSED'];
    this.logger.info(`${this.ryobi_device.name}: ${status} (${state})`);

    const { garageDoorService } = this;
    if (!garageDoorService) {
      this.logger.error('garageDoorServices is undefined');
      return;
    }

    if (state !== this.getState()) {
      garageDoorService.setCharacteristic(this.Characteristic.CurrentDoorState, state);
    }

    if (this.context) {
      this.context.state = state;
    }

    const isActive = state === this.Characteristic.CurrentDoorState.OPENING || state === this.Characteristic.CurrentDoorState.CLOSING;
    const delay = isActive ? 3e3 : this.poll_long_delay;
    this.stateTimer = setTimeout(() => this.pollStateNow(), delay);
  }

  private updateContext() {
    const { context } = this;
    if (!context) {
      return;
    }

    context.apiKey = this.session.apiKey;
    context.cookieExpires = this.session.cookieExpires?.getTime();
    context.cookies = JSON.stringify(this.session.cookies);
  }
}

export class StandaloneRyobiGDOAccessory extends RyobiGDOAccessory implements AccessoryPlugin {
  name: string;

  constructor(logger: Logger, config: AccessoryConfig, api: API) {
    super({ config, api, logger });
    this.name = config.name;
  }

  getServices(): Service[] {
    const informationService = new this.Service.AccessoryInformation();
    this.garageDoorService = new this.Service.GarageDoorOpener(this.name);
    this.configureServices(informationService, this.garageDoorService);
    return [informationService, this.garageDoorService];
  }
}
