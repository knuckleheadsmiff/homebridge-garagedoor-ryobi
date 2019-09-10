# homebridge-garagedoor-ryobi

[Homebridge](https://github.com/nfarina/homebridge) plugin that supports opening and **closing a single** Ryobi garagedoor opener.

## Installation

1. Install homebridge using: `npm install -g homebridge`
2. Install this plugin using: `npm install -g homebridge-garagedoor-ryobi`
3. Update your configuration file. See the sample below.

## Configuration

Configuration sample:

```json
"accessories": [
  {
    "accessory": "RyobiGarageCommand",
    "name"     : "Garage Door",
    "email"    : "RYOBI_EMAIL",
    "password" : "RYOBI_PASSWORD"
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
**poll_short_delay**         | (**Default is 15 seconds** ) Polling status (in seconds) while garage door is opening and closing. Min value 15;  
**poll_long_delay**          | (**Default is 90 seconds** ) Time between polling for the garage door's state.  Outside of opening and closing. Min value >= poll_short_delay;
**garagedoor_id**        |  (**recommend NOT setting**) defaults correctly, **see below**
**debug_sensitive**    |  (**recommend NOT setting**) defaults to  false **see below**.

## poll_short_delay and poll_long_delay
After setting sending an open/close door command to the Ryobi GDO, it unfortunatly returns the original state for the next 0-15 seconds. When I inspect the door state I actually can't tell if: the door is left in the original state because of a problem,  if the command has not been sent yet, or if the door delays in responding (and in fact it may already be opening state.)  I've seen all these cases when debugging. The code will work OK but it may fall back to long polling mode to update the state correctly. This is why I set a min 15 seconds on the short delay--if it is shorted you statrt to see the issues. The code that I forked from just slammed the state to the final state presumably to get around this--I thought that was wrong, I'd rather leave the state as opening/closing until I really know the final state. I don't want to false report a door as closed when it is not.

If the door state accorind to ryobi is every opening or closing I will use the short polling time until the door is out of that state.

## garagedoor_id

**If you leave **garagedoor_id** out the config file the right thing should happen.**

If you can have multiple garage doors associated with an account (is this possible?) then pass in the id using the instructions below. I added this to the config file while I was developing and thought it might be useful. However if some of my API security concerns are resolved (see below) then this will become required.

In a browser (I recommend using FireFox because it automatically formats the json result) execute:

`https://tti.tiwiconnect.com/api/devices?username=RYOBI_ACCOUNT_EMAIL&password=RYOBI_PASSORD`

You will get an array of results, if you have only 1 device (like me) the devide id will be **`result[0].varName`** except if result[0].deviceTypeIds[1] == `gda500hub` then use **`result[1].varName`** .

## debug_sensitive

To debug server requests/responses I need to log lots of sensitive data--not my fault, the server responses include sensitve data scattered. The responses contain from the server Account Names, API keys, and DeviceIDs. You don't want this scatered in homebridge log files on your machine or mailed to other folks that need your homebridge log files for other reasons. Currently I can't prevent this because the API I have to get the the door state requires your login and passord--not an api key. This is very unfortunate. A  `debug_sensitive parameter`  config parament is available and should normally always be false--the default. You have been warned. Had this not been the case I would have used and `apiKey` and the `deviceid` rather than your password in the config file.

The sensivite data is ONLY logged when this config setting is true **and** when debugging homebridge itself: ` DEBUG=* homebridge -D -P`

## homebridge log entries:

In the normal course of running you will see the log stuff like this (without the  `^^^^^`  comments.). 

        [9/8/2019, 12:33:45 PM] Homebridge is running on port 51826.
        
        [9/8/2019, 12:33:59 PM] [Garage Door] State of Garage Door is: OPEN
                   ^^^^^  initial state set from polling
                   
        [9/8/2019, 12:34:12 PM] [Garage Door] Set Garage Door to 1 
                   ^^^^^  Using the iOS home app I closed the door
                   
        [9/8/2019, 12:34:27 PM] [Garage Door] State of Garage Door is: CLOSING
                   ^^^^^  using the **poll_short_delay** detected door is closing
                   
        [9/8/2019, 12:34:43 PM] [Garage Door] State of Garage Door is: CLOSED 
                   ^^^^^  using the **poll_short_delay** detected door is closed
                   
        [9/8/2019, 12:40:49 PM] [Garage Door] State of Garage Door is: OPEN 
                   ^^^^^  I manually press the garage door opener in my car NOT the
                   ^^^^^  home app. Using the **poll_short_delay** detected 
                   ^^^^^  door is OPEN

## Security concerns and help wanted

I have a file 'notes.txt' that shows the APIs. If your interested in solving these concerns of mine please help. I believe that the current APIs were reversed engineered by yannipang, you can see his website below.

### Would like to get the device status with an APIKEY and DEVICE ID.
I want to get rid of using passwords and would rather have an APIKEY and DEVICE ID in the config file (and of course include instructions to the user to obtain them.) The issue is that to get the door status I need the password. Since I need that password for that case the code just grabs the key and device id.

The  APIKEY key is currently used ONLY when sending an actual command, not getting the door status.

### The name and password is in the request parameters when getting the status and device ID, they are in post data (a little better) when getting the api key.

I don't like this data in the URL's becuase I don't trust that the not just logged in clear text on the ryobi servers. I've tried to change things to post request with data but then I get errors. 
    

## Kudos

I am standing on the shoulders of others.

This work is based on work by:

	https://yannipang.com/blog/ryobi-garage-door-api/
	https://github.com/Madj42/RyobiGDO
	https://community.smartthings.com/t/ryobi-modular-smart-garage-door-opener/
	
The initial project skeleton (although signigicantly changed) was forked from the [homebridge-garagedoor-command](https://github.com/apexad/homebridge-garagedoor-command) plugin.

## FAQ

### Can I have multiple garage doors?
You add additional accessories, with accounts and passwords, in the homebrige configjson file. 
If however you can have multiple openeris associated with one login then for now you arfe out of luck.

### Why use a password and not an apiKey of sorts?
A password is unfortunately required to get the open/close state of the garage door and to fetch the doorid. I don't like it but that's the way it is. Sorry.

### Can I do other things with my garage door?
It would be fairly easy to add support for the light (it would be a second homekit switch that would show up in the home app) but I have no need or interest in doing this. Probally could also control some of the other door atachments although that would take much more investigation in figuring out the API. Again, I have no interest in that either.

