import * as React from 'react';
import './App.css';
import './tracks.css';

type Track = import('./types').track;

export default class TrackSmall extends React.Component<{track: Track}, void> {
  constructor(props: { track: Track}) {
    super(props);
    this.trackClick = this.trackClick.bind(this);
  }

  trackClick() {
    //
  }

  render() {
    if (Object.keys(this.props.track).length) {
      return (
        <div className="small">
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