// I'm making these up from API responses because I can't find them really documented anywhere else
// almost certainly these are wrong
// even if they're correct, they're mostly too broad to be useful

type SubsonicAlbumResponse = {
  "subsonic-response": {
    status: string,
    version: string,
    type: string,
    serverVersion: string,
    openSubsonic: boolean,
    album: SubsonicAlbum
  }
}

type SubsonicSongResponse = {
  "subsonic-response": {
    status: string,
    version: string,
    type: string,
    serverVersion: string,
    openSubsonic: boolean,
    song: SubsonicSong
  }
}

type SubsonicPlaylistResponse = {
  "subsonic-response": {
    status: string,
    version: string,
    type: string,
    serverVersion: string,
    openSubsonic: boolean,
    playlist: SubsonicPlaylist
  }
}

type SubsonicSearchResponse = {
  "subsonic-response": {
    status: string,
    version: string,
    type: string,
    serverVersion: string,
    openSubsonic: boolean,
    searchResult2: { // will be empty object if no results
      song: Array<SubsonicSong>
    }
  }
}

type SubsonicAlbum = {
  id: string,
  name: string,
  artist: string,
  artistId: string,
  coverArt: string,
  songCount: number,
  duration: number, // time in seconds for entire album
  created: string, // I think this is a datetime string, is that a standardized thing?
  year: number,
  genre: string,
  userRating: number,
  genres: Array<{name:string}>,
  musicBrainzId: string,
  isCompilation: boolean,
  sortName: string,
  discTitles: Array<{disc:number}>,
  originalReleaseDate: {
    year: number,
    month: number,
    day: number
  }
  song: Array<SubsonicSong>
}

type SubsonicSong = {
  id: string,
  parent: string, // I think this is the album id?
  isDir: boolean,
  title: string,
  album: string,
  artist: string,
  track: number, // track number in album
  year: number,
  genre: string,
  coverArt: string,
  size: number, // in bytes maybe?
  contentType: string, // eg. "audio/flac"
  suffix: string, // eg. "flac"
  duration: number, // in seconds
  bitRate: number,
  path: string, //where this is on disk
  discNumber: number,
  created: string, // datetime, when added to subsonic server
  albumId: string,
  artistId: string,
  type: "music", //strictly speaking could be something else, but we won't support that
  isVideo: boolean,
  bpm: number,
  comment: string,
  sortName: string,
  mediaType: string,
  musicBrainzId: string,
  genres: Array<{name:string}>,
  replayGain: {
    trackPeak: number,
    albumPeak: number
  }
}

type SubsonicPlaylist = {
  id: string,
  name: string,
  songCount: number,
  duration: number,
  public: boolean,
  owner: string,
  created: string,
  changed: string,
  coverArt: string,
  entry: Array<SubsonicSong>
}