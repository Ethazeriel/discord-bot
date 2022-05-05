export interface Track {
	goose: {
		id:string
		plays?:number
		errors?:number
	},
  keys: string[],
	playlists: {
		name:number // "name" : "position"
	},
	album: {
		id: string,
		name:string,
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
	alternates: youtubeObject[]
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