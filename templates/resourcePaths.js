/* eslint-disable no-undef */

// https://api.spotify.com/v1/playlists/playlist_id
// '?fields=tracks.items(track(album(id,name,images),artists(id,name),track_number,id,name,duration_ms))',
let track = {
  'keys' : [],
  'playlists': {},
  'album' : {
    'id' : spotifyResult.tracks?.items?.[i]?.track?.album?.id,
    'name' : spotifyResult.tracks?.items?.[i]?.track?.album?.name,
    'trackNumber' : spotifyResult.tracks?.items?.[i]?.track?.track_number,
  },
  'artist' : {
    'id' : spotifyResult.tracks?.items?.[i]?.track?.artists?.[0]?.id,
    'name' : spotifyResult.tracks?.items?.[i]?.track?.artists?.[0]?.name,
  },
  'spotify' : {
    'id' : [spotifyResult.tracks?.items?.[i]?.track?.id],
    'name' : spotifyResult.tracks?.items?.[i]?.track?.name,
    'art' : spotifyResult.tracks?.items?.[i]?.track?.album?.images?.[0]?.url,
    'duration' : spotifyResult.tracks?.items?.[i]?.track?.duration_ms,
  },
};

// https://api.spotify.com/v1/albums/id
// is ignored, but should be '?fields=id,name,artists(id,name),images,tracks.items(track_number,id,name,duration_ms)',
track = {
  'keys' : [],
  'playlists': {},
  'album' : {
    'id' : spotifyResult.id,
    'name' : spotifyResult.name,
    'trackNumber' : spotifyResult.tracks?.items?.[i]?.track_number,
  },
  'artist' : {
    'id' : spotifyResult.artists?.[0]?.id,
    'name' : spotifyResult.artists?.[0]?.name,
  },
  'spotify' : {
    'id' : [spotifyResult.tracks?.items?.[i]?.id],
    'name' : spotifyResult.tracks?.items?.[i]?.name,
    'art' : spotifyResult.images?.[0]?.url,
    'duration' : spotifyResult.tracks?.items?.[i]?.duration_ms,
  },
};

// https://api.spotify.com/v1/tracks/id
// is ignored, but should be '?fields=track_number,id,name,duration_ms,album(id,name,images),artists(id,name)',
track = {
  'keys' : [],
  'playlists': {},
  'album' : {
    'id' : spotifyResult.album?.id,
    'name' : spotifyResult.album?.name,
    'trackNumber' : spotifyResult.track_number,
  },
  'artist' : {
    'id' : spotifyResult.artists?.[0]?.id,
    'name' : spotifyResult.artists?.[0]?.name,
  },
  'spotify' : {
    'id' : [spotifyResult.id],
    'name' : spotifyResult.name,
    'art' : spotifyResult.album?.images?.[0]?.url,
    'duration' : spotifyResult.duration_ms,
  },
};

// https://api.spotify.com/v1/search
// is ignored, but should be '?fields=tracks.items(album(id,name,images),artists(id,name),track_number,id,name,duration_ms)',
track = {
  'keys' : [],
  'playlists': {},
  'album' : {
    'id' : spotifyResult.tracks?.items?.[0]?.album?.id,
    'name' : spotifyResult.tracks?.items?.[0]?.album?.name,
    'trackNumber' : spotifyResult.tracks?.items?.[0]?.track_number,
  },
  'artist' : {
    'id' : spotifyResult.tracks?.items?.[0]?.artists?.[0]?.id,
    'name' : spotifyResult.tracks?.items?.[0]?.artists?.[0]?.name,
  },
  'spotify' : {
    'id' : [spotifyResult.tracks?.items?.[0]?.id],
    'name' : spotifyResult.tracks?.items?.[0]?.name,
    'art' : spotifyResult.tracks?.items?.[0]?.album?.images?.[0]?.url,
    'duration' : spotifyResult.tracks?.items?.[0]?.duration_ms,
  },
};

// https://youtube.googleapis.com/youtube/v3/search
track.youtube = {
  'id' : youtubeResult.items?.[0]?.id?.videoId,
  'name': youtubeResult.items?.[0]?.snippet?.title,
  'art' : youtubeResult.items?.[0]?.snippet?.thumbnails?.high?.url,
};

// ytdl.getBasicInfo(id)
track.youtube.duration = ytdlResult.player_response?.videoDetails?.lengthSeconds;