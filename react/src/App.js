import './App.css';
import React from 'react';
import { TrackSmall } from './trackdisplay.js';


export default class App extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      track:{},
      playerStatus:{},
      discord:{},
      spotify:{},
      error: null,
    };
    this.playerClick = this.playerClick.bind(this);
  }

  playerClick(event) {
    fetch('./player', {
      method: 'POST',
      body: JSON.stringify({ action: event.target.name }),
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
    }).then((response) => response.json()).then((json) => {
      if (json.status === 'known') {
        this.setState((json.spotify) ? { discord:json.discord, spotify:json.spotify } : { discord:json.discord });
        this.setState({ playerStatus: json.player || {} });
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
        <TrackSmall track={this.state.track} />
        <button type="button" name="previous" onClick={this.playerClick}>Prev</button>
        <button type="button" name="next" onClick={this.playerClick}>Next</button>
        <QueueSmall queue={this.state.playerStatus} />
      </div>
    );
  }

}

function QueueSmall(props) {
  const queue = [];
  if (props?.queue?.tracks) {
    for (const [i, track] of props.queue.tracks.entries()) {
      queue.push(<TrackSmall track={track} key={i} />);
    }
  }
  return (
    <div className="Queue">
      {queue}
    </div>
  );
}

function UserBoxDiscord(props) {
  let content = null;
  if (Object.keys(props.user).length) {
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

function UserBoxSpotify(props) {
  let content = null;
  if (Object.keys(props.user).length) {
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

function ErrorDisplay(props) {
  if (props.error) {
    return <div className="Error">{props.error}</div>;
  } else { return null;}
}