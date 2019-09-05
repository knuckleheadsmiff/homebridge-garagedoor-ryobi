/*jshint esversion: 6,node: true,-W041: false */
"use strict";
const 	request = require('request'),
		WebSocket = require('ws');

const apikeyURL =    'https://tti.tiwiconnect.com/api/login'
const deviceURL =    'https://tti.tiwiconnect.com/api/devices'
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

    getApiKey(callback) {
    	if (this.apikey) return this.apikey;
		this.debug("getApiKey");
    	
		var doIt = function (err, response, body) {
 		   this.debug("getApiKey responded");
           if (!err) {
                const jsonObj = JSON.parse(body);
				//debug( JSON.stringify(jsonObj, null, 2));
				this.debug("body: "+ body);
				
				try {
					this.apikey = jsonObj.result.auth.apiKey;
					this.debug("apiKey: "+ this.apikey);
					callback(null, this.apikey);
				} catch(error) {
					this.debug("Error retrieving ryobi GDO apiKey");
					this.debug("Error Message 1: " + error);
					callback(error);
				}
            } else {
                this.debug("Error retrieving ryobi GDO apiKey");
                this.debug("Error Message 2: " + err);
				callback(err);
            }
        }.bind(this);

        request.post({url: encodeURI(apikeyURL), form: {username: this.email, password: this.password}}, doIt);
        
        return this.apikey;
    }
    
    getDeviceID(callback) {
		if (this.deviceid) return callback(null, this.deviceid);
		this.debug("getDeviceID");
		
		var doIt = function (err, response, body) {
			this.debug("getDeviceID responded");
			if (!err) {
				const jsonObj = JSON.parse(body);
				//this.debug("getDeviceID response = " + body);
				this.debug("body: "+ body);
			
				try {
					var deviceModel = jsonObj.result[0].deviceTypeIds[0];
					this.deviceid = (deviceModel == 'gda500hub') ? jsonObj.result[1].varName : jsonObj.result[0].varName;
					this.debug("deviceModel: " + deviceModel);
					this.debug("doorid: " + this.deviceid);
					callback(null, this.deviceid);
				} catch(error) {
					this.debug("Error retrieving ryobi GDO getDeviceID");
					this.debug("Error Message 1: " + error);
					callback(error);
				}
			} else {
				this.debug("Error retrieving ryobi GDO getDeviceID");
				this.debug("Error Message 2: " + err);
				callback(err);
			}
		}.bind(this);
		
		var queryUri = deviceURL + "?username=" + this.email + "&password=" + this.password;
		request(encodeURI(queryUri), doIt);
        
    }


    update(callback) {
        this.debug("Updating ryobi data:");
        let report = {};
        
        this.getDeviceID(function (deviceIDError, deviceID) {
        	if (deviceIDError) {
        		callback(deviceIDError);
        		return;
        	}
        	
			var queryUri = deviceURL + '/' + deviceID + "?username=" + this.email + "&password=" + this.password;
			request(encodeURI(queryUri), function (err, response, body) {
				this.debug("GetStatus responded: ");
				if (!err) {
					const jsonObj = JSON.parse(body);
					//this.debug( JSON.stringify(jsonObj, null, 2));
					this.debug("body: "+ body);
				
					try {
						var state = this.parseReport(jsonObj, callback);
						callback(null, state);
					} catch(error) {
						this.debug("Error retrieving ryobi GDO status");
						this.debug("Error Message 1: " + error);
						callback(error);
					}
				} else {
					this.debug("Error retrieving ryobi GDO status");
					this.debug("Error Message 2: " + err);
					callback(err);
				}
			}.bind(this));
        }.bind(this))
        
    }
    

    parseReport(values) {
        this.debug("parseReport ryobi data:");
        let homekit_doorstate;
        
		var doorval = values.result[0].deviceTypeMap.garageDoor_7.at.doorState.value

		if (doorval === 0) {
			homekit_doorstate = "CLOSED";
		} else if (doorval === 1) {
			homekit_doorstate = "OPEN";
		} else if (doorval === 2) {
			homekit_doorstate = "CLOSING";
		} else {
			homekit_doorstate = "OPENING";
		}
		
		this.debug("GARAGEDOOR STATE:"+ homekit_doorstate)
        return homekit_doorstate;
    }
    
    sendWebsocketCommand(message, callback, state) {
		this.debug("GARAGEDOOR sendWebsocketcommand");
		var doorState = state;
		
		var doIt = function(apiKey, doorid) {
			try {
				this.debug("GARAGEDOOR sendWebsocketcommand: doIt");
				var debug = this.debug;
				const ws = new WebSocket(websocketURL);

				ws.on('open', function open() {
					// Web Socket is connected, send data using send()
					var openConnection = '{"jsonrpc":"2.0","id":3,"method":"srvWebSocketAuth","params": {"varName": "'+ this.email + '", "apiKey": "'+ apiKey +'"}}';
 /* INSECURE TO WRITE TO LOG ==>*/ this.debug("GARAGEDOOR sendWebsocketcommand: " + openConnection);
					ws.send(openConnection); //CHANGE VARIABLES
				}.bind(this));

				ws.on('message', function incoming(data) {
					debug("open socket message: " + data)
					//Getting multiple messages!
					//    message: {"jsonrpc":"2.0","method":"authorizedWebSocket","params":{"authorized":true,"socketId":"b82879e8.ip-172-31-23-253.4008"}} +74ms
  					//	  message: {"jsonrpc":"2.0","result":{"authorized":true,"varName":"xxxxxxxxxxxx","aCnt":0},"id":3} +4ms
  					// Need to send AFTER authorization the 'result.'
  					var returnObj =  JSON.parse(data);
  					if (returnObj.result) {
  						if (returnObj.result.authorized) {
							var sendMessage = '{"jsonrpc":"2.0","method":"gdoModuleCommand","params":{"msgType":16,"moduleType":5,"portId":7,"moduleMsg": '+message+',"topic":"'+ doorid +'"}}';
/* INSECURE TO WRITE TO LOG ==>*/ this.debug("GARAGEDOOR sendWebsocketmessage: " + sendMessage);
							ws.send(sendMessage); 
							callback(null, doorState);
						}
						ws.ping();
  					} else {
  						//no-op waiting for a result to be sent back.
  					}
				}.bind(this));
				
				ws.on('pong', function pong() {
					ws.terminate();
				});

			} catch(error) {
				this.debug("Error retrieving ryobi GDO status");
				this.debug("Error Message: " + error);
				callback(error);
			}
		}.bind(this);
		
		//getting id and key are both asyncsynchronous which is why this odd double callback. The do get cached afer initcall and in that case the callback is synchronous
		this.getDeviceID(function (errorid, deviceid) {
			if (!errorid) {
				var doorid = deviceid;
				this.getApiKey(function (errorkey, apiKey) {
				if (!errorkey) {
					doIt(apiKey, doorid);
				} else {
					callback(errorkey);
				}
				}.bind(this)) ;
			} else {
				callback(errorid);
			}
		}.bind(this))
		
	}
    
    openDoor(callback) {
		this.debug("GARAGEDOOR openDoor");
		this.sendWebsocketCommand('{"doorCommand":1}' , callback, "OPENING");
	}
    
    closeDoor (callback) {
		this.debug("GARAGEDOOR closeDoor");
		this.sendWebsocketCommand('{"doorCommand":0}' , callback, "CLOSING");
	}

}


module.exports = {
    Ryobi_GDO_API: Ryobi_GDO_API
};
