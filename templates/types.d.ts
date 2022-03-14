// I have some vague idea that this might help our IDE with autofill, and if not should help for the eventual typescript migration
interface track {
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

interface user {
	discord: {
		id: string,
		locale: string,
		nickname: {
			guildid: ?{ // new object per guild where this user exists
				current: string,
				old: ?string[]
			}
		}
		username: {
			current: string,
			old: ?string[]
		}
		discriminator: {
			current: string,
			old: ?string[]
		}
	}
	stash: ?{
		playhead: number, // playhead index
		tracks: string[] // our unique ids for each track in queue (history, current, enqueued) when user or bot ends their session
	}
}