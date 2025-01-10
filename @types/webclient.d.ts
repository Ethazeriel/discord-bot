
export interface PlayerAction<A extends ActionType> {
  action: A
  parameter: ParameterMap[A]
}

type ParameterMap = {
  'get':undefined,
  'slowmode':undefined,
  'prev':undefined,
  'next':undefined,
  'jump':number,
  'seek':string,
  'togglePause':boolean,
  'toggleLoop':undefined,
  'pendingIndex':string, // will be PlayerPendingIndex
  'move':string, // will be PlayerMove
  'remove':number,
  'empty':undefined,
  'shuffle':boolean,
}

export type ActionType = keyof ParameterMap

interface PlayerPendingIndex {
  index: number,
  query: string
}
interface PlayerMove {
  from: string,
  to: string,
  UUID: string
}