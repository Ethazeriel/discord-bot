import './App.css';
import * as React from 'react';
import { TrackSmall } from './trackdisplay';
import type { Track, PlayerClick, PlayerStatus, User } from './types';
import { StatusBar } from './StatusBar';
type AppState = {
  track?: Track,
  playerStatus?: PlayerStatus,
  user: User,
  error: null | string,
}

type LoadResponse = {
  player?: PlayerStatus,
  user: User,
  error: undefined | string,
}

export default class App extends React.Component<{}, AppState> {

  constructor(props:AppState) {
    super(props);
    this.state = {
      track:undefined,
      playerStatus:undefined,
      error: null,
      user: { status: 'new' },
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

  componentDidMount(): void {
    // fetch('./playlist/boop', {
    //   method: 'GET',
    //   headers: {
    //     Accept: 'application/json',
    //     'Content-Type': 'application/json',
    //   },
    // }).then((response) => response.json()).then((json: any) => {
    //   this.setState({ playerStatus: {
    //     tracks: json,
    //     playhead: 0,
    //     loop: false,
    //     paused: false,
    //   } });
    // }).catch((error) => { console.error(error); });
    //
    fetch('./load', {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    }).then((response) => response.json()).then((json: LoadResponse) => {
      if (json?.user?.status === 'known') {
        this.setState({ user: json.user });
        this.setState({ playerStatus: json.player });
      } else if (json.user.status === 'new') {
        // could do a new user welcome message?
      } else { this.setState({ error:'unexpected loaduser response' }); }
      // console.log(json);
    }).catch((error) => { console.error(error); });
  }

  render() {
    return (
      <div className="App">
        <StatusBar status={{ user: this.state.user, player:this.state.playerStatus }} />
        <ErrorDisplay error={this.state.error} />
        <QueueSmall playerClick={this.playerClick} queue={this.state.playerStatus} />
      </div>
    );
  }

}

// function StatusBar(props) {

// }

class QueueSmall extends React.Component<{playerClick:(a: PlayerClick) => void, queue?: PlayerStatus}, never> {
  constructor(props: {playerClick:(a: PlayerClick) => void, queue: PlayerStatus}) {
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

function ErrorDisplay(props: { error: null | string }) {
  if (props.error) {
    return <div className="Error">{props.error}</div>;
  } else { return null;}
}