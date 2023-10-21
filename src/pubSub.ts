import Redis from 'ioredis';
import { Logger } from 'homebridge';
import { Message, State } from './types';

export class PubSub {
  private controlChannel = 'yeelightble:control';
  private stateChannel = 'yeelightble:state';
  private pub!: Redis;
  private sub!: Redis;

  constructor(private log: Logger, { host = 'localhost', port = 6379 }) {
    this.pub = new Redis(port, host);
    this.sub = new Redis(port, host);
  }

  publish(message: string) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    this.pub.publish(this.controlChannel, message, (err, result) => {
      if (err) {
        this.log.error(`Error publishing message: ${err}`);
      } else {
        this.log.debug(`Published message: ${message}`);
      }
    });
  }

  subscribe(stateHandlers: Map<string, (state: State) => void>) {
    this.sub.subscribe(this.stateChannel, (err, count) => {
      if (err) {
        this.log.error(`Error subscribing to ${this.stateChannel}: ${err}`);
      } else {
        this.log.info(`Subscribed to ${count} channels, including "${this.stateChannel}"`);
      }
    });
    this.sub.on('message', (channel: string, message: string) => {
      this.log.debug(`Received message on channel ${channel}: ${message}`);
      try {
        const { uuid, state } = JSON.parse(message) as Message;
        this.log.debug(`Received state for ${uuid}: ${JSON.stringify(state)}`);
        if (uuid && state) {
          const handler = stateHandlers.get(uuid);
          handler && handler(state);
        }
      } catch (error) {
        this.log.error(`Error processing message: ${error}`);
      }
    });
  }

  unsubscribe() {
    this.sub?.unsubscribe(this.stateChannel);
    this.sub?.quit();
    this.pub?.quit();
  }
}