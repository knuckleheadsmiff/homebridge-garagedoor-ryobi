import { Logging } from "homebridge";
import fetch, { RequestInit } from "node-fetch";
import WebSocket from "ws";

const apikeyURL = "https://tti.tiwiconnect.com/api/login";
const deviceURL = "https://tti.tiwiconnect.com/api/devices";
const websocketURL = "wss://tti.tiwiconnect.com/api/wsrpc";

export class RyobiGDOApi {
  logging: Logging | undefined;
  credentials: { email: string; password: string };
  deviceId: string | undefined;
  deviceName: string | undefined;
  debug_sensitive = false;
  apiKey: string | undefined;
  cookies: Record<string, string> = {};
  cookieExpires: Date | undefined;
  doorModuleId: number | undefined;
  doorPortId: number | undefined;

  constructor(
    credentials: { email: string; password: string },
    device: { id?: string; name?: string },
    logging: Logging | undefined,
    debug_sensitive = false
  ) {
    this.credentials = credentials;
    if (device?.name) {
      this.deviceName = device.name;
    } else {
      this.deviceId = device.id;
    }
    this.logging = logging;
    this.debug_sensitive = debug_sensitive;
  }

  request(url: string, init?: RequestInit) {
    const cookie = Object.keys(this.cookies)
      .map((key) => key + "=" + this.cookies[key])
      .join("; ");
    console.log(cookie);
    const response = fetch(url, {
      ...init,
      headers: {
        ...init?.headers,
        cookie,
      },
    });
    return response;
  }

  log(message: unknown) {
    if (this.logging) {
      this.logging?.(String(message));
    } else {
      console.log(message);
    }
  }

  async getApiKey() {
    this.log("getApiKey");
    if (this.apiKey && this.cookieExpires && this.cookieExpires > new Date()) {
      if (this.debug_sensitive) this.log("apiKey: " + this.apiKey);
      return this.apiKey;
    }

    const response = await this.request(apikeyURL, {
      method: "post",
      body: `username=${encodeURIComponent(
        this.credentials.email
      )}&password=${encodeURIComponent(this.credentials.password)}`,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });

    this.log("getApiKey responded");
    const cookies = response.headers.raw()["set-cookie"] ?? [];
    for (const cookie of cookies) {
      if (cookie.indexOf("Expires") > -1) {
        this.cookieExpires = new Date(
          parseInt(cookie.match(/Expires\s*=\s*([^;]+)/i)?.[1] ?? "")
        );
      }
      const match = cookie.match(/([^=]+)=([^;]+)/);
      if (match) {
        this.cookies[match[1]] = match[2];
      }
    }

    const body = await response.text();
    if (this.debug_sensitive) this.log("body: " + body);
    const result = JSON.parse(body);

    // can see: {"result":"Unauthorized"}
    if (
      result.result == "Unauthorized" ||
      result.result === "Incorrect username/password"
    ) {
      throw new Error("Unauthorized -- check your ryobi username/password");
    }

    this.apiKey = result.result.auth.apiKey;
    if (this.debug_sensitive) this.log("apiKey: " + this.apiKey);
    return this.apiKey;
  }

  async getDeviceID() {
    if (this.deviceId) return this.deviceId;
    this.log("getDeviceID");

    const apiKey = await this.getApiKey();
    if (this.deviceId && typeof this.deviceId !== "function") {
      if (this.debug_sensitive) this.log("doorid: " + this.deviceId);
      return this.deviceId;
    }

    const response = await this.request(deviceURL);
    this.log("getDeviceID responded");
    const body = await response.text();
    if (this.debug_sensitive) this.log("body: " + body);

    const result = JSON.parse(body);

    if (result.result == "Unauthorized") {
      throw new Error("Unauthorized -- check your ryobi username/password");
    }

    if (!this.deviceId && this.deviceName) {
      this.deviceId = findDeviceIdByName(result, this.deviceName);
    } else {
      const deviceModel = result.result[0].deviceTypeIds[0];
      this.deviceId =
        deviceModel == "gda500hub"
          ? result.result[1].varName
          : result.result[0].varName;
    }

    if (this.debug_sensitive) this.log("doorid: " + this.deviceId);
    return this.deviceId;
  }

  async update() {
    this.log("Updating ryobi data:");
    const deviceID = await this.getDeviceID();

    const queryUri = deviceURL + "/" + deviceID;
    const response = await this.request(queryUri);
    this.log("GetStatus responded: ");
    const body = await response.text();
    if (this.debug_sensitive) this.log("body: " + body);

    const result = JSON.parse(body);
    const state = this.parseReport(result);
    return state;
  }

  private parseReport(values: any) {
    this.log("parseReport ryobi data:");
    let homekit_doorstate: string;

    if (!values?.result?.length) {
      throw new Error("Invalid response: " + JSON.stringify(values, null, 2));
    }

    const garageDoorModule: any = Object.values(
      values.result[0].deviceTypeMap
    ).find((m) =>
      (m as any)?.at?.moduleProfiles?.value?.some(
        (v) => v.indexOf("garageDoor_") === 0
      )
    );

    this.doorPortId = garageDoorModule?.at?.portId?.value;
    this.doorModuleId = garageDoorModule?.at?.moduleId?.value;

    if (!this.doorPortId || !this.doorModuleId) {
      console.log(JSON.stringify(garageDoorModule, null, 2));
      throw new Error("Invalid response");
    }

    const doorval =
      values.result[0].deviceTypeMap["garageDoor_" + this.doorPortId].at
        .doorState.value;

    if (doorval === 0) {
      homekit_doorstate = "CLOSED";
    } else if (doorval === 1) {
      homekit_doorstate = "OPEN";
    } else if (doorval === 2) {
      homekit_doorstate = "CLOSING";
    } else {
      homekit_doorstate = "OPENING";
    }

    this.log("GARAGEDOOR STATE:" + homekit_doorstate);
    return homekit_doorstate;
  }

  private async sendWebsocketCommand(message: object, state: string) {
    await this.update();
    const ws = new WebSocket(websocketURL);

    if (!this.doorModuleId) throw new Error("doorModuleId is undefined");
    if (!this.doorPortId) throw new Error("doorPortId is undefined");

    const promise = new Promise<string>((resolve) => {
      ws.on("open", () => {
        const login = JSON.stringify({
          jsonrpc: "2.0",
          id: 3,
          method: "srvWebSocketAuth",
          params: { varName: this.credentials.email, apiKey: this.apiKey },
        });
        if (this.debug_sensitive) {
          this.log("login: " + login);
        }
        ws.send(login);
      });

      ws.on("message", (data) => {
        if (this.debug_sensitive) {
          this.log("message received: " + data);
        }

        const returnObj = JSON.parse(data.toString());
        if (!returnObj.result?.authorized) return;
        const sendMessage = JSON.stringify(
          {
            jsonrpc: "2.0",
            method: "gdoModuleCommand",
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
        if (this.debug_sensitive) {
          this.log("GARAGEDOOR sendWebsocketmessage: " + sendMessage);
        }
        ws.send(sendMessage);
        ws.ping();
      });

      ws.on("pong", () => {
        this.log("pong; terminate");
        ws.terminate();
        resolve(state);
      });
    });
    const doorState = await promise;
    return doorState;
  }

  async openDoor() {
    this.log("GARAGEDOOR openDoor");
    const result = await this.sendWebsocketCommand(
      { doorCommand: 1 },
      "OPENING"
    );
    this.log("result:" + result);
  }

  async closeDoor() {
    this.log("GARAGEDOOR closeDoor");
    await this.sendWebsocketCommand({ doorCommand: 0 }, "CLOSING");
  }
}

export function findDeviceIdByName(obj: any, name: string) {
  if (Array.isArray(obj.result)) {
    const device = obj.result.find((x: any) => x.metaData.name === name);
    if (device) {
      return device.varName;
    }
  }
  console.error("device not found");
  return null;
}
