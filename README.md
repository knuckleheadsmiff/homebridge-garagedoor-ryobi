# homebridge-garagedoor-ryobi

## NOT WORKING YET: DO NOT USE

It's limping along. Can open and close! But the state gets whacked and not reset. So need to work on that.

I also log lots of sensitive data--not my fault, the server responses but it in the results all over the place and to debug you need to see the server responses. I will add a conf setting so that if someone runs in debug mode that by default no sensitive info gets logged, but that can be overridden in the conf file if I need to look into an issue.


[Homebridge](https://github.com/nfarina/homebridge) plugin that supports opening and **closing a single** Ryobi garagedoor opener.

## Installation

1. Install homebridge using: `npm install -g homebridge`
2. Install this plugin using: `npm install -g homebridge-garagedoor-command`
3. Install this plugin using: `npm install -g ws` //websockets
4. Update your configuration file. See the sample below.

## Configuration\

Configuration sample:

```json
"accessories": [
  {
    "accessory": "GarageCommand",
    "name"     : "Garage Door",
    "email"    : "RYOBI_EMAIL",
    "password" : "RYOBI_PASSWORD"
  }
]

```
## Explanation:

Field                   | Description
------------------------|------------
**accessory**           | Must always be "RyobiGarageCommand". (**required**)
**name**                | Name of the Garage Door (**required**)
**email** 				| email associate with your garage doors ryobi account (**required**) 
**password**			| apiKey associate with your garage doors ryobi account (**required**)
**garagedoor_id**		| id your garage doors, this is the device that gets controlled (**recommend not setting**) see below
**status_update_delay** | Time to have door in opening or closing state (defaults to 15 seconds)
**poll_state_delay**    | Time between polling for the garage door's state (leave blank to disable state polling)

## Fetch garagedoor_id

**If you leave **garagedoor_id** out the config file the right thing should happen.**

If you can have multiple garage doors associated with an account (is this possible?) then maybe pass in the id using the instructions below. I mainly added it to the config file while I was developing and thought it might be useful. Sorry for any confustions if it is not. 

In a browser (I recommend using FireFox because it automatically formats the json result) execute:

`https://tti.tiwiconnect.com/api/devices?username=RYOBI_ACCOUNT_EMAIL&password=RYOBI_PASSORD`

You will get an array of results, if you have only 1 device (like me) the devide id will be **`result[0].varName`** except if result[0].deviceTypeIds[1] == `gda500hub` then use **`result[1].varName`** .

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
Well I can in code. :-P For example I can control the light. For now that code is not exposed in anyway.
