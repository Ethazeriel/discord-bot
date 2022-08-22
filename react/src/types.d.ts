export interface Track {
	goose: {
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
	youtube: Array<TrackYoutubeSource>
	bar?: ProgressBarOptions
	spotify?: TrackSource
	amazon?: TrackSource
	itunes?: TrackSource
	status: {
		seek?: number
		ephemeral?: string
		pause?: number
		start?: number
	}
}

type ProgressBarOptions = {
  start?:string,
  end?:string,
  barbefore?:string,
  barafter?:string,
  head?:string
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
	napster?: { username: string }
}
