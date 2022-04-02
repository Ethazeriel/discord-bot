import React from 'react';
import './App.css';
import './tracks.css';

export function TrackSmall(props) {
  if (Object.keys(props.track).length) {
    return (
      <div className="small">
        <img src={props.track?.spotify?.art || props.track?.youtube?.art} className="smallArt" alt="Track album art" />
        <div>
          <h2>{props.track?.spotify?.name || props.track?.youtube?.name}</h2>
          <p>{props.track?.artist?.name} - {props.track?.album?.name}</p>
        </div>
      </div>
    );
  } else {return null;}
}