import * as React from 'react';
import styled, { css } from 'styled-components';
import playButton from './media/placeholder/dark_play.png';
import removeButton from './media/placeholder/dark_remove.png';
import dragHandle from './media/placeholder/dark_drag.png';
import { timeDisplay } from './utils';

import './App.css';

import type { Track, PlayerClick } from './types';
type Action = 'jump' | 'remove';

function reducer(state:any, [type, value]:[any, any?]) {
  switch (type) {
    case 'topY': {
      return ({ ...state, topY: value });
    }
    case 'drag': {
      return ({ ...state, dragging: value });
    }
    case 'set': {
      return ({ ...state, nearerTop: value, nearerBottom: !value });
    }
    case 'clear': {
      return ({ ...state, nearerTop: false, nearerBottom: false });
    }
  }
}

type DragState = {
  topY: number,
  dragging: boolean,
  nearerTop: boolean,
  nearerBottom: boolean,
}

export function TrackSmall(props: { playerClick:(action:PlayerClick) => void, track:Track, id:number }) {
  const initialState:DragState = {
    topY: 0,
    dragging: false,
    nearerTop: false,
    nearerBottom: false,
  };
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [state, dispatch] = React.useReducer(reducer, initialState);

  React.useEffect(() => {
    // const windowDrop = (event:DragEvent): void => {
    //   console.log('why hello');
    // };
    // window.addEventListener('dragend', windowDrop);
    return (() => {
      // window.removeEventListener('dragend', windowDrop);
    });
  }, []);

  const trackClick = (action:Action) => {
    props.playerClick({ action:action, parameter: props.id });
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const mouseMove = (event:any):void => {
    const halfway = event.currentTarget.clientHeight / 2;
    const distanceFromTop = event.pageY - event.currentTarget.offsetTop;
    const topIsNearer = distanceFromTop <= halfway;
    // console.log(`Y: ${event.pageY}, eventTop: ${event.currentTarget.offsetTop}, height: ${event.currentTarget.clientHeight} topIsNearer: ${topIsNearer}, track: ${props.id + 1}`);
    // console.log(`top: ${state.nearerTop}, isNearer: ${topIsNearer} -- bottom: ${state.nearerBottom}, not isNearer ${!topIsNearer}`);

    // if already in either position do nothing; because I don't trust the spread in the reducer not to cause a rerender—yes I should maybe test that
    if ((!state.nearerTop && topIsNearer) || (!state.nearerBottom && !topIsNearer)) {
      dispatch(['set', topIsNearer]);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const mouseLeave = (event:any):void => {
    // console.log(`left track: ${props.id + 1}`);
    dispatch(['clear']);
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const mouseEnter = (event:any):void => {
    // console.log(`entered track: ${props.id + 1}`);
  };

  return (
    <TestContainer onMouseMove={(event) => mouseMove(event)} onMouseLeave={(event) => mouseLeave(event)} onMouseEnter={(event) => mouseEnter(event)}>
      <Test visible={state.nearerTop}/>
      <TrackStyle>
        <Art src={props.track.goose.track.art} alt="album art" crossOrigin='anonymous'/>
        <ButtonContainer>
          <Button src={playButton} onClick={() => trackClick('jump')} />
          <Number>{(props.id + 1)}</Number>
          <Button src={removeButton} onClick={() => trackClick('remove')} />
        </ButtonContainer>
        <Handle src={dragHandle} draggable="true" />
        <Details>
          <Title>{props.track.goose.track.name}</Title>
          <AlbumInfo>{props.track.goose.artist.name} - <em>{props.track.goose.album.name}</em></AlbumInfo>
        </Details>
        <Duration>{timeDisplay(props.track?.youtube[0]?.duration)}</Duration>
      </TrackStyle>
      <Test visible={state.nearerBottom}/>
    </TestContainer>
  );
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

type TestProps = {
  visible: boolean,
}

const TestContainer = styled.div`
  display: flex;
  flex-direction: column;
`;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const Test = styled.span<TestProps>`
  display: block;
  height: 4px;
  width: 100%;
  margin-top: -2px;
  margin-bottom: -2px;
  background-color: #00b400;
  z-index: 1;
  visibility: hidden;
  ${(props) => {
    if (props.visible) {
      return css`
        visibility: visible;
      `;
    }
  }}
`;

const Art = styled.img`
  height: auto;
  width: 6.4vh;
  margin-left: 0.8vh;
  margin-right: 0.5em;
`;

const ButtonContainer = styled.div`
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

const Handle = styled(Button)`
  margin-left: 0.25em;
  margin-right: 0.5em;
  height: 6vh;
  :hover {
    cursor: grab;
  }
`; // moved margin-right from ButtonContainer to lazily fix spacing while trying to see if this works at all

const Number = styled.p`
  margin: 0px;
  text-align: left;
  font-size: 2vh;
  font-style: italic;
  user-select: none;
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
  user-select: none;
`;