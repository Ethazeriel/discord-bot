export interface Track {
	goose: {
		id:string,
		plays?:number
		errors?:number
		seek?:number,
		bar:ProgressBarOptions
	},
  keys: string[],
	playlists: Record<string, number>,
	album: {
		id: string,
		name:string | number, // this needs to be able to be a number for shuffle
		trackNumber:number
	},
	artist: {
		id: string,
		name: string,
		official: string // url link to official site, if !official then bandcamp, etc
	},
	spotify: {
		id: string[],
    name: string,
		art: string,
		duration: number
	},
	youtube: youtubeObject,
	alternates: youtubeObject[],
	ephemeral?: string
	pause?: number
	start?: number
}

type ProgressBarOptions = {
  start?:string,
  end?:string,
  barbefore?:string,
  barafter?:string,
  head?:string
}

interface youtubeObject {
  id: string,
  name: string,
  art: string,
  duration: number
}

export type PlayerClick = {
  action: string,
  parameter?: any
};
export type PlayerStatus = {
  tracks: Track[];
  playhead: number,
  loop: boolean,
  paused: boolean,
}

export type User = {
	status: 'new' | 'known'
	discord?: {
    id: string,
    username: string,
    discriminator: string,
}
	spotify?: { username: string }
}
