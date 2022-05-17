import * as React from 'react';
import styled from 'styled-components';
import playButton from './media/placeholder/dark_play.png';
import removeButton from './media/placeholder/dark_remove.png';

import './App.css';

import type { Track, PlayerClick } from './types';
type Action = 'jump' | 'remove';

function timeDisplay(seconds:number) {
  let time = new Date(seconds * 1000).toISOString().substr(11, 8).replace(/^[0:]+/, '');
  switch (time.length) {
    case 0: time = `0${time}`;
    case 1: time = `0${time}`;
    case 2: time = `0:${time}`;
    default: return time;
  }
}

export class TrackSmall extends React.Component<{playerClick:(a: PlayerClick) => void, track: Track, id: number}, never> {
  constructor(props: {playerClick:(a: PlayerClick) => void, track: Track, id: number}) {
    super(props);
    this.trackClick = this.trackClick.bind(this);
  }

  trackClick(action: Action) {
    this.props.playerClick({ action:action, parameter: this.props.id });
  }

  render() {
    if (Object.keys(this.props.track).length) {
      return (
        <TrackStyle>
          <Art src={this.props.track?.spotify?.art || this.props.track?.youtube?.art} alt="album art" crossOrigin='anonymous'/>
          <ButtonContainer>
            <Button src={playButton} onClick={() => this.trackClick('jump')} />
            <Number>{(this.props.id + 1)}</Number>
            <Button src={removeButton} onClick={() => this.trackClick('remove')} />
          </ButtonContainer>
          <Details>
            <Title>{this.props.track?.spotify?.name || this.props.track?.youtube?.name}</Title>
            <AlbumInfo>{this.props.track?.artist?.name} - <em>{this.props.track?.album?.name}</em></AlbumInfo>
          </Details>
          <Duration>{timeDisplay(this.props.track?.youtube?.duration)}</Duration>
        </TrackStyle>
      );
    } else {return null;}
  }
}

const TrackStyle = styled.div`
  display: flex;
  height: 8vh;
  align-items: center;
  background-color: #242627;
  &:nth-child(even) {background-color: #292b2c;}
  &:hover {background-color: #303233;}
`;

const Art = styled.img`
  height: auto;
  width: 6.4vh;
  margin-left: 0.8vh;
  margin-right: 0.5em;
`;

const ButtonContainer = styled.div`
  margin-right: 0.5em;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const Button = styled.img`
  width: auto;
  height: 2vh;
  visibility: hidden;
  ${TrackStyle}:hover & {
    visibility: visible;
  }
`;

const Number = styled.p`
  margin: 0px;
  text-align: left;
  font-size: 2vh;
  font-style: italic;
`;

const Details = styled.div`
  margin: 0px;
  width: 30vw;
  text-align: left;
  overflow: hidden;
  text-overflow: clip;
  white-space: nowrap;
`;

const Title = styled.h2`
  margin: 0px;
  font-weight: normal;
  font-size: 2vh;
`;

const AlbumInfo = styled.p` // was Artist
  margin: 0px;
  font-size: 1.5vh;
`;

// const Album = styled.p`
//   margin: 0px;
//   font-size: 1.5vh;
//   font-style: italic;
//   display: inline;
// `;

const Duration = styled.p`
  margin: 0px;
  text-align: right;
  font-size: 2vh;
  font-style: italic;
`;