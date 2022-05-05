import './App.css';
import * as React from 'react';
import { TrackSmall } from './trackdisplay';

import type { Track, PlayerClick } from './types';

type AppState = {
  track?: Track,
  playerStatus?: QueueProps,
  discord?: DiscordProps,
  spotify?: { username: string },
  error: null | string,
}

type DiscordProps = {
    id?: string,
    username?: string,
    discriminator?: string,
}

type QueueProps = {
  tracks: Track[];
  playhead: number,
  loop: boolean,
  paused: boolean,
}

type LoadResponse = {
  discord: DiscordProps,
  spotify: { username: string },
  player: QueueProps,
  error: undefined | string,
  status: 'known'|'new',
}

export default class App extends React.Component<{}, AppState> {

  constructor(props:AppState) {
    super(props);
    this.state = {
      track:undefined,
      playerStatus:undefined,
      discord:undefined,
      spotify:undefined,
      error: null,
    };
    this.playerClick = this.playerClick.bind(this);
  }

  playerClick(playerClick: PlayerClick) {
    fetch('./player', {
      method: 'POST',
      body: JSON.stringify({ action: playerClick.action, parameter: playerClick.parameter }),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    }).then((response) => response.json()).then((json) => {
      // console.log(json);
      this.setState({ playerStatus:json.status });
    }).catch((error) => { console.error(error); });
  }

  componentDidMount() {
    fetch('./load', {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    }).then((response) => response.json()).then((json: LoadResponse) => {
      if (json.status === 'known') {
        this.setState({ spotify: json.spotify });
        this.setState({ discord: json.discord });
        this.setState({ playerStatus: json.player });
      } else if (json.status === 'new') {
        // could do a new user welcome message?
      } else { this.setState({ error:'unexpected loaduser response' }); }
      // console.log(json);
    }).catch((error) => { console.error(error); });
  }

  render() {
    return (
      <div className="App">
        <ErrorDisplay error={this.state.error} />
        <UserBoxDiscord user={this.state.discord} />
        <UserBoxSpotify user={this.state.spotify} />
        <QueueSmall playerClick={this.playerClick} queue={this.state.playerStatus} />
      </div>
    );
  }

}

// function StatusBar(props) {

// }

class QueueSmall extends React.Component<{playerClick:(a: PlayerClick) => void, queue?: QueueProps}, never> {
  constructor(props: {playerClick:(a: PlayerClick) => void, queue: QueueProps}) {
    super(props);
  }

  render() {
    const queue = [];
    if (this.props?.queue?.tracks) {
      for (const [i, track] of this.props.queue.tracks.entries()) {
        queue.push(<TrackSmall playerClick={this.props.playerClick} track={track} key={i} id={i} />);
      }
    }
    return (
      <div className="Queue">
        {queue}
      </div>
    );
  }
}

function UserBoxDiscord(props: { user?: DiscordProps }) {
  let content = null;
  if (props.user) {
    content = <p>{props.user.username}#{props.user.discriminator}</p>;
  } else {
    const authLink = './oauth2?type=discord';
    content = <a href={authLink}>Link discord</a>;
  }
  return (
    <div className="UserBox">
      {content}
    </div>
  );
}

function UserBoxSpotify(props: { user?:{ username: string } }) {
  let content = null;
  if (props.user) {
    content = <p>{props.user.username}</p>;
  } else {
    const authLink = './oauth2?type=spotify';
    content = <a href={authLink}>Link spotify</a>;
  }
  return (
    <div className="UserBox2">
      {content}
    </div>
  );
}

function ErrorDisplay(props: { error: null | string }) {
  if (props.error) {
    return <div className="Error">{props.error}</div>;
  } else { return null;}
}