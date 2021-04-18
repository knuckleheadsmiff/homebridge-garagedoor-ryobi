import { API } from 'homebridge';
import { RyobiGDOPlatform } from './RyobiGDOPlatform';
import { PLATFORM_NAME } from './settings';

export = (homebridge: API) => {
  homebridge.registerPlatform(PLATFORM_NAME, RyobiGDOPlatform);
};
