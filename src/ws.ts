import WebSocket from 'ws';
import { Logger } from 'homebridge';
import { Message, State } from './types';

const MAX_DELAY = 30; // seconds
export class WebSocketClient {
  private ws!: WebSocket;
  private readonly address!: string;
  private retry = 0;

  constructor(
    private stateHandlers: Map<string, (state: State) => void>,
    private log: Logger,
    { host = '0.0.0.0', port = 8765 } = {},
  ) {
    this.address = `ws://${host}:${port}`;
    this.connect();
  }

  private connect() {
    this.ws = new WebSocket(this.address);
    this.ws.addEventListener('open', () => {
      this.log.info(`Connected to the WebSocket server at ${this.address}`);
    });

    this.ws.addEventListener('message', (event) => {
      try {
        const { uuid, state }: Message = JSON.parse(event.data as string);
        this.log.debug(`Received state for ${uuid}: ${JSON.stringify(state)}`);
        if (uuid && state) {
          const handler = this.stateHandlers.get(uuid);
          handler && handler(state);
        }
      } catch (error) {
        this.log.error(`Error processing message: ${error}`);
      }
    });

    this.ws.addEventListener('close', () => {
      const delay = Math.min(2 ** this.retry++, MAX_DELAY);
      this.log.warn(`Connection closed, trying to reconnect in ${delay} seconds`);
      setTimeout(() => this.connect(), delay * 1000);
    });

    this.ws.addEventListener('error', (event) => {
      this.log.error(event.message);
    });
  }

  send(message: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(message);
      this.log.debug('Sent message:', message);
    } else {
      this.log.error('WebSocket connection is not open');
    }
  }

  close() {
    this.ws?.close();
    this.log.info('WebSocket connection was closed');
  }
}
