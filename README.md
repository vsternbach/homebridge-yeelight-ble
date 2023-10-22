<p align="center">

<img src="https://github.com/homebridge/branding/raw/master/logos/homebridge-wordmark-logo-vertical.png" width="150">

</p>

<span align="center">

# Homebridge Yeelight BLE

</span>

This is a Homebridge plugin that allows controlling Yeelight bluetooth lamps Candela and Bedside Lamp (although tested only with Candela).


### Setup

This plugin requires installation of a python library [yeelightble](https://github.com/vsternbach/yeelightble) that handles all the bluetooth communication with devices and listens for control commands/publishes lamp state through redis. It's supposed to run on RPI and not tested on other platforms.

### Roadmap

Possibly port this yeelightble python library code to nodejs using noble library and make it a part of homebridge plugin 