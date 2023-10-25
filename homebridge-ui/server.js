const { HomebridgePluginUiServer } = require('@homebridge/plugin-ui-utils');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

class UiServer extends HomebridgePluginUiServer {
  constructor() {
    super();
    this.onRequest('/scan', this.scan.bind(this));
    // this.ready() must be called to let the UI know you are ready to accept api calls
    this.ready();
  }

  async scan({ name, timeout = 5 }) {
    const { stdout } = await exec(`yeelightble scan -t ${timeout} ${name ? '| grep ' + name : ''}`);
    return stdout?.split('\n').filter(d => !!d).map(d => {
      const [mac, ...name] = d.split(' ');
      if (mac.includes(':')) {
        return { mac, name: name.join(' ') };
      }
    });
  }
}

// start the instance of the class
(() => {
  return new UiServer;
})();
