export interface AT {
  value?: unknown;
  _id?: string;
  metaData?: MetaData;
  defv?: unknown;
  dataType?: string;
  varType?: string;
  varName?: string;
  enum?: string[];
  min?: unknown;
  max?: unknown;
}

export interface Module {
  metaData?: MetaData;
  ac?: unknown;
  at?: Record<string, AT>;
}

export interface DeviceStatusResponseMetaData {
  name?: string;
  icon?: string;
}

export interface DeviceStatusResult {
  _id?: string;
  varName?: string;
  metaData?: DeviceStatusResponseMetaData;
  enabled?: boolean;
  deleted?: boolean;
  createdDate: string;
  activated?: number;
  deviceTypeIds?: string[];
  deviceTypeMap?: Record<string, Module>;
  activatedDate?: string;
}

export interface DeviceStatusResponse {
  result?: DeviceStatusResult[];
}

export interface GetDeviceResponseSys {
  lastSeen?: number;
}

export interface GetDeviceResponseMetaData {
  name?: string;
  version?: number;
  icon?: string;
  description?: string;
  wskAuthAttempts?: WskAuthAttempt[];
  authCount?: number;
  sys?: GetDeviceResponseSys;
  socketId?: string;
}

export interface GetDeviceResult {
  _id?: string;
  varName?: string;
  metaData?: GetDeviceResponseMetaData;
  enabled?: boolean;
  deleted?: boolean;
  createdDate?: string;
  activated?: number;
  deviceTypeIds?: string[];
  activatedDate?: string;
}

export interface GetDeviceResponse {
  result?: GetDeviceResult[] | string;
}

export interface Sys {
  ip?: string;
  lastSeen?: number;
}

export interface WskAuthAttempt {
  varName?: string;
  apiKey?: string;
  ts?: string;
  success?: boolean;
}

export interface MetaData {
  companyName?: string;
  surName?: string;
  givenName?: string;
  sys?: Sys;
  autoLogout?: boolean;
  wskAuthAttempts?: WskAuthAttempt[];
  authCount?: number;
}

export interface AccountOptions {
  email?: string;
  alertPhone?: string;
  alertEmail?: string;
  receiveEmailUpdates?: boolean;
  receiveEmailAlerts?: boolean;
  receiveSmsAlerts?: boolean;
}

export interface RoleMap {
  roleSelectors?: unknown[];
  roleRegex?: string[];
  roleNames?: string[];
}

export interface Auth {
  apiKey?: string;
  regPin?: string;
  clientUserName?: string;
  createdDate?: string;
  childSelectors?: string[];
  roleMap?: RoleMap;
  roleIds?: string[];
  clientSchema?: string;
}

export interface LoginResult {
  _id?: string;
  varName?: string;
  metaData?: MetaData;
  accountOptions?: AccountOptions;
  enabled?: boolean;
  deleted?: boolean;
  createdDate?: string;
  activated?: number;
  notificationTransports?: unknown[];
  auth?: Auth;
}

export interface LoginResponse {
  result?: LoginResult | string;
}
