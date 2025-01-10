import * as React from 'react';
import styled, { css } from 'styled-components';

import playButton from './media/placeholder/dark_play.png';
import removeButton from './media/placeholder/dark_remove.png';
import dragHandle from './media/placeholder/dark_drag.png';
import dragImage from './media/placeholder/dragImage.png';

import { timeDisplay, allowExternal, allowedExternalTypes } from './utils';

import './App.css';

import { ActionType, PlayerAction } from './@types/webclient';
type Action = 'jump' | 'remove' | 'move' | 'pendingIndex';

// yep, still haven't learned how to type this
function reducer(state:any, [type, value]:[any, any?]) {
  switch (type) {
    case 'origin': { // unset on bad drop, bad end. should otherwise stay set until state.origin && !state.dragging in cleanup
      return ({ ...state, origin: value });
    }
    case 'dragging': { // set in start, unset on end. unnecessarily unset on bad drop, I think. check later
      return ({ ...state, dragging: value });
    }
    case 'cleanup': {
      if (state.origin && !state.dragging) {
        // console.log('dispatching cleanup');
        dispatchEvent(new CustomEvent('cleanup'));
        return ({ ...state, origin: false });
      }
      return ({ ...state });
    }
    case 'id': {
      if (state.origin && state.dragging) {
        // console.log('dispatching id');
        dispatchEvent(new CustomEvent('dragid', { detail: value }));
      }
      return ({ ...state }); // too tired, but I think this has been working without a return. thought that gave me an error before? check later
    }
    case 'invalid': {
      return ({ ...state, invalid: value });
    }
    case 'set': {
      return ({ ...state, nearerTop: value, nearerBottom: !value });
    }
    case 'clear': {
      if (value) { console.log(`clearing for ${value}`); }
      return ({ ...state, nearerTop: false, nearerBottom: false, invalid: false });
    }
  }
}

type DragState = {
  origin: boolean,
  invalid: boolean,
  dragging: boolean,
  nearerTop: boolean,
  nearerBottom: boolean,
}

export type DraggedTrack = {
  UUID: string,
  name: string,
}

export function TrackSmall(props: { id:number, track:Track, playerClick:(action:PlayerAction<ActionType>) => void, dragID:number|null, cursorText:React.Dispatch<[any, any?]> }) {
  const initialState:DragState = {
    origin: false,
    dragging: false,
    invalid: false,
    nearerTop: false,
    nearerBottom: false,
  };
  // console.log('track happening');

  const [state, dispatch] = React.useReducer(reducer, initialState);
  const [allowed, setAllowed] = React.useState<boolean | null>(null);

  const shouldAllow = (event:React.DragEvent<HTMLElement>, internal:boolean) => {
    if (allowed !== null) { return allowed; }
    let allow = internal;
    allow ||= allowExternal(event);
    if (allow) { setAllowed(allow); }
    return allow;
  };

  React.useEffect(() => {
    dispatch(['id', props.id]);
    dispatch(['cleanup']);
    dispatch(['clear']);
  }, [props.id]);

  // React.useEffect(() => {
  //   console.log(`track change: ${props.track.goose.track.name} ${props.track.goose.artist.name}`);
  // }, [props.track.goose.track, props.track.goose.artist]);

  // hook confusion for later
  // const cursorText = React.useMemo(() => props.cursorText, [props.cursorText]);
  // const label = React.useMemo(() => {
  //   console.log(`id ${props.id}, track ${props.track.goose.track.name}`);
  //   return { trackName: props.track.goose.track.name, artistName: props.track.goose.artist.name };
  // }, [props.id, props.track]);
  // React.useEffect(() => {
  //   cursorText(['label', `${label.trackName}●${label.artistName}`]);
  // }, [cursorText, label]);

  const trackClick = (action:Action, parameter:string | number = props.id) => {
    props.playerClick({ action:action, parameter: parameter });
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  // needs a better name. is intended to be called by event; exists to connect cancelled drops to what was last
  // dragged over, and as part of insertion marks persisting until server response, where the id useEffect and
  // clear handle all-but dropping "above" something because it's id never changes. may have once had a purpose
  // in drop; probably no harm in its unregistering listeners after a bad drop, though there shouldn't be any
  const cleanUp = ():void => {
    // console.log('cleanup callback');
    dispatch(['clear']);
    removeEventListener('cleanup', cleanUp);
  };

  // needs a better name. shared by dragEnd and drop for cancelled and accepted but invalid drops
  const rejectDrop = () => {
    // console.log('invalid; ignoring drop');
    dispatch(['clear']);
    if (state.origin) { dispatch(['origin', false]); }
    if (state.dragging) { dispatch(['dragging', false]); }
    dispatchEvent(new CustomEvent('cleanup'));
    dispatchEvent(new CustomEvent('dragid', { detail: null }));
    // ^ precaution against bad ID in dragOver if it fires faster than the ID dispatched in start updates,
    // that needs otherwise to be treated preferentially to handle concurrent updates
  };

  const drag_image = React.useMemo(() => {
    const img = document.createElement('img');
    img.src = `${dragImage}`;
    return img;
  }, []);

  const dragStart = (event:React.DragEvent<HTMLElement>) => {
    dispatch(['origin', true]);
    dispatch(['dragging', true]);
    dispatch(['invalid', true]);
    dispatchEvent(new CustomEvent('dragid', { detail: props.id }));
    props.cursorText(['label', `${props.track.goose.track.name}●${props.track.goose.artist.name}`]);
    props.cursorText(['position', { x: event.pageX, y: event.pageY }]);
    props.cursorText(['visible', true]);
    event.dataTransfer.setDragImage(drag_image, 0, 0);
    event.dataTransfer.effectAllowed = 'copyMove';
    event.dataTransfer.clearData();
    const data:DraggedTrack = { UUID: props.track.goose.UUID!, name: props.track.goose.track.name };
    // event.dataTransfer.setData('text/plain', `${props.track.goose.artist.name} ${props.track.goose.track.name}`);
    event.dataTransfer.setData('application/x-goose.track', `${JSON.stringify(data)}`);
    event.currentTarget.style.opacity = '0.4';
  };

  const dragEnd = (event:React.DragEvent<HTMLElement>) => {
    event.currentTarget.style.opacity = 'initial';
    props.cursorText(['visible', false]);
    if (event.dataTransfer.dropEffect === 'none') { // app-origin, cancel
      // console.log(`drag canceled for track: ${props.id + 1}`);
      // rejectDrop(); // leave should handle this for all origins now
    } else { // app-origin, success
      // console.log(`drag accepted for track: ${props.id + 1}`);
      dispatch(['dragging', false]);
    }
  };

  const dragEnter = (event:React.DragEvent<HTMLElement>) => {
    event.stopPropagation();
    // console.log('track handler—enter');
    // console.log(`drag entered track: ${props.id + 1}`);
    const internal = event.dataTransfer.types.includes('application/x-goose.track');
    if (allowed || shouldAllow(event, internal)) {
      event.preventDefault();
      // addEventListener('cleanup', cleanUp);
      event.dataTransfer.dropEffect = (internal) ? 'move' : 'copy';
      event.dataTransfer.effectAllowed = (internal) ? 'move' : 'copy';
    }
  };

  const dragOver = (event:React.DragEvent<HTMLElement>) => {
    // console.log(`drag over track: ${props.id + 1}`);

    const internal = event.dataTransfer.types.includes('application/x-goose.track');
    if (allowed || shouldAllow(event, internal)) {
      event.preventDefault();
      event.dataTransfer.dropEffect = (internal) ? 'move' : 'copy';
      event.dataTransfer.effectAllowed = (internal) ? 'move' : 'copy';
      const halfway = event.currentTarget.clientHeight / 2;
      const distanceFromTop = event.pageY - event.currentTarget.offsetTop;
      const nearerTop = distanceFromTop <= halfway;

      // if not nearerTop but should be     or not nearerBottom but should be—set
      if ((!state.nearerTop && nearerTop) || (!state.nearerBottom && !nearerTop)) {
        dispatch(['set', nearerTop]);
      }

      if (!internal) { return; }

      let invalid = false;
      if (props.dragID !== null) {
        invalid = props.id === props.dragID;
        invalid ||= (nearerTop && props.id === (props.dragID + 1)) || (!nearerTop && props.id === (props.dragID - 1));
      }

      // if not invalid but should be  or invalid but should not be—toggle
      if ((!state.invalid && invalid) || state.invalid && !invalid) {
        dispatch(['invalid', invalid]);
      }
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const dragLeave = (event:React.DragEvent<HTMLElement>) => {
    event.stopPropagation();
    setAllowed(null);
    // console.log('track handler—leave');
    const internal = event.dataTransfer.types.includes('application/x-goose.track');
    if (internal || allowExternal(event)) {
      // removeEventListener('cleanup', cleanUp);
      // if (event.pageY <= event.currentTarget.offsetTop || event.pageY >= event.currentTarget.offsetTop + event.currentTarget.clientHeight ||
      //     event.pageX >= event.currentTarget.clientWidth) {
      //   dispatch(['clear']);
      // }
      dispatch(['clear']);
    }
  };

  const drop = (event:React.DragEvent<HTMLElement>) => {
    // console.log(event);
    event.preventDefault();
    event.stopPropagation();
    setAllowed(null);

    const internal = event.dataTransfer.types.includes('application/x-goose.track');
    const externalTypes:string[] = (!internal) ? allowedExternalTypes(event) : [];

    if (internal) {
      const from = JSON.parse(event.dataTransfer.getData('application/x-goose.track')) as DraggedTrack;
      if (props.dragID === undefined || state.invalid || props.track.goose.UUID == from.UUID) {
        rejectDrop();
      } else {
        addEventListener('cleanup', cleanUp);
        // basically how it reads; insert before else after
        const to = (state.nearerTop) ? props.id : props.id + 1;
        trackClick('move', `${props.dragID} ${to} ${from.UUID}`); // I'm sorry
        console.log(`move track: [${props.dragID}] ${from.name} to: [${to}], ${state.nearerTop ? 'above' : 'below'} [${props.id}] ${props.track.goose.track.name}`);
      }
    } else if (externalTypes.length) {
      // console.log(`external accepted: ${externalTypes}`);
      addEventListener('cleanup', cleanUp);
      const to = (state.nearerTop) ? props.id : props.id + 1;
      trackClick('pendingIndex', `${to} ${externalTypes[0]}`);
      console.log(`queue resource ${externalTypes} at position ${to}`);
    } else if (externalTypes.length === 0) {
      const types = event.dataTransfer.types.map(type => `\nkey: ${type},\n\tvalue: ${event.dataTransfer.getData(type)}`).toString();
      console.log(`track external—no valid types in: ${types}`);
      rejectDrop();
    } else {
      const types = event.dataTransfer.types.map(type => `\nkey: ${type},\n\tvalue: ${event.dataTransfer.getData(type)}`).toString();
      console.log(`track—no valid types in: ${types}`);
      rejectDrop();
    }
  };
  return (
    <Wrapper $name={props.track.goose.track.name}>
      <InsertionMarker visible={state.nearerTop} invalid={state.invalid} />
      <TrackStyle onDragStart={dragStart} onDragEnd={dragEnd} onDragEnter={dragEnter} onDragOver={dragOver} onDragLeave={dragLeave} onDrop={drop}>
        <Art src={props.track.goose.track.art} alt="album art" crossOrigin='anonymous' draggable="false" />
        <ButtonContainer>
          <Button src={playButton} onClick={() => trackClick('jump')} draggable="false" />
          <Number>{(props.id + 1)}</Number>
          <Button src={removeButton} onClick={() => trackClick('remove')} draggable="false" />
        </ButtonContainer>
        <Handle src={dragHandle} draggable="true" />
        <Details>
          <Title>{props.track.goose.track.name}</Title>
          <AlbumInfo>{props.track.goose.artist.name} - <em>{props.track.goose.album.name}</em></AlbumInfo>
        </Details>
        <Duration>{timeDisplay(props.track.goose.track.duration)}</Duration>
      </TrackStyle>
      <InsertionMarker visible={state.nearerBottom} invalid={state.invalid} />
    </Wrapper>
  );
}

const TrackStyle = styled.div`
  display: flex;
  height: 8vh;
  align-items: center;
  width:100%;
`;

const Wrapper = styled.div<{ $name?:string; }>`
  display: flex;
  flex-direction: column;
  background-color: ${props => (
    (props.$name === 'PENDING') ? '#172417' : (props.$name === 'FAILED') ? '#241717' : '#242627'
  ) };
  &:nth-child(even) {background-color: ${props => (
    (props.$name === 'PENDING') ? '#1f301f' : (props.$name === 'FAILED') ? '#311f1f' : '#292b2c'
  ) };}
  &:hover {background-color: #303233;}
`;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const InsertionMarker = styled.span<{ visible: boolean, invalid: boolean }>`
  display: block;
  height: 2px;
  width: 100%;
  margin-top: -1px;
  margin-bottom: -1px;
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
    if (props.invalid) {
      return css`
        opacity: 0.4;
      `;
    }
  }}
`;

const Art = styled.img`
  height: auto;
  width: 6.4vh;
  margin-left: 0.8vh;
  margin-right: 0.5em;
  pointer-events: none;
`;

const ButtonContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  pointer-events: none;
`;

const Button = styled.img`
  width: auto;
  height: 2vh;
  visibility: hidden;
  ${TrackStyle}:hover & {
    visibility: visible;
    pointer-events: auto;
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
  pointer-events: none;
`;

const Details = styled.div`
  margin: 0px;
  width: 30vw;
  text-align: left;
  overflow: hidden;
  text-overflow: clip;
  white-space: nowrap;
  user-select: none;
  pointer-events: none;
`;

const Title = styled.h2`
  margin: 0px;
  font-weight: normal;
  font-size: 2vh;
  user-select: none;
  pointer-events: none;
`;

const AlbumInfo = styled.p` // was Artist
  margin: 0px;
  font-size: 1.5vh;
  user-select: none;
  pointer-events: none;
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
  pointer-events: none;
`;