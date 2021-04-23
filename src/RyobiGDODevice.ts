export interface RyobiGDODevice {
  id: string;
  name: string;
  description: string;
  model: string;
  moduleId?: number;
  portId?: number;
  state?: number;
  stateAsOf?: number;
  type: 'hub' | 'gdo';
}
