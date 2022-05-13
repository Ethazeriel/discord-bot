import './App.css';
import * as React from 'react';
import { TrackSmall } from './TrackSmall';
import type { PlayerClick, PlayerStatus, User } from './types';
import { StatusBar } from './StatusBar';
import { MediaBar } from './MediaBar';
type AppState = {
  playerStatus?: PlayerStatus,
  user: User,
  error: null | string,
  socket?: any,
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
      playerStatus:undefined,
      error: null,
      user: { status: 'new' },
      socket: undefined,
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
    }).then(() => {
      const socket = new WebSocket('ws://localhost:2468');
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      socket.addEventListener('open', (event: any) => {
        //
      });
      socket.addEventListener('message', (event: any) => {
        const data = JSON.parse(event.data);
        switch (data.type) {
          case 'playerStatus': {
            this.setState({ playerStatus: data.queue });
            break;
          }
          case 'error': {
            this.setState({ error: data.error });
            break;
          }
          default: {
            console.log(`WebSocket—bad type ${event.type}`);
            break;
          }
        }
      });
      this.setState({ socket: socket });
    }).catch((error) => { console.error(error); });
  }

  render() {
    return (
      <div className="App">
        <StatusBar status={{ user: this.state.user, player:this.state.playerStatus }} />
        <ErrorDisplay error={this.state.error} />
      </div>
    );
  }
  // <MediaBar playerClick={this.playerClick} />
  // <QueueSmall playerClick={this.playerClick} queue={this.state.playerStatus} />
}

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