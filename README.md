# Homebridge Yeelight BLE

This is a Homebridge plugin that allows controlling Yeelight bluetooth lamps Candela and Bedside Lamp (although tested only with Candela).

## Setup

This plugin requires installation of a python library [yeelightble](https://github.com/vsternbach/yeelightble) that handles all the bluetooth communication with devices and listens for control commands/publishes lamp state through WebSocket.

It's supposed to run on RPI and was not tested on other platforms.
