import * as React from 'react';
import styled from 'styled-components';
import { timeDisplay } from './utils';


export function BasicTrack(props:{track:Track, id:number}) {
  if (Object.keys(props.track).length) {
    return (
      <TrackStyle>
        <Art src={props.track?.goose.track.art} alt="album art" crossOrigin='anonymous'/>
        <ButtonContainer>
          <Number>{(props.id + 1)}</Number>
        </ButtonContainer>
        <Details>
          <Title>{props.track?.goose.track.name}</Title>
          <AlbumInfo>{props.track?.goose?.artist?.name} - <em>{props.track?.goose?.album?.name}</em></AlbumInfo>
        </Details>
        <Duration>{timeDisplay(props.track?.goose?.track?.duration)}</Duration>
      </TrackStyle>
    );
  } else {return null;}
}

export function SourceAsTrack(props:{source:TrackSource, id:number}) {
  if (Object.keys(props.source).length) {
    return (
      <TrackStyle>
        <Art src={props.source.art} alt="album art" crossOrigin='anonymous'/>
        <ButtonContainer>
          <Number>{(props.id + 1)}</Number>
        </ButtonContainer>
        <Details>
          <Title>{props.source.name}</Title>
          <AlbumInfo>{props.source.artist.name} - <em>{props.source.album.name}</em></AlbumInfo>
        </Details>
        <Duration>{timeDisplay(props.source.duration)}</Duration>
      </TrackStyle>
    );
  } else {return null;}
}

const TrackStyle = styled.div`
  display: flex;
  height: 8vh;
  align-items: center;
  background-color: #242627;
  &:nth-child(even) {background-color: #292b2c;}
  &:hover {background-color: #303233;}
  width:100%;
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