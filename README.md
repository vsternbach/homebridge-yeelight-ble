# Homebridge Yeelight BLE

This is a Homebridge plugin to control Yeelight bluetooth lamps Candela and Bedside Lamp (although tested only with Candela).

## Setup

This plugin requires installation of a python library [yeelightble](https://github.com/vsternbach/yeelightble) that handles all the bluetooth communication with devices and listens for control commands and publishes lamp state through WebSocket.

It's supposed to run on RPI and was not tested on other platforms.

## Native Solution

I've also tried implementing this library [natively](https://github.com/vsternbach/homebridge-yeelight-ble/tree/native) in javascript using [node-ble](https://github.com/chrvadala/node-ble) library, but from my testing, it's just not stable enough, seems that node-ble or dbus-next it relies on are buggy and leaking on event listeners, if someone's willing to debug and make it stable PRs are welcome!
