import './App.css';
import React from 'react';
import { TrackSmall } from './trackdisplay.js';
import clientconfig from './clientconfig.json';


export default class App extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      track:{},
      playerStatus:{},
      user:{},
      stateId:'notgeneratedyet',
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
    }).then((response) => response.json())
      .then((json) => {
        // console.log(json);
        this.setState({ playerStatus:json.status });
      })
      .catch((error) => {
        console.error(error);
      });
  }

  componentDidMount() {
    fetch('./loaduser', {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    }).then((response) => response.json())
      .then((json) => {
        if (json.status === 'known') {
          this.setState({ user:json });
        } else if (json.status === 'new') {
          this.setState({ stateId:json.id });
        } else {
          this.setState({ error:'unexpected loaduser response' });
        }
        // console.log(json);
      })
      .catch((error) => {
        console.error(error);
      });
  }

  render() {
    return (
      <div className="App">
        <ErrorDisplay error={this.state.error} />
        <UserBox user={this.state.user} stateId={this.state.stateId} />
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

function UserBox(props) {
  let content = null;
  if (Object.keys(props.user).length) {
    content = <p>{props.user.username}#{props.user.discriminator}</p>;
  } else {
    const authLink = `https://discord.com/oauth2/authorize?client_id=${clientconfig.discord.client_id}&redirect_uri=${clientconfig.discord.redirect_uri}&state=${props.stateId}&response_type=code&scope=identify%20email%20connections%20guilds%20guilds.members.read`;
    content = <a href={authLink}>Login with discord</a>;
  }
  return (
    <div className="UserBox">
      {content}
    </div>
  );
}

function ErrorDisplay(props) {
  if (props.error) {
    return <div className="Error">{props.error}</div>;
  } else { return null;}
}