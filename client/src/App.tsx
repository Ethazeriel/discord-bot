import './App.css';
import * as React from 'react';
import { TrackSmall } from './TrackSmall';
import type { PlayerClick, PlayerStatus, User } from './types';
import { StatusBar } from './StatusBar';
import { MediaBar } from './MediaBar';
import styled from 'styled-components';
import DisplaySelect from './DisplaySelect';


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

const MainContent = styled.div`
display: flex;
& > div {
  border-left: 2px solid #373839;
  border-right: 2px solid #373839;
  width: 100%;
}
`;

export default class App extends React.Component<Record<string, never>, AppState> {

  constructor(props:Record<string, never>) {
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
    fetch(`${window.location.origin}/player`, {
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
    fetch(`${window.location.origin}/load`, {
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
      const socket = new WebSocket(`wss://${window.location.hostname}/websocket`); // this is not a problem
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
    if (this.state.user.status === 'new') {
      return (
        <div className="App">
          <StatusBar status={{ user: this.state.user, player:this.state.playerStatus }} />
          <ErrorDisplay error={this.state.error} />
        </div>
      );
    } else {
      return (
        <div className="App">
          <StatusBar status={{ user: this.state.user, player:this.state.playerStatus }} />
          <MediaBar status={this.state.playerStatus} playerClick={this.playerClick}/>
          <ErrorDisplay error={this.state.error} />
          <MainContent>
            <PlayerQueue playerClick={this.playerClick} queue={this.state.playerStatus} />
            <DisplaySelect />
          </MainContent>
        </div>
      );
    }
  }
  // <MediaBar playerClick={this.playerClick} />
  // <PlayerQueue playerClick={this.playerClick} queue={this.state.playerStatus} />
}

class PlayerQueue extends React.Component<{playerClick:(a: PlayerClick) => void, queue?: PlayerStatus}, never> {
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
      <div>
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