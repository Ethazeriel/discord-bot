
interface PlayerAction<A extends ActionType> {
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
  'pendingIndex':PlayerPendingIndex
  'move':PlayerMove
  'remove':number,
  'empty':undefined,
  'shuffle':boolean,
  'failedIndex':PlayerFailedIndex
}

type ActionType = keyof ParameterMap

interface PlayerPendingIndex {
  index: number,
  query: string
}
interface PlayerMove {
  from: number,
  to: number,
  UUID: string
}
interface PlayerFailedIndex {
  UUID: string,
  query: string
}

interface WebWorkerMessage<A extends ActionType> extends PlayerAction<A> {
  id:string
  userId:string
  userName:string
  type:'player'
}

type WebParentMessage = {
  id:string
  error:string
  status:PlayerStatus
}

type WebUser = {
  status:'known'
  discord: {
    id: string
    username: string
    discriminator: string
  }
  spotify?: {
		id:string,
		username:string,
		locale:string
	}
  lastfm?: {
		id:string,
		username:string,
		locale:string
	}
  napster?: {
    id:string,
    username:string,
    locale:string
  }
}