// I have some vague idea that this might help our IDE with autofill, and if not should help for the eventual typescript migration
export interface track {
	goose: {
		id:string
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
