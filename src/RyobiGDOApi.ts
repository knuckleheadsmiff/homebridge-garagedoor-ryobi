import { Logger } from 'homebridge';
import fetch, { RequestInit } from 'node-fetch';
import WebSocket from 'ws';
import { DeviceStatusResponse, GetDeviceResponse, LoginResponse } from './RyobiGDO';
import { RyobiGDOCredentials } from './RyobiGDOCredentials';
import { RyobiGDODevice } from './RyobiGDODevice';
import { RyobiGDOSession } from './RyobiGDOSession';

const apikeyURL = 'https://tti.tiwiconnect.com/api/login';
const deviceURL = 'https://tti.tiwiconnect.com/api/devices';
const websocketURL = 'wss://tti.tiwiconnect.com/api/wsrpc';

export type DoorState = 'CLOSED' | 'OPEN' | 'CLOSING' | 'OPENING';
const doorStateMap = new Map<number, DoorState>([
  [0, 'CLOSED'],
  [1, 'OPEN'],
  [2, 'CLOSING'],
  [3, 'OPENING'],
]);

export class RyobiGDOApi {
  constructor(
    private readonly session: RyobiGDOSession,
    private readonly credentials: RyobiGDOCredentials,
    private readonly logger: Logger,
  ) {}

  public async openDoor(device: Partial<RyobiGDODevice>): Promise<void> {
    this.logger.debug('GARAGEDOOR openDoor');
    const result = await this.sendWebsocketCommand(device, { doorCommand: 1 });
    this.logger.debug('result:' + result);
  }

  public async closeDoor(device: Partial<RyobiGDODevice>): Promise<void> {
    this.logger.info('GARAGEDOOR closeDoor');
    await this.sendWebsocketCommand(device, { doorCommand: 0 });
  }

  public async getStatus(device: Partial<RyobiGDODevice>): Promise<DoorState | undefined> {
    this.logger.debug('Updating ryobi data');

    await this.updateDevice(device);

    if (device.state === undefined) {
      this.logger.error('Unable to query door state');
      return undefined;
    }

    const homekit_doorstate = doorStateMap.get(device.state);
    this.logger.info('GARAGEDOOR STATE: ' + device.state + '/' + homekit_doorstate);
    return homekit_doorstate;
  }

  private async updateDevice(device: Partial<RyobiGDODevice>) {
    if (!device.id) {
      await this.getDeviceId(device);
    }

    const queryUri = deviceURL + '/' + device.id;
    await this.getApiKey();
    const values = await this.getJson<DeviceStatusResponse>(queryUri);

    if (!values?.result?.length) {
      throw new Error('Invalid response: ' + JSON.stringify(values, null, 2));
    }

    const map = values.result?.[0]?.deviceTypeMap;
    if (!map) {
      this.logger.error('deviceTypeMap not found');
      return;
    }
    const garageDoorModule = Object.values(map).find(
      (m) =>
        Array.isArray(m?.at?.moduleProfiles?.value) &&
        m?.at?.moduleProfiles?.value?.some((v) => typeof v === 'string' && v.indexOf('garageDoor_') === 0),
    );

    device.portId = toNumber(garageDoorModule?.at?.portId?.value);
    device.moduleId = toNumber(garageDoorModule?.at?.moduleId?.value);
    device.state = toNumber(values.result?.[0]?.deviceTypeMap?.['garageDoor_' + device.portId]?.at?.doorState?.value);
    device.stateAsOf = Date.now();
  }

  private async request(url: string, init?: RequestInit) {
    const cookie = Object.keys(this.session.cookies)
      .map((key) => key + '=' + this.session.cookies[key])
      .join('; ');
    this.logger.debug('GET ' + url);

    const response = await fetch(url, {
      ...init,
      headers: {
        ...init?.headers,
        cookie,
      },
    });

    const cookies = response.headers.raw()['set-cookie'] ?? [];
    for (const cookie of cookies) {
      if (cookie.indexOf('Expires') > -1) {
        this.session.cookieExpires = new Date(parseInt(cookie.match(/Expires\s*=\s*([^;]+)/i)?.[1] ?? ''));
      }
      const match = cookie.match(/([^=]+)=([^;]+)/);
      if (match) {
        this.session.cookies[match[1]] = match[2];
      }
    }
    return response;
  }

  private async getJson<T = unknown>(url: string, init?: RequestInit) {
    const response = await this.request(url, init);
    const text = await response.text();
    this.logger.debug(text);
    return JSON.parse(text) as T;
  }

  private async getApiKey() {
    this.logger.debug('getApiKey');
    if (this.session.apiKey && this.session.cookieExpires && this.session.cookieExpires > new Date()) {
      return this.session.apiKey;
    }

    const result = await this.getJson<LoginResponse>(apikeyURL, {
      method: 'post',
      body: `username=${encodeURIComponent(this.credentials.email)}&password=${encodeURIComponent(
        this.credentials.password,
      )}`,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (typeof result.result === 'string' || !result.result?.auth?.apiKey) {
      throw new Error('Unauthorized -- check your ryobi username/password: ' + result.result);
    }

    this.session.apiKey = result.result.auth.apiKey;
    return this.session.apiKey;
  }

  public async getDevices(): Promise<RyobiGDODevice[]> {
    await this.getApiKey();
    const devices = await this.getDevicesRaw();
    return devices.map((device) => ({
      description: device.metaData?.description ?? '',
      name: device.metaData?.name ?? '',
      id: device.varName ?? '',
      model: device.deviceTypeIds?.[0] ?? '',
      type: /hub/i.test(device.deviceTypeIds?.[0] ?? '') ? 'hub' : 'gdo',
    }));
  }

  private async getDeviceId(device: Partial<RyobiGDODevice>) {
    if (device.id) {
      return;
    }
    this.logger.debug('getDeviceId');

    const devices = await this.getDevices();

    if (!device.id && device.name) {
      Object.assign(
        device,
        devices.find((x) => x.name === device.name),
      );
    } else {
      Object.assign(
        device,
        devices.find((x) => x.type !== 'hub'),
      );
    }

    this.logger.debug('device.id: ' + device.id);
  }

  private async getDevicesRaw() {
    const result = await this.getJson<GetDeviceResponse>(deviceURL);

    if (typeof result.result === 'string' || !Array.isArray(result.result)) {
      throw new Error('Unauthorized -- check your ryobi username/password: ' + result.result);
    }
    return result?.result;
  }

  private async sendWebsocketCommand(device: Partial<RyobiGDODevice>, message: unknown) {
    const ws = new WebSocket(websocketURL);

    if (!device.moduleId || !device.portId) {
      await this.updateDevice(device);
    }

    if (!device.moduleId) {
      throw new Error('doorModuleId is undefined');
    }
    if (!device.portId) {
      throw new Error('doorPortId is undefined');
    }

    const apiKey = await this.getApiKey();
    const promise = new Promise<void>((resolve) => {
      ws.on('open', () => {
        const login = JSON.stringify({
          jsonrpc: '2.0',
          id: 3,
          method: 'srvWebSocketAuth',
          params: { varName: this.credentials.email, apiKey },
        });
        ws.send(login);
      });

      ws.on('message', (data) => {
        this.logger.debug('message received: ' + data);

        const returnObj = JSON.parse(data.toString());
        if (!returnObj.result?.authorized) {
          return;
        }
        const sendMessage = JSON.stringify(
          {
            jsonrpc: '2.0',
            method: 'gdoModuleCommand',
            params: {
              msgType: 16,
              moduleType: device.moduleId,
              portId: device.portId,
              moduleMsg: message,
              topic: device.id,
            },
          },
          null,
          2,
        );
        this.logger.debug('sending websocket: ' + sendMessage);
        ws.send(sendMessage);
        ws.ping();
      });

      ws.on('pong', () => {
        this.logger.debug('pong; terminate');
        ws.terminate();
        resolve();
      });
    });
    await promise;
  }
}

function toNumber(value: unknown) {
  return typeof value === 'number' ? value : undefined;
}
