import './App.css';
import React from 'react';
import { TrackSmall } from './trackdisplay.js';


export default class App extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      track:{},
    };
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
      </div>
    );
  }

}