import { API } from 'homebridge';
import { StandaloneRyobiGDOAccessory } from './RyobiGDOAccessory';
import { RyobiGDOPlatform } from './RyobiGDOPlatform';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings';

export = (homebridge: API) => {
  homebridge.registerPlatform(PLATFORM_NAME, RyobiGDOPlatform);
  homebridge.registerAccessory(PLUGIN_NAME, StandaloneRyobiGDOAccessory);
};
