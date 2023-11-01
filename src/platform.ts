import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings';
import { YeelightNgPlatformAccessory } from './platformAccessory';
import { CommandPayload, CommandType, State } from './types';
import { WebSocketClient } from './ws';
import { throttle } from './utils';

export interface Device {
  mac: string;
  name: string;
}

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class YeelightNgPlatform implements DynamicPlatformPlugin {
  readonly Service: typeof Service = this.api.hap.Service;
  readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  // this is used to track restored cached accessories
  private readonly accessories: PlatformAccessory<Device>[] = [];
  private readonly stateHandlers = new Map<string, (state: State) => void>();
  private ws!: WebSocketClient;

  constructor(readonly log: Logger, readonly config: PlatformConfig, readonly api: API) {
    const { devices = [], name, websocket } = this.config;
    this.log.debug('Finished initializing platform:', name);
    if (devices?.length) {
      this.ws = new WebSocketClient(this.stateHandlers, log, websocket);
    } else {
      this.log.warn('Platform not started, no configured devices');
    }
    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on('didFinishLaunching', () => {
      this.log.debug('Executed didFinishLaunching callback');
      this.updateAccessories(devices);
    });

    this.api.on('shutdown', () => {
      this.ws?.close();
    });
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to set up event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory<Device>) {
    this.log.info('Loading accessory from cache:', accessory.displayName);
    // add the restored accessory to the accessories cache, so we can track if it has already been registered
    this.accessories.push(accessory);
  }

  updateAccessories(devices: Device[]) {
    // loop over the configured devices and register each one if it has not already been registered
    for (const device of devices) {
      // generate a unique id for the accessory this should be generated from
      // something globally unique, but constant, for example, the device serial
      // number or MAC address
      const uuid = this.api.hap.uuid.generate(device.mac);
      // see if an accessory with the same uuid has already been registered and restored from
      // the cached devices we stored in the `configureAccessory` method above
      const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);
      if (existingAccessory) {
        // the accessory already exists
        this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);
        // if you need to update the accessory.context then you should run `api.updatePlatformAccessories`. eg.:
        existingAccessory.context = device;
        this.api.updatePlatformAccessories([existingAccessory]);
        // create the accessory handler for the restored accessory
        new YeelightNgPlatformAccessory(this, existingAccessory);
      } else {
        // the accessory does not yet exist, so we need to create it
        this.log.info('Adding new accessory:', device.name);
        // create a new accessory
        const accessory: PlatformAccessory<Device> = new this.api.platformAccessory(device.name, uuid);
        // store a copy of the device object in the `accessory.context`
        // the `context` property can be used to store any data about the accessory you may need
        accessory.context = device;
        // create the accessory handler for the newly create accessory
        new YeelightNgPlatformAccessory(this, accessory);
        // link the accessory to your platform
        this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
      }
    }
    const cachedAccessories = this.accessories.filter(a => !devices.some((d: Device) => d.mac === a.context.mac));
    if (cachedAccessories?.length) {
      this.log.info('Removing non configured cached accessories:', cachedAccessories.map(a => a.displayName).join(','));
      this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, cachedAccessories);
    }
  }

  @throttle()
  sendCommand(uuid: string, type: CommandType, payload?: CommandPayload) {
    this.log.debug(`Publish for uuid:${uuid} type:${type} payload: ${payload}`);
    const command = { type, payload };
    const message = JSON.stringify({ command, uuid });
    this.ws?.send(message);
  }

  registerStateHandler(uuid: string, handler: (state: State) => void) {
    this.stateHandlers.set(uuid, handler);
  }
}
