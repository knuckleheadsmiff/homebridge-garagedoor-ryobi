# homebridge-garagedoor-ryobi

[Homebridge](https://github.com/nfarina/homebridge) plugin that supports opening and **closing a single** Ryobi garagedoor opener.

This work is based on work from https://yannipang.com/blog/ryobi-garage-door-api/ and project is forked from the [homebridge-garagedoor-command](https://github.com/apexad/homebridge-garagedoor-command) plugin

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
    "name": "Garage Door",
    "email" :  "EMAIL",
    "password" : "PASSWORD",
    "garagedoor_id" : "GARAGEDOOR_ID",
    "status_update_delay": 15,
    "poll_state_delay": 20
  }
]

```
## Explanation:

Field                   | Description
------------------------|------------
**accessory**           | Must always be "GarageCommand". (required)
**name**                | Name of the Garage Door
**email** 				| email associate with your garage doors ryobi account (required) 
**password**			| apiKey associate with your garage doors ryobi account (required)
**garagedoor_id**		| deviceID your garage doors -- see below (required)
**status_update_delay** | Time to have door in opening or closing state (defaults to 15 seconds)
**poll_state_delay**    | Time between polling for the garage door's state (leave blank to disable state polling)

## Fetch garagedoor_id

In a Browser (easiest using FireFox because it formats the result) execute:

`https://tti.tiwiconnect.com/api/devices?username=RYOBI_ACCOUNT_EMAIL&password=RYOBI_PASSORD`

You will get an array of results, if you have only 1 device (like me) look at `result[0]._id` That value is near the beginning out the result.
Also the device type should be `gdoMasterUnit`. If you have only 1 device (like me) look at `result[0].deviceTypeIds[0]`

You should be able to pick a different ID if you have multiple openers in your account.

## FAQ

### Can I have multiple garage doors?
I currently have no plan to update with multiple garage doors which is why I allow you to specify the one you want to use with the device ID. Fell free to folk this branch to add support for multiple GDOs.### Can I have multiple garage doors?

### Why use a password and not an apiKey?
A password is unfortunately required to get the open/close state of the garage door. Otherwise I could have provided instructions to fetch an API key to use--which the code internally does to execute open and close commands. If someone knows a a command using an API key to get the state please let me know and I'll update the code.
