import { API } from 'homebridge';
import { RyobiGDOAccessory } from './RyobiGDOAccessory';

export = (homebridge: API) => {
  homebridge.registerAccessory('homebridge-garagedoor-ryobi', 'RyobiGarageCommand', RyobiGDOAccessory);

  //homebridge.registerPlatform("")
};
