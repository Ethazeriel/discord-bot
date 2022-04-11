import './App.css';
import React from 'react';
import { TrackSmall } from './trackdisplay.js';


export default class App extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      track:{},
      playerStatus:{},
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
    fetch('./tracks/goose-d316c88251', {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
    }).then((response) => response.json())
      .then((json) => {
        // console.log(json);
        this.setState({ track:json });
      })
      .catch((error) => {
        console.error(error);
      });
  }

  render() {
    return (
      <div className="App">
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