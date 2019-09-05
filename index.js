var Service;
var Characteristic;
var exec = require('child_process').exec;

const ryobi_GDO_API = require('./api/Ryobi_GDO_API').Ryobi_GDO_API;
const debug = require('debug')('homebridge-garagedoor-ryobi');

module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  homebridge.registerAccessory('homebridge-garagedoor-ryobi', 'RyobiGarageCommand', GarageCmdAccessory);
};

/* 
NOTES:

This code was initially forked from the git project  "apexad/homebridge-garagedoor-command".

It has been significantly changed to do away with  adding files to support different garage door types. 
I found the code hard to follow with no examples to actually hook up an opener, The basic logic here however is 
very much lifted from that project and I am in gratitude.

If someone was inclinced it would be straight forward I believe to add support for other door types adn/or add support for
Multiple Ryobi GDOs. However that is an exercise for the future or someone else. For example I think you might need multiple 
accounts and instances ryobi_GDO_API (which should be very stright forward.) And you'd have to hook up multiple accessories.

Thinking about it more you might just be able to define additional accessories in the homebridge.json file and it might all work!

*/

function GarageCmdAccessory(log, config) {
  debug("Init homebridge-garagedoor-ryobi platform");
  
  this.log = log;
  this.debug = debug;
  this.name = config.name;
  
  this.ryobi_email = config.email;
  this.ryobi_password = config.password;
  this.ryobi_device_id = config.garagedoor_id;
  
  this.statusUpdateDelay = config.status_update_delay || 15;
  this.pollStateDelay = config.poll_state_delay || 0;
  
  this.garagedoor = new ryobi_GDO_API(this.ryobi_email, this.ryobi_password, this.ryobi_device_id, this.log, this.debug);
}

GarageCmdAccessory.prototype.setState = function(targetState, callback, context) {
  if (context === 'pollState') {
    // The state has been updated by the pollState command - don't run the open/close command
    callback(null);
    return;
  }

  var accessory = this;
  var command = (targetState == Characteristic.CurrentDoorState.CLOSED) ? accessory.garagedoor.closeDoor.bind(accessory.garagedoor) : accessory.garagedoor.openDoor.bind(accessory.garagedoor);
  
  accessory.log('Target state: ' + targetState);

  command (
    function (err, result) {
      if (err) {
        accessory.log('Error: ' + err);
        callback(err || new Error('Error setting state to ' + state));
      } else {
        accessory.log('Set ' + accessory.name + ' to ' + state);
        if (isClosed) {
          accessory.garageDoorService.setCharacteristic(Characteristic.CurrentDoorState, Characteristic.CurrentDoorState.OPENING);
          setTimeout(
            function() {
              accessory.garageDoorService.setCharacteristic(Characteristic.CurrentDoorState, Characteristic.CurrentDoorState.OPEN);
            },
            accessory.statusUpdateDelay * 1000
          );
        } else {
          accessory.garageDoorService.setCharacteristic(Characteristic.CurrentDoorState, Characteristic.CurrentDoorState.CLOSING);
          setTimeout(
            function() {
              accessory.garageDoorService.setCharacteristic(Characteristic.CurrentDoorState, Characteristic.CurrentDoorState.CLOSED);
            },
            accessory.statusUpdateDelay * 1000
          );
        }
       callback(null); // return null if no error.
     }
  });
};

GarageCmdAccessory.prototype.getState = function(callback) {
  var accessory = this;

  accessory.garagedoor.update (
  	function (err, state) {
		if (err) {
		  accessory.log('Error: ' + err);
		  callback(err || new Error('Error getting state of ' + accessory.name));
		} else {
		  accessory.log('State of ' + accessory.name + ' is: ' + state);
		  callback(null, Characteristic.CurrentDoorState[state]);
		}

		if (accessory.pollStateDelay > 0) {
		  accessory.pollState();
		}
  	});
};

GarageCmdAccessory.prototype.pollState = function() {
  var accessory = this;

  // Clear any existing timer
  if (accessory.stateTimer) {
    clearTimeout(accessory.stateTimer);
    accessory.stateTimer = null;
  }

  accessory.stateTimer = setTimeout(
    function() {
      accessory.getState(function(err, currentDeviceState) {
        if (err) {
          accessory.log(err);
          return;
        }

        if (currentDeviceState === Characteristic.CurrentDoorState.OPEN || currentDeviceState === Characteristic.CurrentDoorState.CLOSED) {
          // Set the target state to match the actual state
          // If this isn't done the Home app will show the door in the wrong transitioning state (opening/closing)
          accessory.garageDoorService.getCharacteristic(Characteristic.TargetDoorState)
            .setValue(currentDeviceState, null, 'pollState');
        }
        accessory.garageDoorService.setCharacteristic(Characteristic.CurrentDoorState, currentDeviceState);
      })
    },
    accessory.pollStateDelay * 1000
  );
}

GarageCmdAccessory.prototype.getServices = function() {
  this.informationService = new Service.AccessoryInformation();
  this.garageDoorService = new Service.GarageDoorOpener(this.name);

  this.informationService
  .setCharacteristic(Characteristic.Manufacturer, 'Ryobi Garage-door Opener')
  .setCharacteristic(Characteristic.Model, 'Homebridge Plugin')
  .setCharacteristic(Characteristic.SerialNumber, '001');

  this.garageDoorService.getCharacteristic(Characteristic.TargetDoorState)
  .on('set', this.setState.bind(this));

  this.garageDoorService.getCharacteristic(Characteristic.CurrentDoorState)
  .on('get', this.getState.bind(this));
  
  this.garageDoorService.getCharacteristic(Characteristic.TargetDoorState)
  .on('get', this.getState.bind(this));

  return [this.informationService, this.garageDoorService];
};
