import { CharacteristicValue, PlatformAccessory, Service } from 'homebridge';
import { Device, YeelightNgPlatform } from './platform';
import { CommandHandle, State } from './types';
import { BehaviorSubject } from 'rxjs';
import NodeBle, { GattCharacteristic } from 'node-ble';

const SERVICE_UUID = '0000fe87-0000-1000-8000-00805f9b34fb';
const CONTROL_CHAR_UUID = 'aa7d3f34-2d4f-41e0-807f-52fbf8cf7443';
const NOTIFY_CHAR_UUID = '8f65073d-9f57-4aaa-afea-397d19d5bbeb';
const CONTROL_HANDLE = 0x43;
const STATE_HANDLE = 0x45;
const MAX_RETRIES = 5;

const defaultState = {
  on: false,
  color: [2, 7, 8, 0],
  brightness: 0,
  ct: 0,
  mode: 0,
};

function delay(ms = 100) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class YeelightNgPlatformAccessory {
  private service: Service;
  private state$ = new BehaviorSubject<State>(defaultState);
  private device!: NodeBle.Device;
  private controlChar!: GattCharacteristic;
  private notifyChar!: GattCharacteristic;

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

    this.platform.api.on('shutdown', async () => {
      platform.log.debug('shutdown');
      await this.notifyChar.stopNotifications();
      this.device.removeAllListeners();
      await this.device.disconnect();
    });
    this.init();
  }

  private async init() {
    this.device = await this.platform.bleAdapter.getDevice(this.uuid.toUpperCase());
    await this.device.connect();
    const gattServer = await this.device.gatt();
    const service = await gattServer.getPrimaryService(SERVICE_UUID);
    this.controlChar = await service.getCharacteristic(CONTROL_CHAR_UUID);
    this.notifyChar = await service.getCharacteristic(NOTIFY_CHAR_UUID);
    await this.notifyChar.startNotifications();
    this.notifyChar.on('valuechanged', async buffer => {
      this.platform.log.debug(`notifyChar hex: ${buffer.toString('hex')}`);
      this.platform.log.debug(`notifyChar arr: ${new Uint8Array(buffer)}`);
      this.state = this.parseResponse(buffer);
    });
  }

  private async connect(retry = MAX_RETRIES) {
    if(!retry) {
      this.platform.log.debug(`Failed to connect after ${MAX_RETRIES} retries`);
      return;
    }
    this.platform.log.debug(`Connect retry: ${MAX_RETRIES + 1 - retry}`);
    try {
      await this.device.connect();
    } catch (e) {
      this.platform.log.debug('Failed to connect');
      await delay();
      await this.connect(--retry);
    }
  }

  private getCommandValue(cmd: CommandHandle, val?: boolean | number) {
    switch (cmd) {
      case CommandHandle.On:
        val = val ? 1 : 2;
        break;
      case CommandHandle.Flicker:
        val = 2;
        break;
      case CommandHandle.State:
        val = 0;
        break;
      case CommandHandle.Brightness:
        break;
    }
    return val as number;
  }

  private async sendCommand(cmd: CommandHandle, val?: boolean | number) {
    this.platform.log.debug(`sendCmd: ${cmd} with val ${val}`);
    const value = this.getCommandValue(cmd, val);
    let retry = 2;
    while (retry > 0) {
      try {
        await this.controlChar.writeValue(Buffer.from(new Uint8Array([CONTROL_HANDLE, cmd, value])));
        break;
      } catch (e) {
        this.platform.log.error('disconnected');
      }
      this.platform.log.error('reconnecting');
      await this.connect();
      retry--;
    }
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, turning on a Light bulb.
   */
  async setOn(value: CharacteristicValue) {
    await this.sendCommand(CommandHandle.On, value as boolean);
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
    await this.sendCommand(CommandHandle.State);
    return this.state.on;
  }

  /**
   * Handle "SET" requests from HomeKit
   * These are sent when the user changes the state of an accessory, for example, changing the Brightness
   */
  async setBrightness(value: CharacteristicValue) {
    await this.sendCommand(CommandHandle.Brightness, value as number);
    this.platform.log.debug('Set Characteristic Brightness -> ', value);
  }

  async getBrightness(): Promise<CharacteristicValue> {
    await this.sendCommand(CommandHandle.State);
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

  private set state({ on, brightness, color }: State) {
    const state: State = {
      on: Boolean(on),
      brightness: brightness >= 0 && brightness <= 100 ? brightness : defaultState.brightness,
      color: Array.isArray(color) ? color : defaultState.color,
    };
    this.state$.next(state);
    this.platform.log.debug('SetState', state);
  }

  private parseResponse([, stateHandle, on, brightness, r, g, b, white]: Uint8Array): State {
    if (stateHandle === STATE_HANDLE) {
      this.platform.log.debug('got state notification');
    }
    return {
      on: on === 1,
      brightness,
      color: [r, g, b, white],
    };
  }
}
