export interface State {
  on: boolean;
  color: number[];
  brightness: number;
}

export enum CommandHandle {
  // SetColor = 'color',
  Brightness = 0x42,
  On = 0x40,
  Flicker = 0x67,
  State = 0x44
}
