export type PlayerClick = {
  action: string,
  parameter?: any
};

export type User = {
	status: 'new' | 'known'
	discord?: {
    id: string,
    username: string,
    discriminator: string,
}
	spotify?: { username: string }
	napster?: { username: string }
}
