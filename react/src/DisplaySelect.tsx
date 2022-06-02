import * as React from 'react';
import type { Track } from './types';
import BasicTrack from './BasicTrack';

export default function DisplaySelect() {
  const [selValue, setSelValue] = React.useState('playlist');

  const onChange = (event:React.ChangeEvent<any>) => {
    switch (event.target.name) {
      case 'whichcontent':
        setSelValue(event.target.value);
        break;

    }
  };

  return (
    <div>
      <select name="whichcontent" value={selValue} onChange={onChange}>
        <option value="playlist">Bot Playlist</option>
        <option value="spotify">Spotify Content</option>
      </select>
      <ContentContainer content={selValue} />
    </div>
  );
}

function ContentContainer(props: {content:string}) { // naming things is hard ok
  if (props.content === 'playlist') {
    return <PlaylistDisplay />;
  } else {
    return <SpotifyDisplay />;
  }
}

function PlaylistDisplay() {
  const [playlists, setPlaylists] = React.useState<string[]>(new Array);
  const [selValue, setSelValue] = React.useState<string>('');
  const [tracks, setTracks] = React.useState<Track[]>([]);
  React.useEffect(() => {
    fetch('./playlists').then(res => res.json()).then((json: string[]) => {
      setPlaylists(json);
    });
  }, []);

  const onChange = (event:React.ChangeEvent<any>) => {
    switch (event.target.name) {
      case 'playlists':
        setSelValue(event.target.value);
        break;

    }
  };

  const goClick = () => {
    fetch(`./playlist/${selValue}`).then(res => res.json()).then((json: Track[]) => {
      setTracks(json);
    });
  };

  const listoptions = [<option value='' disabled key='' >Pick a playlist...</option>];
  for (const listname of playlists) {
    listoptions.push(<option value={listname} key={listname}>{listname}</option>);
  }
  return (
    <>
      <select name="playlists" value={selValue} onChange={onChange}>
        {listoptions}
      </select>
      <button type="button" onClick={goClick}>Go</button>
      <BasicTrackList tracks={tracks} />
    </>
  );
}

function SpotifyDisplay() {
  return (<p>spotify stuff here</p>);
}

function BasicTrackList(props: {tracks:Track[]}) {
  const queue = [];
  if (props?.tracks) {
    for (const [i, track] of props.tracks.entries()) {
      queue.push(<BasicTrack track={track} key={i} id={i} />);
    }
  }
  return (
    <div>
      {queue}
    </div>
  );
}