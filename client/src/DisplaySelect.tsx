import * as React from 'react';
import { BasicTrack, SourceAsTrack } from './BasicTrack';
import TrackEditor from './TrackEditor';

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
        <option value="track">Track Editor</option>
      </select>
      <ContentContainer content={selValue} />
    </div>
  );
}

function ContentContainer(props: {content:string}) { // naming things is hard ok
  if (props.content === 'playlist') {
    return <PlaylistDisplay />;
  } else if (props.content === 'spotify') {
    return <SpotifyDisplay />;
  } else {
    return <TrackEditor />;
  }
}

function PlaylistDisplay() {
  const [playlists, setPlaylists] = React.useState<string[]>([]);
  const [selValue, setSelValue] = React.useState<string>('');
  const [tracks, setTracks] = React.useState<Track[]>([]);
  React.useEffect(() => {
    fetch(`${window.location.origin}/playlists`).then(res => res.json()).then((json: string[]) => {
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
    fetch(`${window.location.origin}/playlist/${selValue}`).then(res => res.json()).then((json: Track[]) => {
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
  const [playlists, setPlaylists] = React.useState<SpotifyPlaylist[]>([]);
  const [selValue, setSelValue] = React.useState<string>('');
  const [tracks, setTracks] = React.useState<TrackSource[]>([]);
  React.useEffect(() => {
    fetch(`${window.location.origin}/spotify-playlists`).then(res => res.json()).then((json: SpotifyPlaylist[]) => {
      setPlaylists(json);
    });
  }, []);

  const onChange = (event:React.ChangeEvent<any>) => {
    setSelValue(event.target.value);
  };

  const goClick = () => {
    fetch(`${window.location.origin}/spotify-playlist/${selValue}`).then(res => res.json()).then((json: TrackSource[]) => {
      setTracks(json);
    });
  };

  const listplaylists = [<option value='' disabled key='' >Pick a playlist...</option>];
  for (const list of playlists) {
    listplaylists.push(<option value={list.id} key={list.id}>{list.name}</option>);
  }
  return (
    <>
      <select name="playlists" value={selValue} onChange={onChange}>
        {listplaylists}
      </select>
      <button type="button" onClick={goClick}>Go</button>
      <SourceTrackList tracks={tracks} />
    </>
  );
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

function SourceTrackList(props: {tracks:TrackSource[]}) {
  const queue = [];
  if (props?.tracks) {
    for (const [i, track] of props.tracks.entries()) {
      queue.push(<SourceAsTrack source={track} key={i} id={i} />);
    }
  }
  return (
    <div>
      {queue}
    </div>
  );
}