import * as React from 'react';
import styled, { css } from 'styled-components';
import playButton from './media/placeholder/dark_play.png';
import removeButton from './media/placeholder/dark_remove.png';
import dragHandle from './media/placeholder/dark_drag.png';
import { timeDisplay } from './utils';

import './App.css';

import type { Track, PlayerClick } from './types';
type Action = 'jump' | 'remove' | 'move';
// type TrackMove = { from: DraggedTrack, to: DraggedTrack, target: -1 | 1 };

// yep, still haven't learned how to type this
function reducer(state:any, [type, value]:[any, any?]) {
  switch (type) {
    // case 'accepting': {
    //   console.log(`accepting to ${value}`);
    //   return ({ ...state, accepting: value });
    // }
    case 'origin': {
      return ({ ...state, origin: value });
    }
    case 'cleanup': {
      if (state.origin) {
        console.log('in origin, dispatching');
        dispatchEvent(new CustomEvent('cleanup'));
      }
      return ({ ... state, origin: false });
    }
    case 'adjacent': {
      return ({ ...state, adjacent: value });
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
  origin: boolean,
  adjacent: boolean,
  nearerTop: boolean,
  nearerBottom: boolean,
}

type DraggedTrack = {
  id: number,
  UUID: number,
  name: string,
}

export function TrackSmall(props: { playerClick:(action:PlayerClick) => void, track:Track, id:number }) {
  const initialState:DragState = {
    origin: false,
    adjacent: false,
    nearerTop: false,
    nearerBottom: false,
  };
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [state, dispatch] = React.useReducer(reducer, initialState);

  React.useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    // const windowDrop = (event:DragEvent): void => {
    //   console.log('why hello');
    // };
    // window.addEventListener('dragend', windowDrop);
    return (() => {
      // window.removeEventListener('dragend', windowDrop);
    });
  }, []);

  React.useEffect(() => {
    dispatch(['cleanup']);
    dispatch(['clear']);
  }, [props.id]);

  const trackClick = (action:Action, parameter:string | number = props.id) => { // I'm sorry
    props.playerClick({ action:action, parameter: parameter });
  };

  const dragStart = (event:React.DragEvent<HTMLDivElement>):void => {
    // console.log(`drag start for track: ${props.id + 1}`);
    // const cleanUp = ():void => {
    //   document.removeEventListener('cleanup', cleanUp);
    // };
    // document.addEventListener('cleanup', cleanUp);
    // event.currentTarget.style.color = '#f800e3';
    dispatch(['origin', true]);
    event.currentTarget.style.opacity = '0.4';
    event.dataTransfer.effectAllowed = 'copyMove';
    event.dataTransfer.clearData();
    const data:DraggedTrack = { id: props.id, UUID: props.track.goose.UUID!, name: props.track.goose.track.name };
    event.dataTransfer.setData('application/x-goose.track', `${JSON.stringify(data)}`);
    // event.dataTransfer.setData('text/plain', `${props.track.goose.artist.name} ${props.track.goose.track.name}`);
    // console.log(event);
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const dragEnd = (event:React.DragEvent<HTMLElement>):void => {
    console.log(event);
    // console.log(state.accepting);
    event.currentTarget.style.opacity = 'initial';
    if (event.dataTransfer.dropEffect === 'none') {
      console.log(`drag canceled for track: ${props.id + 1}`);
      dispatch(['clear']);
    } else {
      // console.log(`drag accepted for track: ${props.id + 1}`);
      // event.currentTarget.style.color = '#00b400';
    }
    // if (state.accepting) {
    //   dispatch(['accepting', false]);
    // }

    // } else if (state.accepting) {
    //   console.log(`drag accepted for track: ${props.id + 1}`);
    //   event.currentTarget.style.backgroundColor = 'green';
    // } else {
    //   console.log(`drag for track: ${props.id + 1} accepted outside app`);
    //   event.currentTarget.style.opacity = 'initial';
    //   dispatch(['clear']);
    // }
  };

  const dragEnter = (event:React.DragEvent<HTMLElement>):void => {
    if (event.dataTransfer.types.includes('application/x-goose.track')) {
      // console.log(`drag entered track: ${props.id + 1}`);
      event.preventDefault();
    }
  };

  const dragOver = (event:React.DragEvent<HTMLElement>):void => {
    if (event.dataTransfer.types.includes('application/x-goose.track')) {
      event.preventDefault();

      const halfway = event.currentTarget.clientHeight / 2;
      const distanceFromTop = event.pageY - event.currentTarget.offsetTop;
      const topIsNearer = distanceFromTop <= halfway;
      // console.log(`Y: ${event.pageY}, eventTop: ${event.currentTarget.offsetTop}, height: ${event.currentTarget.clientHeight} topIsNearer: ${topIsNearer}, track: ${props.id + 1}`);
      // console.log(`top: ${state.nearerTop}, isNearer: ${topIsNearer} -- bottom: ${state.nearerBottom}, not isNearer ${!topIsNearer}`);

      // if already in either position do nothing; I don't trust the reducer not to cause a rerender—yes I should maybe test that
      if ((!state.nearerTop && topIsNearer) || (!state.nearerBottom && !topIsNearer)) {
        dispatch(['set', topIsNearer]);
      }

      const from = JSON.parse(event.dataTransfer.getData('application/x-goose.track')) as DraggedTrack;
      // not the dragged item, not adjacent to it such that the insertion point is on the same side as it
      // if (!(props.id == from.id || state.nearerTop && props.id == (from.id + 1) || state.nearerBottom && props.id == (from.id - 1))) {
      //   event.preventDefault();
      //   console.log(`prop.id ${props.id} from.id ${from.id} nearerTop: ${state.nearerTop} nearerBottom: ${state.nearerBottom}`);
      //   console.log(`over :/ same: ${(props.id == from.id)} adj.below: ${(state.nearerTop && props.id == (from.id + 1))} adj.above: ${(state.nearerBottom && props.id == (from.id - 1))}`);
      // }
      const adjacent = (state.nearerBottom && props.id == (from.id - 1)) || (state.nearerTop && props.id == (from.id + 1));

      if ((!state.adjacent && adjacent) || state.adjacent && !adjacent) {
        dispatch(['adjacent', adjacent]);
      }
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const dragLeave = (event:React.DragEvent<HTMLElement>):void => {
    // console.log(`drag left track: ${props.id + 1}`);
    if (event.dataTransfer.types.includes('application/x-goose.track')) {
      if (event.pageY <= event.currentTarget.offsetTop || event.pageY >= event.currentTarget.offsetTop + event.currentTarget.clientHeight) {
        dispatch(['clear']);
        // if (state.accepting) {
        //   dispatch(['accepting', false]);
        // } else { console.log('murmle leave'); }
      }
    }
  };

  const drop = (event:React.DragEvent<HTMLElement>):void => {
    console.log(event);
    event.preventDefault();
    // event.stopPropagation(); // unsure if this is needed
    const from = JSON.parse(event.dataTransfer.getData('application/x-goose.track')) as DraggedTrack;
    if (state.adjacent || props.id == from.id) {
      // console.log('invalid; ignoring drop');
      if (state.origin) { dispatch(['origin', false]); }
      dispatch(['clear']);
    } else {
      // moving this out of a [state.nearerTop] check to handle concurrent modification. I think the UUID stuff
      // I've done should handle the list rearranging mid-drag, but depending on what gets moved where, I can't
      // rely on [props.id] changes to catch all but when [state.nearerTop]
      // also check that the list rearranging doesn't fail to do any dispatch(['clear]) cleanup mid-drag
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const cleanUp = ():void => {
        console.log('in cleanup callback');
        dispatch(['clear']);
        removeEventListener('cleanup', cleanUp);
      };
      addEventListener('cleanup', cleanUp);

      // basically how it reads; insert before else after
      const to = (state.nearerTop) ? props.id : props.id + 1;
      // if (to < 0) { to = 0; }
      trackClick('move', `${from.id} ${to} ${from.UUID}`); // I'm sorry
      console.log(`move track: [${from.id }] ${from.name} to: [${to}], ${state.nearerTop ? 'above' : 'below'} [${props.id}] ${props.track.goose.track.name}`);
    }
  };

  return (
    <TestContainer onDragStart={(event) => dragStart(event)} onDragEnd={(event) => dragEnd(event)} onDragEnter={(event) => dragEnter(event)} onDragOver={(event) => dragOver(event)} onDragLeave={(event) => dragLeave(event)} onDrop={(event) => drop(event)}>
      <Test visible={state.nearerTop} adjacent={state.adjacent} />
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
      <Test visible={state.nearerBottom} adjacent={state.adjacent} />
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
  adjacent: boolean,
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
  background-color: #f800e3;
  z-index: 1;
  visibility: hidden;
  user-select: none;
  pointer-events: none;
  ${(props) => {
    if (props.visible) {
      return css`
        visibility: visible;
      `;
    }
  }}
  ${(props) => {
    if (props.adjacent) {
      return css`
        opacity: 0.4;
      `;
    }
  }}
`;

/* ${(props) => {
    if (props.visible) {
      return css`
        visibility: visible;
      `;
    }
  }}
  ${(props) => {
    if (props.adjacent) {
      return css`
        background-color: '#e40fd2';
      `;
    }
  }} */

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