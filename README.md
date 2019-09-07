# homebridge-garagedoor-ryobi

[Homebridge](https://github.com/nfarina/homebridge) plugin that supports opening and **closing a single** Ryobi garagedoor opener.

## IMPORTANT: Known issue

I would REFRAIN from using for now becase the status is not updating correctly for me always. I need to look into this more. Eventually it gets reset correctly using the `polling_state_delay`. This issue has something to do with telling the door to open/close but then not reporting back the opening/closing state but the initial state. 

## Arrrrrrgggghhhhhhhh!!! 

*My "home" app gets into a hosed situation where it says  " `no response`" although it initially shows the correct state--I can use the controls and everything looks like it is responding. Sometimes the HomeBridge accessory disappears too. Sometiomes I can't add a new HomeBridge accessory.....   I've had to delete my homebridge, rename it, give it a new ID, delete 'my home',  throw out the homebridge caches.... Oh, and now I find I have to restart my router to fix issues! Oh even better I had to turn toggle off/on the iCloud keychain on all my devices. This is a huge impact on my development. Driving me nuts.*

## Installation

1. Install homebridge using: `npm install -g homebridge`
2. Install this plugin using: `npm install -g homebridge-garagedoor-command`
3. Install this plugin using: `npm install -g ws` //websockets
4. Update your configuration file. See the sample below.

## Configuration

Configuration sample:

```json
"accessories": [
  {
    "accessory": "RyobiGarageCommand",
    "name"     : "Garage Door",
    "email"    : "RYOBI_EMAIL",
    "password" : "RYOBI_PASSWORD",
    "status_update_delay": 15,
    "poll_state_delay"   : 90
  }
]

```
## Explanation:

Field                   | Description
------------------------|------------
**accessory**                  | (**required**) Must be "RyobiGarageCommand" 
**name**                          | (**required**) Pick the defaukt garage door name for the home app
**email** 			   | (**required**) email associate with your garage doors ryobi account 
**password**	                  | (**required**) password associate with your garage doors ryobi account 
**status_update_delay** | (**Default is 15 seconds** ) Polling status (in seconds) while garage door is opening and closing.  
**poll_state_delay**        | (**Default is 15 seconds** ) Time between polling for the garage door's state.  Needed to uodate the home up if the door is controled by other people, remotes, physical buttons... 
**garagedoor_id**        |  (**recommend NOT setting**) defaults correctly, **see below**
**debug_sensitive**    |  (**recommend NOT setting**) defaults to  false **see below**.

## debug_sensitive

To debug server requests/responses I need to log lots of sensitive data--not my fault, the server responses include sensitve data scattered. The responses contain from the server Account Names, API keys, and DeviceIDs. You don't want this scatered in homebridge log files on your machine or mailed to other folks that need your homebridge log files for other reasons. Currently I can't prevent this because the API I have to get the the door state requires your login and passord--not an api key. This is very unfortunate. A  `debug_sensitive parameter`  config parament is available and should normally always be false--the default. You have been warned. Had this not been the case I would have used and `apiKey` and the `deviceid` rather than your password in the config file.

The sensivite data is ONLY logged when this config setting is true **and** when debugging homebridge itself: ` DEBUG=* homebridge -D -P`

## garagedoor_id

**If you leave **garagedoor_id** out the config file the right thing should happen.**

If you can have multiple garage doors associated with an account (is this possible?) then maybe pass in the id using the instructions below. I mainly added it to the config file while I was developing and thought it might be useful. Sorry for any confustions if it is not. 

In a browser (I recommend using FireFox because it automatically formats the json result) execute:

`https://tti.tiwiconnect.com/api/devices?username=RYOBI_ACCOUNT_EMAIL&password=RYOBI_PASSORD`

You will get an array of results, if you have only 1 device (like me) the devide id will be **`result[0].varName`** except if result[0].deviceTypeIds[1] == `gda500hub` then use **`result[1].varName`** .

## Wanted

If you know how to get the current ryobi garage door state with just an API KEY  then I will change the code to use a KEY, DOORID and DEVICE TYPE which you will need to provide (I'll give instructions.) I'd prefer then enhanced security this would have and so would you!

## Kudos

I am standing on the shoulders of others.

This work is based on work by:

	https://yannipang.com/blog/ryobi-garage-door-api/
	https://github.com/Madj42/RyobiGDO
	https://community.smartthings.com/t/ryobi-modular-smart-garage-door-opener/
	
The project skeleton (although signigicantly changed) was forked from the [homebridge-garagedoor-command](https://github.com/apexad/homebridge-garagedoor-command) plugin.

## FAQ

### Can I have multiple garage doors?
You add additional accessories, with accounts and passwords, in the homebrige configjson file. 
If however you can have multiple openeris associated with one login then for now you arfe out of luck.

### Why use a password and not an apiKey of sorts?
A password is unfortunately required to get the open/close state of the garage door and to fetch the doorid. I don't like it but that's the way it is. Sorry.

### can I do other things with my garage door?
Well I can in code. 😜 For example I can control the light--that code is not exposed in anyway. It would have to be a seperate accessory. Too much work for a hobby.

