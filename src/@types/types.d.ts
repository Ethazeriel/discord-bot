interface Track {
	goose: {
		id:string,
		plays?:number
		errors?:number
		seek?:number,
		bar?:ProgressBarOptions
	},
  keys: string[],
	playlists: Record<string, number>,
	album: {
		id: string | null,
		name:string | number, // this needs to be able to be a number for shuffle
		trackNumber:number
	},
	artist: {
		id: string | null,
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

interface youtubeObject {
  id: string,
  name: string,
  art: string,
  duration: number
}

interface User {
	discord: {
		id: string,
		locale: string,
		nickname: Record<string, { current: string,	old?: string[] }>
		username: {
			current: string,
			old?: string[]
		}
		discriminator: {
			current: string,
			old?: string[]
		}
	}
	stash?: {
		playhead: number, // playhead index
		tracks: string[] // our unique ids for each track in queue (history, current, enqueued) when user or bot ends their session
	}
	tokens: {
    discord?:{
      access:string,
      renew:string,
      expiry:number,
      scope:string,
    },
    spotify?:{
      access:string,
      renew:string,
      expiry:number,
      scope:string,
    }
  },
	webClientId?:string[],
	spotify?: {
		id:string,
		username:string,
		locale:string
	}
}

type ProgressBarOptions = {
  start?:string,
  end?:string,
  barbefore?:string,
  barafter?:string,
  head?:string
}

type PlayerStatus = {
  tracks: Track[];
  playhead: number,
  loop: boolean,
  paused: boolean,
}