import { Logger } from 'homebridge';
import fetch, { RequestInit } from 'node-fetch';
import WebSocket from 'ws';
import { DeviceStatusResponse, GetDeviceResponse, LoginResponse } from './RyobiGDO';
import { RyobiGDODevice } from './RyobiGDODevice';

const apikeyURL = 'https://tti.tiwiconnect.com/api/login';
const deviceURL = 'https://tti.tiwiconnect.com/api/devices';
const websocketURL = 'wss://tti.tiwiconnect.com/api/wsrpc';

export class RyobiGDOApi {
  apiKey: string | undefined;
  cookies: Record<string, string> = {};
  cookieExpires: Date | undefined;

  constructor(private readonly credentials: { email: string; password: string }, private readonly logger: Logger) {
    this.credentials = credentials;
  }

  public async openDoor(device: Partial<RyobiGDODevice>) {
    this.logger.debug('GARAGEDOOR openDoor');
    const result = await this.sendWebsocketCommand(device, { doorCommand: 1 });
    this.logger.debug('result:' + result);
  }

  public async closeDoor(device: Partial<RyobiGDODevice>) {
    this.logger.debug('GARAGEDOOR closeDoor');
    await this.sendWebsocketCommand(device, { doorCommand: 0 });
  }

  public async getStatus(device: Partial<RyobiGDODevice>) {
    this.logger.debug('Updating ryobi data');

    await this.updateDevice(device);

    if (device.state === undefined) {
      this.logger.error('Unable to query door state');
      return undefined;
    }

    const DOOR_STATE_MAP = {
      0: 'CLOSED',
      1: 'OPEN',
      2: 'CLOSING',
      3: 'OPENING',
    };

    const homekit_doorstate = DOOR_STATE_MAP[device.state] ?? 'UNKNOWN';
    this.logger.debug('GARAGEDOOR STATE:' + homekit_doorstate);
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
        m?.at?.moduleProfiles?.value?.some((v) => typeof v === 'string' && v.indexOf('garageDoor_') === 0)
    );

    device.portId = toNumber(garageDoorModule?.at?.portId?.value);
    device.moduleId = toNumber(garageDoorModule?.at?.moduleId?.value);
    device.state = toNumber(values.result?.[0]?.deviceTypeMap?.['garageDoor_' + device.portId]?.at?.doorState?.value);
  }

  private async request(url: string, init?: RequestInit) {
    const cookie = Object.keys(this.cookies)
      .map((key) => key + '=' + this.cookies[key])
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
        this.cookieExpires = new Date(parseInt(cookie.match(/Expires\s*=\s*([^;]+)/i)?.[1] ?? ''));
      }
      const match = cookie.match(/([^=]+)=([^;]+)/);
      if (match) {
        this.cookies[match[1]] = match[2];
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
    if (this.apiKey && this.cookieExpires && this.cookieExpires > new Date()) {
      return this.apiKey;
    }

    const result = await this.getJson<LoginResponse>(apikeyURL, {
      method: 'post',
      body: `username=${encodeURIComponent(this.credentials.email)}&password=${encodeURIComponent(
        this.credentials.password
      )}`,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    if (typeof result.result == 'string' || !result.result?.auth?.apiKey) {
      throw new Error('Unauthorized -- check your ryobi username/password: ' + result.result);
    }

    this.apiKey = result.result.auth.apiKey;
    return this.apiKey;
  }

  public async getDevices() {
    await this.getApiKey();
    const devices = await this.getDevicesRaw();
    return devices.map((device) => ({
      description: device.metaData?.description,
      name: device.metaData?.name,
      id: device.varName,
      model: device.deviceTypeIds?.[0],
    }));
  }

  private async getDeviceId(device: Partial<RyobiGDODevice>) {
    if (device.id) return;
    this.logger.debug('getDeviceId');

    const devices = await this.getDevices();

    if (!device.id && device.name) {
      Object.assign(
        device,
        devices.find((x) => x.name === device.name)
      );
    } else {
      Object.assign(
        device,
        devices.find((x) => x.model !== 'gda500hub')
      );
    }

    this.logger.debug('doorid: ' + device.id);
  }

  public async getDevicesRaw() {
    const result = await this.getJson<GetDeviceResponse>(deviceURL);

    if (typeof result.result === 'string' || !Array.isArray(result.result)) {
      throw new Error('Unauthorized -- check your ryobi username/password: ' + result.result);
    }
    return result?.result;
  }

  private async sendWebsocketCommand(device: Partial<RyobiGDODevice>, message: object) {
    const ws = new WebSocket(websocketURL);

    if (!device.moduleId || !device.portId) {
      await this.updateDevice(device);
    }

    if (!device.moduleId) throw new Error('doorModuleId is undefined');
    if (!device.portId) throw new Error('doorPortId is undefined');

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
        if (!returnObj.result?.authorized) return;
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
          2
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

export function findDeviceIdByName(result: GetDeviceResponse['result'], name: string) {
  if (!Array.isArray(result)) return undefined;
  return result.find((x) => x.metaData?.name === name)?.varName;
}
