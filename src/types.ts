export interface Message {
  uuid: string;
  command?: Command;
  state?: State;
}

export interface State {
  on: boolean;
  color: number[];
  brightness: number;
  ct: number;
  mode: number | string;
}
export interface Command {
  type: CommandType;
  payload?: CommandPayload;
}

export type CommandPayload = string | number | number[] | boolean;

export enum CommandType {
  SetColor = 'color',
  SetBrightness = 'brightness',
  SetOn = 'on',
  GetState = 'state'
}
