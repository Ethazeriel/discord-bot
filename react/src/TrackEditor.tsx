import * as React from 'react';
import type { Track } from './types';
import styled from 'styled-components';

export default function TrackEditor() {
  const [search, setSearch] = React.useState('');
  const [track, setTrack] = React.useState<Track | undefined>(undefined);

  const getTrack = () => {
    fetch(`./tracks/${search}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    }).then((response) => response.json()).then((json) => {
      setTrack(json);
    });
  };
  if (!track) {
    return (
      <div>
        <label>Search for a track:<input type="text" id="search" name="search" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <input type="button" id="searchgo" name="searchgo" value="Go!" onClick={getTrack}></input>
      </div>
    );
  } else {
    return (
      <div>
        <label>Search for a track:<input type="text" id="search" name="search" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <input type="button" id="searchgo" name="searchgo" value="Go!" onClick={getTrack} />
        <WholeTrack>
          <TrackPart>
            <h3>Goose</h3>
            <label>id:<input readOnly={true} value={track.goose.id}/></label>
            <label>plays:<input readOnly={true} value={track.goose.plays}/></label>
            <label>errors:<input readOnly={true} value={track.goose.errors}/></label>
          </TrackPart>
          <TrackPart>
            <h3>Album</h3>
            <label>id:<input readOnly={true} value={track.album.id}/></label>
            <label>name:<input readOnly={true} value={track.album.name}/></label>
            <label>number:<input readOnly={true} value={track.album.trackNumber}/></label>
          </TrackPart>
          <TrackPart>
            <h3>Artist</h3>
            <label>id:<input readOnly={true} value={track.artist.id}/></label>
            <label>name:<input readOnly={true} value={track.artist.name}/></label>
            <label>support link:<input readOnly={true} value={track.artist.official}/></label>
          </TrackPart>
          <TrackPart>
            <h3>Spotify</h3>
            <label>ids:<input readOnly={true} value={track.spotify.id}/></label>
            <label>name:<input readOnly={true} value={track.spotify.name}/></label>
            <label>duration:<input readOnly={true} value={track.spotify.duration}/></label>
            <label>art:<input readOnly={true} value={track.spotify.art}/></label>
          </TrackPart>
          <TrackPart>
            <h3>Youtube</h3>
            <label>id:<input readOnly={true} value={track.youtube.id}/></label>
            <label>name:<input readOnly={true} value={track.youtube.name}/></label>
            <label>duration:<input readOnly={true} value={track.youtube.duration}/></label>
            <label>art:<input readOnly={true} value={track.youtube.art}/></label>
          </TrackPart>
          <TrackPart>
            <h3>Alternates</h3>
            <label>1:<input readOnly={true} value={track.alternates[0].id}/></label>
            <label>2:<input readOnly={true} value={track.alternates[1].id}/></label>
            <label>3:<input readOnly={true} value={track.alternates[2].id}/></label>
            <label>4:<input readOnly={true} value={track.alternates[3].id}/></label>
          </TrackPart>
        </WholeTrack>
      </div>
    );
  }
}

const TrackPart = styled.div`
display:flex;
flex-direction: column;
flex:300px;
& h3 {
  margin-bottom:0px;
}
`;
const WholeTrack = styled.div`
display:flex;
flex-wrap: wrap;
`;