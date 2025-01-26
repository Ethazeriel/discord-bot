interface User {
	discord: {
		id: string,
		locale: string,
		nickname: Record<string, { current: string | null,	old?: string[] }>
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
    discord?:Oauth2Token,
    spotify?:Oauth2Token,
		lastfm?:Oauth2Token,
		napster?:Oauth2Token
  },
	webClientId?:string[],
	spotify?: {
		id:string,
		username:string,
		locale:string
	},
	lastfm?: {
		id:string,
		username:string,
		locale:string
	},
	napster?: {
		id:string,
		username:string,
		locale:string
	}
}

type VoiceUser = {
  // userId: string,
  channelId: string,
  guildId: string,
}

type Oauth2Token = {
	access:string,
	renew:string,
	expiry:number,
	scope:string,
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

interface Track {
	goose: {
		UUID?:string
		id: string
		plays: number
		errors: number
		album: {
			name: string
			trackNumber: number
		}
		artist: {
			name: string
			official?: string
		}
		track: {
			name: string
			duration: number
			art: string
		}
	}
	keys: Array<string>
	playlists: Record<string, number>
	audioSource: AtLeastOne<AudioSources>	
	bar?: ProgressBarOptions
	spotify?: TrackSource
	napster?: TrackSource
	status: {
		seek?: number
		ephemeral?: boolean
		pause?: number
		start?: number
	}
	version: number
}

interface TrackSource {
	id: Array<string>
	name: string
	art: string
	duration: number
	url: string
	album: {
		id: string
		name: string
		trackNumber: number
	}
	artist: {
		id: string
		name: string
	}
}

interface TrackYoutubeSource {
  id: string
  name: string
  art: string
  duration: number
	url: string
	contentID?: {
		name: string
		artist: string
	}
}

interface SpotifyPlaylist {
	id: string
	name: string
	owner: string
	description: string
}


type AtLeastOne<T, U = {[K in keyof T]: Pick<T, K> }> = Partial<T> & U[keyof U]
// stolen from https://stackoverflow.com/questions/48230773/how-to-create-a-partial-like-that-requires-a-single-property-to-be-set
// I won't pretend to understand this at all

type AudioSources = {
	youtube: Array<TrackYoutubeSource>
	subsonic: TrackSource
}

interface GooseConfig {
	debug: boolean,
	functions: { // TODO - should we keep this?
		web: boolean,
		music: boolean,
		translate: boolean,
	}
	root_url: string,
	discord: {
		token: string,
		client_id: string,
		guildId: string,
		secret: string,
		scope: 'guild' | 'global',
		roles: {
			dj: string,
			admin: string,
			translate: string
		},
		redirect_uri: string
	},
	spotify: {
		client_id: string,
		client_secret: string,
		redirect_uri: string
	},
	napster: {
		client_id: string,
		client_secret: string,
		redirect_uri: string
	},
	lastfm: {
		client_id: string,
		client_secret: string,
		redirect_uri: string
	},
	youtube: {
		apiKey: string,
		useragent: string
	},
	subsonic: {
		username: string,
		password: string,
		client_id: string,
		endpoint_uri: string,
		regex: string
	},
	mongo: {
		url: string,
		database: string,
		trackcollection: string,
		usercollection: string
	},
	translate: {
		apiKey: string
	},
	internal?: {
		deployedHash: string
	}
}