type WebWorkerMessage = {
  id:string
  userId:string
  type:'player'
  action:string
  parameter:string | number
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
  napster?: {
    id:string,
    username:string,
    locale:string
  }
}