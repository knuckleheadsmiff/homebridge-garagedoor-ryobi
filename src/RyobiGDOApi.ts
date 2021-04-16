import { Logger } from 'homebridge';
import fetch, { RequestInit } from 'node-fetch';
import WebSocket from 'ws';
import { DeviceStatusResponse, GetDeviceResponse, LoginResponse } from './RyobiGDO';

const apikeyURL = 'https://tti.tiwiconnect.com/api/login';
const deviceURL = 'https://tti.tiwiconnect.com/api/devices';
const websocketURL = 'wss://tti.tiwiconnect.com/api/wsrpc';

export class RyobiGDOApi {
  deviceId: string | undefined;
  deviceName: string | undefined;
  apiKey: string | undefined;
  cookies: Record<string, string> = {};
  cookieExpires: Date | undefined;
  doorModuleId: number | undefined;
  doorPortId: number | undefined;

  constructor(
    private readonly credentials: { email: string; password: string },
    device: { id?: string; name?: string },
    private readonly logger: Logger
  ) {
    this.credentials = credentials;
    if (device?.name) {
      this.deviceName = device.name;
    } else {
      this.deviceId = device.id;
    }
  }

  async request(url: string, init?: RequestInit) {
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

  async getJson<T = unknown>(url: string, init?: RequestInit) {
    const response = await this.request(url, init);
    const text = await response.text();
    this.logger.debug(text);
    return JSON.parse(text) as T;
  }

  async getApiKey() {
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

  async getDeviceID() {
    if (this.deviceId) return this.deviceId;
    this.logger.debug('getDeviceID');

    const apiKey = await this.getApiKey();
    if (this.deviceId && typeof this.deviceId !== 'function') {
      this.logger.debug('doorid: ' + this.deviceId);
      return this.deviceId;
    }

    const result = await this.getJson<GetDeviceResponse>(deviceURL);

    if (typeof result.result === 'string' || !Array.isArray(result.result)) {
      throw new Error('Unauthorized -- check your ryobi username/password: ' + result.result);
    }

    if (!this.deviceId && this.deviceName) {
      this.deviceId = findDeviceIdByName(result, this.deviceName);
    } else {
      const deviceModel = result.result[0].deviceTypeIds?.[0];
      this.deviceId = deviceModel == 'gda500hub' ? result.result[1].varName : result.result[0].varName;
    }

    this.logger.debug('doorid: ' + this.deviceId);
    return this.deviceId;
  }

  async getStatus() {
    this.logger.debug('Updating ryobi data');
    const deviceID = await this.getDeviceID();

    const queryUri = deviceURL + '/' + deviceID;
    const result = await this.getJson<DeviceStatusResponse>(queryUri);
    const state = this.parseReport(result);
    return state;
  }

  private parseReport(values: DeviceStatusResponse) {
    this.logger.debug('parseReport ryobi data:');

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

    this.doorPortId = toNumber(garageDoorModule?.at?.portId?.value);
    this.doorModuleId = toNumber(garageDoorModule?.at?.moduleId?.value);

    if (!this.doorPortId || !this.doorModuleId) {
      this.logger.debug(JSON.stringify(garageDoorModule, null, 2));
      throw new Error('Invalid response');
    }

    const doorval = toNumber(
      values.result?.[0]?.deviceTypeMap?.['garageDoor_' + this.doorPortId]?.at?.doorState?.value
    );

    if (doorval === undefined) {
      this.logger.error('Unable to query door state');
      return undefined;
    }

    const DOOR_STATE_MAP = {
      0: 'CLOSED',
      1: 'OPEN',
      2: 'CLOSING',
      3: 'OPENING',
    };

    const homekit_doorstate = DOOR_STATE_MAP[doorval] ?? 'UNKNOWN';
    this.logger.debug('GARAGEDOOR STATE:' + homekit_doorstate);
    return homekit_doorstate;
  }

  private async sendWebsocketCommand(message: object, state: string) {
    await this.getStatus();
    const ws = new WebSocket(websocketURL);

    if (!this.doorModuleId) throw new Error('doorModuleId is undefined');
    if (!this.doorPortId) throw new Error('doorPortId is undefined');

    const promise = new Promise<string>((resolve) => {
      ws.on('open', () => {
        const login = JSON.stringify({
          jsonrpc: '2.0',
          id: 3,
          method: 'srvWebSocketAuth',
          params: { varName: this.credentials.email, apiKey: this.apiKey },
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
              moduleType: this.doorModuleId,
              portId: this.doorPortId,
              moduleMsg: message,
              topic: this.deviceId,
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
        resolve(state);
      });
    });
    const doorState = await promise;
    return doorState;
  }

  async openDoor() {
    this.logger.debug('GARAGEDOOR openDoor');
    const result = await this.sendWebsocketCommand({ doorCommand: 1 }, 'OPENING');
    this.logger.debug('result:' + result);
  }

  async closeDoor() {
    this.logger.debug('GARAGEDOOR closeDoor');
    await this.sendWebsocketCommand({ doorCommand: 0 }, 'CLOSING');
  }
}

function toNumber(value: unknown) {
  return typeof value === 'number' ? value : undefined;
}

export function findDeviceIdByName(obj: GetDeviceResponse, name: string) {
  if (!Array.isArray(obj.result)) return undefined;
  return obj.result.find((x) => x.metaData?.name === name)?.varName;
}
