import { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';
import { Device, YeelightNgPlatform } from './platform';
import { CommandType, State } from './types';
import { BehaviorSubject } from 'rxjs';

const defaultState = {
  on: false,
  color: [2, 7, 8, 0],
  brightness: 0,
  ct: 0,
  mode: 0,
};

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class YeelightNgPlatformAccessory {
  private service: Service;
  private state$ = new BehaviorSubject<State>(defaultState);
  constructor(private readonly platform: YeelightNgPlatform, private readonly accessory: PlatformAccessory<Device>) {
    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Default-Manufacturer')
      .setCharacteristic(this.platform.Characteristic.Model, 'Default-Model')
      .setCharacteristic(this.platform.Characteristic.SerialNumber, 'Default-Serial');
    // get the LightBulb service if it exists, otherwise create a new LightBulb service
    // you can create multiple services for each accessory
    this.service = this.accessory.getService(this.platform.Service.Lightbulb) || this.accessory.addService(this.platform.Service.Lightbulb);
    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.name);
    // each service must implement at-minimum the "required characteristics" for the given service type
    // see https://developers.homebridge.io/#/service/Lightbulb
    // register handlers for the On/Off Characteristic
    this.service.getCharacteristic(this.platform.Characteristic.On)
      .onSet(this.setOn.bind(this))                // SET - bind to the `setOn` method below
      .onGet(this.getOn.bind(this));               // GET - bind to the `getOn` method below
    // register handlers for the Brightness Characteristic
    this.service.getCharacteristic(this.platform.Characteristic.Brightness)
      .onSet(this.setBrightness.bind(this))       // SET - bind to the 'setBrightness` method below
      .onGet(this.getBrightness.bind(this));      // GET - bind to the 'getBrightness` method below

    this.platform.registerStateHandler(this.uuid, (state: State) => {
      try {
        this.state = state;
        this.service.updateCharacteristic(this.platform.Characteristic.On, this.state.on);
        this.service.updateCharacteristic(this.platform.Characteristic.Brightness, this.state.brightness);
      } catch (error) {
        this.platform.log.error(`Error updating characteristics: ${error}`);
      }
    });
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, turning on a Light bulb.
   */
  async setOn(value: CharacteristicValue) {
    this.platform.sendCommand(this.uuid, CommandType.SetOn, value as boolean);
    this.platform.log.debug('Set Characteristic On ->', value);
  }

  /**
   * Handle the "GET" requests from HomeKit
   * These are sent when HomeKit wants to know the current state of the accessory, for example, checking if a Light bulb is on.
   *
   * GET requests should return as fast as possbile. A long delay here will result in
   * HomeKit being unresponsive and a bad user experience in general.
   *
   * If your device takes time to respond you should update the status of your device
   * asynchronously instead using the `updateCharacteristic` method instead.

   * @example
   * this.service.updateCharacteristic(this.platform.Characteristic.On, true)
   */
  async getOn(): Promise<CharacteristicValue> {
    this.platform.sendCommand(this.uuid, CommandType.GetState);
    return this.state.on;
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, changing the Brightness
   */
  async setBrightness(value: CharacteristicValue) {
    this.platform.sendCommand(this.uuid, CommandType.SetBrightness, value as number);
    this.platform.log.debug('Set Characteristic Brightness -> ', value);
  }

  async getBrightness(): Promise<CharacteristicValue> {
    this.platform.sendCommand(this.uuid, CommandType.GetState);
    return this.state.brightness;
  }

  private get uuid() {
    return this.accessory.context.mac;
  }

  private get state() {
    const state = this.state$.getValue();
    this.platform.log.debug('GetState', state);
    return state;
  }

  private set state({ on, brightness, color, ct, mode }: State) {
    const state: State = {
      on: Boolean(on),
      brightness: brightness >= 0 && brightness <= 100 ? brightness : defaultState.brightness,
      color: Array.isArray(color) ? color : defaultState.color,
      mode: mode || defaultState.mode,
      ct: ct || defaultState.ct,
    };
    this.state$.next(state);
    this.platform.log.debug('SetState', state);
  }

}
