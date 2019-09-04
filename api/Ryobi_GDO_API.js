/*jshint esversion: 6,node: true,-W041: false */
"use strict";
const 	request = require('request'),
		WebSocket = require('ws');

const deviceURL = 'https://tti.tiwiconnect.com/api/devices/'
const websocketURL = 'wss://tti.tiwiconnect.com/api/wsrpc'

class Ryobi_GDO_API {
    constructor(email, password, deviceid, log) {
        this.email = email;
        this.password = password;
        this.deviceid = deviceid;
        this.log = log;
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
					report = this.parseReport(jsonObj, callback);
					callback(null, weather);
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

		this.log("GARAGEDOOR STATE:"+ gdoState)
        return {"gdoState": gdoState};
    }
    
    getState(callback) {
    	update(callback);
    }
    
    openDoor(callback) {
        try {
			const ws = new WebSocket(websocketURL);

			ws.on('open', function open() {
				// Web Socket is connected, send data using send()
				ws.send('{"jsonrpc":"2.0","id":3,"method":"srvWebSocketAuth","params": {"varName": "'+ this.email + '": "'+ apiKey +'"}}'); //CHANGE VARIABLES
			}.bind(this));

			ws.on('message', function incoming(data) {
				ws.send('{"jsonrpc":"2.0","method":"gdoModuleCommand","params":{"msgType":16,"moduleType":5,"portId":7,"moduleMsg":{"doorCommand":1},"topic":"'+ this.deviceid +'"}}');
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
        try {
			const ws = new WebSocket('wss://tti.tiwiconnect.com/api/wsrpc');

			ws.on('open', function open() {
				// Web Socket is connected, send data using send()
				ws.send('{"jsonrpc":"2.0","id":3,"method":"srvWebSocketAuth","params": {"varName": "'+ this.email + '","apiKey": "'+ apiKey +'"}}');
			}.bind(this));

			ws.on('message', function incoming(data) {
				ws.send('{"jsonrpc":"2.0","method":"gdoModuleCommand","params":{"msgType":16,"moduleType":5,"portId":7,"moduleMsg":{"doorCommand":0},"topic":"'+ this.deviceid +'"}}'); 
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
