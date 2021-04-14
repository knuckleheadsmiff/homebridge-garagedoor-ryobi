# NOTICE: 
# I'm looking for someone who would like to take this over; I'm no-longer setup to continue maintaince and have only published code that was contributed by others for awhile. 

# The basecode is old and may not conform to good HomeBridge standards and more recent versions of hoimebridge sometimes complains about callbacks running too slow. I'm just not set up to look into this or fix/improve it.



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
**serial_number**       |  (**recommend NOT setting**) Setting if you have multiple doors; Defaults to 001; **see below**
**garagedoor_id**        |  (**recommend NOT setting**) Setting if you have multiple doors **see below**
**garagedoor_name**    |    (**recommend NOT setting**) Alternative Setting if you have multiple doors **see below**.
**debug_sensitive**    |  (**recommend NOT setting**) defaults to  false **see below**.

## poll_short_delay and poll_long_delay
After setting sending an open/close door command to the Ryobi GDO, it unfortunately returns the original state for the next 0-15 seconds. When I inspect the door state I actually can't tell if: the door is left in the original state because of a problem,  if the command has not been sent yet, or if the door delays in responding (and in fact it may already be opening state.)  I've seen all these cases when debugging. The code will work OK but it may fallback to long polling mode to update the state correctly. This is why I set a min 15 seconds on the short delay--if it is shorted you start to see the issues. The code that I forked from just slammed the state to the final state presumably to get around this--I thought that was wrong, I'd rather leave the state as opening/closing until I really know the final state. I don't want to false report a door as closed when it is not.

If the door state according to Ryobi is every opening or closing I will use the short polling time until the door is out of that state.

## serial_number

If you run multiple instances then in each instance you must define a unique serial_number otherwise "001" is used for all doors and homekit gets confused according to users.

## garagedoor_id or garagedoor_name

**If you leave **garagedoor_id** out the config file the right thing should happen.**

NEW: You can choose to use the name of the door and set **garagedoor_name** instead and ignore the info below. (Thanks Andy!)

If you can have multiple garage doors associated with an account (is this possible?) then pass in the id using the instructions below. I added this to the config file while I was developing and thought it might be useful. However if some of my API security concerns are resolved (see below) then this will become required.

In a browser (I recommend using FireFox because it automatically formats the json result) execute:

`https://tti.tiwiconnect.com/api/devices?username=RYOBI_ACCOUNT_EMAIL&password=RYOBI_PASSORD`

You will get an array of results, if you have only 1 device (like me) the deviceid will be **`result[0].varName`** except if result[0].deviceTypeIds[1] == `gda500hub` then use **`result[1].varName`** .

## debug_sensitive

To debug server requests/responses I need to log lots of sensitive data--not my fault, the server responses include sensitive data scattered. The responses contain from the server Account Names, API keys, and DeviceIDs. You don't want this scattered in homebridge log files on your machine or mailed to other folks that need your homebridge log files for other reasons. Currently I can't prevent this because the API I have to get the the door state requires your login and password--not an api key. This is very unfortunate. A  `debug_sensitive parameter`  config parameter is available and should normally always be false--the default. You have been warned. Had this not been the case I would have used and `apiKey` and the `deviceid` rather than your password in the config file.

The sensitive data is ONLY logged when this config setting is true **and** when debugging homebridge itself: ` DEBUG=* homebridge -D -P`

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

## Kudos

I am standing on the shoulders of others.

This work is based on work by:

* [https://yannipang.com/blog/ryobi-garage-door-api](https://yannipang.com/blog/ryobi-garage-door-api)
* [https://github.com/Madj42/RyobiGDO](https://github.com/Madj42/RyobiGDO)
* [https://community.smartthings.com/t/ryobi-modular-smart-garage-door-opener](https://community.smartthings.com/t/ryobi-modular-smart-garage-door-opener)

Additions & refinements by
* [https://github.com/andyedinborough](https://github.com/andyedinborough)

The initial project skeleton (although significantly changed) was cloned from the [homebridge-garagedoor-command](https://github.com/apexad/homebridge-garagedoor-command) plugin.

## FAQ

### Can I have multiple garage doors?
You add additional accessories, with accounts and passwords, in the Homebridge config.json file.
However you can't have multiple openers associated with one login, you are out of luck.

### Why use a password and not an apiKey of sorts?
A password is unfortunately required to get the open/close state of the garage door and to fetch the doorid. I don't like it but that's the way it is. Sorry.

### Can I do other things with my garage door?
It would be fairly easy to add support for the light--it would be a second homekit switch that would show up in the home app. I have no need or interest in doing this but if someone wants to I'll take the help. Probably could also control some of the other door attachments although that would take much more investigation in figuring out the API. Again, I have no interest in that either.
