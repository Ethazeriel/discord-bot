import * as React from 'react';
import './App.css';
import './tracks.css';

import type { Track, PlayerClick } from './types';

export class TrackSmall extends React.Component<{playerClick:(a: PlayerClick) => void, track: Track, id: number}, never> {
  constructor(props: {playerClick:(a: PlayerClick) => void, track: Track, id: number}) {
    super(props);
    this.trackClick = this.trackClick.bind(this);
  }

  trackClick() {
    this.props.playerClick({ action: 'jump', parameter: this.props.id });
  }

  render() {
    if (Object.keys(this.props.track).length) {
      return (
        <div className="small" onClick = {this.trackClick}>
          <img src={this.props.track?.spotify?.art || this.props.track?.youtube?.art} className="smallArt" alt="Track album art" />
          <div>
            <h2>{this.props.track?.spotify?.name || this.props.track?.youtube?.name}</h2>
            <p>{this.props.track?.artist?.name} - {this.props.track?.album?.name}</p>
          </div>
        </div>
      );
    } else {return null;}
  }
}