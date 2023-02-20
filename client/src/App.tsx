import './App.css';
import * as React from 'react';
import { TrackSmall } from './TrackSmall';
import type { PlayerClick, PlayerStatus, User } from './types';
import { StatusBar } from './StatusBar';
import { MediaBar } from './MediaBar';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import styled, { css } from 'styled-components';
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
  error: null | string,
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
      // spite
      json && Object.keys(json).map((key:string) => {
        switch (key) {
          case 'error': {
            this.setState({ error: json.error });
            break;
          }
          case 'status': {
            this.setState({ playerStatus: json.status });
            break;
          }
        }
      });
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
        if (json.error) { console.log(json.error); } // for testing; failing to get a player returns an error, but should
        this.setState({ user: json.user, playerStatus: json.player }); // only be read as an error by /player, not /load
      } else if (json.user.status === 'new') {
        // could do a new user welcome message?
      } else { this.setState({ error:'unexpected loaduser response' }); }
      // console.log(json);
    }).then(() => {
      const protocol = (window.location.hostname === 'localhost') ? 'ws' : 'wss';
      const socket = new WebSocket(`${protocol}://${window.location.hostname}/websocket`); // this is not a problem
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      socket.addEventListener('open', (event: any) => {
        console.log(`WebSocket open: ${JSON.stringify(event, null, 2)}`);
      });
      socket.addEventListener('error', (event: any) => {
        console.log(`WebSocket error: ${JSON.stringify(event, null, 2)}`);
      });
      socket.addEventListener('close', (event: any) => {
        console.log(`WebSocket close: ${JSON.stringify(event, null, 2)}`);
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
            <PlayerQueue playerClick={this.playerClick} status={this.state.playerStatus} />
            <DisplaySelect />
          </MainContent>
        </div>
      );
    }
  }
  // <MediaBar playerClick={this.playerClick} />
  // <PlayerQueue playerClick={this.playerClick} queue={this.state.playerStatus} />
}
const DragBackground = styled.div<{visible: boolean, x:number, y:number}>`
  top: ${props => props.y}px;
  left: ${props => props.x}px;
  position: absolute;
  display: flex;
  flex-wrap: nowrap;
  background-color: #c9b9b9;
  opacity: 0.8;
  visibility: hidden;
  user-select: none;
  pointer-events: none;
  z-index: 10;
  border-radius: 0.25rem;
  ${(props) => {
    if (props.visible) {
      return css`
        visibility: visible;
      `;
    }
  }}
`;

const DragText = styled.span<{offset:number}>`
  left: ${props => props.offset}px;
  position: relative;
  background-color: #5e585e;
  visibility: inherit;
  user-select: none;
  pointer-events: none;
  border-radius: 0.25rem;
`;

function dragText(state: any, [type, value]:[any, any?]) {
  switch (type) {
    case 'visible': {
      return ({ ...state, visible: value });
    }
    case 'position': {
      return ({ ...state, dragY: value.y - 15, dragX:value.x - 9, offsetX:18 });
    }
    case 'label': {
      return ({ ...state, label: value });
    }
  }
}
function PlayerQueue(props: { playerClick:(action:PlayerClick) => void, status?:PlayerStatus }) {
  const initialState: { visible:boolean, label:string, dragY:number, dragX:number, offsetX:number } = {
    visible: false,
    label: '',
    dragY: 0,
    dragX: 0,
    offsetX: 0,
  };
  const [state, cursorText] = React.useReducer(dragText, initialState);
  const [dragID, setDragID] = React.useState<number | null>(null);

  React.useEffect(() => {
    const dragSet = (event:any):void => {
      // console.log(`setting dragID to: ${event.detail}`);
      setDragID(event.detail);
    };
    addEventListener('dragset', dragSet);

    const dragOver = (event:DragEvent):void => {
      if (event.dataTransfer && event.dataTransfer.types.includes('application/x-goose.track')) {
        cursorText(['position', { y: event.pageY, x: event.pageX }]);
      }
    };
    window.addEventListener('dragover', dragOver);

    return (() => {
      removeEventListener('dragset', dragSet);
      window.removeEventListener('dragover', dragOver);
    });
  }, []);

  const serverQueue = props.status?.tracks;
  const localQueue:JSX.Element[] = React.useMemo(() => {
    const queue = [];
    if (serverQueue) {
      for (const [i, track] of serverQueue.entries()) {
        queue.push(<TrackSmall key={track.goose.UUID!} id={i} track={track} playerClick={props.playerClick} dragID={dragID} cursorText={cursorText} />);
      }
    }
    return (queue);
  }, [serverQueue, props.playerClick, dragID]);

  React.useEffect(() => {
    console.log('serverqueue change');
  }, [serverQueue]);

  return (
    <div>
      <DragBackground visible={state.visible} x={state.dragX} y={state.dragY}>
        <DragText offset={state.offsetX}>{state.label}</DragText></DragBackground>
      {localQueue}
    </div>
  );
}

function ErrorDisplay(props: { error: null | string }) {
  if (props.error) {
    return <div className="Error">{props.error}</div>;
  } else { return null;}
}