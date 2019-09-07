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
  
  this.debug_sensitive = config.debug_sensitive;
  
  this.statusUpdateDelay = config.status_update_delay || 15;
  this.statusUpdateDelay = this.statusUpdateDelay * 1000;
  this.pollStateDelay = config.poll_state_delay || 45;
  this.pollStateDelay = this.pollStateDelay * 1000;
  
  this.garagedoor = new ryobi_GDO_API(this.ryobi_email, this.ryobi_password, this.ryobi_device_id, this.log, this.debug, this.debug_sensitive);
}

GarageCmdAccessory.prototype.setState = function(targetState, callback, context) {
  if (targetState === undefined) {
	accessory.log('Error: target state is undefined');
    callback(null);
    return;
  }
  if (context === 'pollState') {
    // The state has been updated by the pollState command - don't run the open/close command
    callback(null);
    return;
  }
  

  var accessory = this;
  var command = (targetState == Characteristic.CurrentDoorState.CLOSED) ? accessory.garagedoor.closeDoor.bind(accessory.garagedoor) : accessory.garagedoor.openDoor.bind(accessory.garagedoor);
  
  accessory.log('Set door target state: ' + targetState);
  
  var doIt = function (err) {
		  if (err) {
			accessory.log('Error: ' + err);
			callback(err || new Error('Error setting state to ' +  targetState));
		  } else {
			accessory.log('Set ' + accessory.name + ' to ' + targetState);
			if (targetState == Characteristic.CurrentDoorState.CLOSED) {
				accessory.garageDoorService.setCharacteristic(Characteristic.CurrentDoorState, Characteristic.CurrentDoorState.OPENING);
				accessory.pollState(true);
			} else {
			    accessory.garageDoorService.setCharacteristic(Characteristic.CurrentDoorState, Characteristic.CurrentDoorState.CLOSING);
				accessory.pollState(true);
			}
		   callback(null); // return null if no error.
		 }
	  }.bind(this);

  command (doIt);
};

GarageCmdAccessory.prototype.getState = function(callback) {
  var accessory = this;
  
  var doIt = function (err, state) {
		if (err) {
		  accessory.log('Error: ' + err);
		  callback(err || new Error('Error getting state of ' + accessory.name));
		} else {
		  accessory.log('State of ' + accessory.name + ' is: ' + state);
		  this.debug('State of Characteristic.CurrentDoorState[state] is: ' + Characteristic.CurrentDoorState[state]);
		  callback(null, Characteristic.CurrentDoorState[state]);
		}

		if (accessory.pollStateDelay > 0) {
		  accessory.pollState();
		}
  	}.bind(this);

  accessory.garagedoor.update (doIt);
};

GarageCmdAccessory.prototype.pollState = function(isOpeningOrClosing) {
  var accessory = this;

  // Clear any existing timer
  if (accessory.stateTimer) {
    clearTimeout(accessory.stateTimer);
    accessory.stateTimer = null;
  }
    
  var doIt = function() {
	   accessory.getState(function(err, currentDeviceState) {
	   
		   if (err) {
			 accessory.log(err);
			 accessory.stateTimer = setTimeout(doIt, this.poll_state_delay); 
			 return;
		   }
		   this.debug("GarageCmdAccessory.prototype.pollState: " + currentDeviceState);

		   if (currentDeviceState === Characteristic.CurrentDoorState.OPEN || currentDeviceState === Characteristic.CurrentDoorState.CLOSED) {
				accessory.garageDoorService.setCharacteristic(Characteristic.CurrentDoorState, currentDeviceState);
				accessory.stateTimer = setTimeout(doIt, this.poll_state_delay); 
		   } else {
				accessory.stateTimer = setTimeout(doIt, this.status_update_delay);
		   }
		   
		 }.bind(this))
	   }.bind(this);
    
  accessory.stateTimer = setTimeout(doIt, (isOpeningOrClosing) ? this.status_update_delay : this.pollStateDelay); 
  
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
