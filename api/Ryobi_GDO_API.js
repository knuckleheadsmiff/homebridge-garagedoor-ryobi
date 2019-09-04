/*jshint esversion: 6,node: true,-W041: false */
"use strict";
const 	request = require('request'),
		WebSocket = require('ws');

const apikeyURL =    'https://tti.tiwiconnect.com/api/login/'
const deviceURL =    'https://tti.tiwiconnect.com/api/devices/'
const websocketURL = 'wss://tti.tiwiconnect.com/api/wsrpc'

/* 
This is an API to control the Ryobi_GDO_API.This is built upon the work of others. Specifically:

	https://yannipang.com/blog/ryobi-garage-door-api/
	https://github.com/Madj42/RyobiGDO
	https://community.smartthings.com/t/ryobi-modular-smart-garage-door-opener/

	Commands (Not Implemented) to control lights:
		If in the futrue a light switch feature was added as well could easily add this support

		Turn On the Light:

			{"jsonrpc":"2.0","method":"gdoModuleCommand","params":{"msgType":16,"moduleType":5,"portId":7,"moduleMsg":{"lightState":true},"topic":"GARAGEDOOR_ID"}}

		Turn Off the Light:

			 {"jsonrpc":"2.0","method":"gdoModuleCommand","params":{"msgType":16,"moduleType":5,"portId":7,"moduleMsg":{"lightState":false},"topic":"GARAGEDOOR_ID"}}

*/



class Ryobi_GDO_API {
    constructor(email, password, deviceid, log, debug) {
        this.email = email;
        this.password = password;
        this.deviceid = deviceid;
        this.log = log;
        this.debug = debug;
    }

    getApiKey() {
    	if (this.apikey) return this.apikey;
    	
        request.post({url: encodeURI(queryUri), form: {username: this.ryobi_email, password: ryobi_password}, function (err, response, body) {
            if (!err) {
                const jsonObj = JSON.parse(body);
				debug( JSON.stringify(jsonObj, null, 2));
                
				try {
					this.apikey = jsonObj.result.auth.apiKey;
				} catch(error) {
					this.log.error("Error retrieving ryobi GDO apiKey");
					this.log.error("Error Message 1: " + error);
				}
            } else {
                this.log.error("Error retrieving ryobi GDO apiKey");
                this.log.error("Error Message 2: " + err);
            }
        }.bind(this)});
        
        return this.apikey;
    }
    
    getDeviceID() {
    	if (this.deviceid) return this.deviceid;
    	
		var queryUri = deviceURL + '/' + this.ryobi_device_id + "?username=" + this.ryobi_email + "&password=" + this.ryobi_password;
        request(encodeURI(queryUri), function (err, response, body) {
            if (!err) {
                const jsonObj = JSON.parse(body);
				debug( JSON.stringify(jsonObj, null, 2));
                
				try {
					var deviceModel = jsonObj.result[0].deviceTypeIds[0]
					if (deviceModel == 'gda500hub') {
							var doorid = jsonObj.result[1].varName
					}
					else {
							var doorid = jsonObj.result[0].varName
					}
					this.deviceid = doorid;
				} catch(error) {
					this.log.error("Error retrieving ryobi GDO getDeviceID");
					this.log.error("Error Message 1: " + error);
				}
            } else {
                this.log.error("Error retrieving ryobi GDO getDeviceID");
                this.log.error("Error Message 2: " + err);
            }
        }.bind(this)});
        
        return this.deviceid;
    }


    update(callback) {
        this.debug("Updating ryobi data:");
        let report = {};
        
		var queryUri = deviceURL + '/' + this.ryobi_device_id + "?username=" + this.ryobi_email + "&password=" + this.ryobi_password;
        request(encodeURI(queryUri), function (err, response, body) {
            if (!err) {
                const jsonObj = JSON.parse(body);
				debug( JSON.stringify(jsonObj, null, 2));
                
				try {
					state = this.parseReport(jsonObj, callback);
					callback(null, state);
				} catch(error) {
					this.log.error("Error retrieving ryobi GDO status");
					this.log.error("Error Message: " + error);
                	callback(err);
				}
            } else {
                this.log.error("Error retrieving ryobi GDO status");
                this.log.error("Error Message: " + err);
                callback(err);
            }
        }.bind(this));
    }
    

    parseReport(values) {
        let gdoState;
        
		var doorval = values.result[0].deviceTypeMap.garageDoor_7.at.doorState.value

		if (doorval === 0) {
			gdoState = "CLOSED";
		} else if (doorval === 1) {
			gdoState = "OPEN";
		} else if (doorval === 2) {
			gdoState = "CLOSING";
		} else {
			gdoState = "OPENING";
		}

		this.debug("GARAGEDOOR STATE:"+ gdoState)
        return gdoState;
    }
    
    getState(callback) {
    	update(callback);
    }
    
    openDoor(callback) {
		this.debug("GARAGEDOOR openDoor");
        try {
			const ws = new WebSocket(websocketURL);

			ws.on('open', function open() {
				// Web Socket is connected, send data using send()
				ws.send('{"jsonrpc":"2.0","id":3,"method":"srvWebSocketAuth","params": {"varName": "'+ this.email + '": "'+ this.getApiKey() +'"}}'); //CHANGE VARIABLES
			}.bind(this));

			ws.on('message', function incoming(data) {
				ws.send('{"jsonrpc":"2.0","method":"gdoModuleCommand","params":{"msgType":16,"moduleType":5,"portId":7,"moduleMsg":{"doorCommand":1},"topic":"'+ this.getDeviceID() +'"}}');
				ws.ping();
				debug('GARAGEDOOR: OPENING');
			}.bind(this));

			ws.on('pong', function pong() {
				ws.terminate();
			});    
		} catch(error) {
			this.log.error("Error retrieving ryobi GDO status");
			this.log.error("Error Message: " + err);
			callback(err);
		}
		callback(null, true);
	}
    
    closeDoor (callback) {
		this.debug("GARAGEDOOR closeDoor");
        try {
			const ws = new WebSocket('wss://tti.tiwiconnect.com/api/wsrpc');

			ws.on('open', function open() {
				// Web Socket is connected, send data using send()
				ws.send('{"jsonrpc":"2.0","id":3,"method":"srvWebSocketAuth","params": {"varName": "'+ this.email + '","apiKey": "'+ this.getApiKey() +'"}}');
			}.bind(this));

			ws.on('message', function incoming(data) {
				ws.send('{"jsonrpc":"2.0","method":"gdoModuleCommand","params":{"msgType":16,"moduleType":5,"portId":7,"moduleMsg":{"doorCommand":0},"topic":"'+ this.getDeviceID() +'"}}'); 
				ws.ping();
				debug('GARAGEDOOR: CLOSING');
			}.bind(this));

			ws.on('pong', function pong() {
				ws.terminate();
			});
		} catch(error) {
			this.log.error("Error retrieving ryobi GDO status");
			this.log.error("Error Message: " + err);
			callback(err);
		}
		callback(null, true);
	}

}


module.exports = {
    Ryobi_GDO_API: Ryobi_GDO_API
};
