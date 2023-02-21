import * as React from 'react';
import styled, { css } from 'styled-components';

import playButton from './media/placeholder/dark_play.png';
import removeButton from './media/placeholder/dark_remove.png';
import dragHandle from './media/placeholder/dark_drag.png';
import dragImage from './media/placeholder/dragImage.png';

import { timeDisplay, allowExternal, allowedExternalTypes } from './utils';

import './App.css';

import type { Track, PlayerClick } from './types';
type Action = 'jump' | 'remove' | 'move' | 'queue';

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
        dispatchEvent(new CustomEvent('dragset', { detail: value }));
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

type DraggedTrack = {
  UUID: string,
  name: string,
}

export function TrackSmall(props: { id:number, track:Track, playerClick:(action:PlayerClick) => void, dragID:number|null, cursorText:React.Dispatch<[any, any?]> }) {
  const initialState:DragState = {
    origin: false,
    dragging: false,
    invalid: false,
    nearerTop: false,
    nearerBottom: false,
  };

  const [state, dispatch] = React.useReducer(reducer, initialState);

  React.useEffect(() => {
    dispatch(['id', props.id]);
    dispatch(['cleanup']);
    dispatch(['clear']);
  }, [props.id]);

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
    dispatchEvent(new CustomEvent('dragset', { detail: null }));
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
    dispatchEvent(new CustomEvent('dragset', { detail: props.id }));
    props.cursorText(['label', `${props.track.goose.track.name}●${props.track.goose.artist.name}`]);
    props.cursorText(['position', { x: event.pageX, y: event.pageY }]);
    props.cursorText(['visible', true]);
    event.dataTransfer.setDragImage(drag_image, 0, 0);
    event.dataTransfer.effectAllowed = 'copyMove';
    event.dataTransfer.clearData();
    const data:DraggedTrack = { UUID: props.track.goose.UUID!, name: props.track.goose.track.name };
    event.dataTransfer.setData('application/x-goose.track', `${JSON.stringify(data)}`);
    event.currentTarget.style.opacity = '0.4';

    // can't "successfully" drag out of the window if nothing accepts your custom and only type
    // event.dataTransfer.setData('text/plain', `${props.track.goose.artist.name} ${props.track.goose.track.name}`);
  };

  const dragEnd = (event:React.DragEvent<HTMLElement>) => {
    event.currentTarget.style.opacity = 'initial';
    props.cursorText(['visible', false]);
    if (event.dataTransfer.dropEffect === 'none') {
      // console.log(`drag canceled for track: ${props.id + 1}`);
      rejectDrop();
    } else {
      // console.log(`drag accepted for track: ${props.id + 1}`);
      dispatch(['dragging', false]);
    }
  };

  const dragEnter = (event:React.DragEvent<HTMLElement>) => {
    console.log('enter');
    // console.log(`drag entered track: ${props.id + 1}`);
    const internal = event.dataTransfer.types.includes('application/x-goose.track');
    if (internal || allowExternal(event)) {
      event.preventDefault();
      addEventListener('cleanup', cleanUp);
      event.dataTransfer.dropEffect = (internal) ? 'move' : 'copy';
      event.dataTransfer.effectAllowed = (internal) ? 'move' : 'copy';
    }
  };

  const dragOver = (event:React.DragEvent<HTMLElement>) => {
    // console.log(`drag over track: ${props.id + 1}`);

    const internal = event.dataTransfer.types.includes('application/x-goose.track');
    if (internal || allowExternal(event)) {
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

      // if (!internal) { return; }

      let invalid = false;
      if (props.dragID !== null) {
        invalid = props.id === props.dragID;
        invalid ||= (state.nearerTop && props.id === (props.dragID + 1)) || (state.nearerBottom && props.id === (props.dragID - 1));
      }

      // if not invalid but should be  or invalid but should not be—toggle
      if ((!state.invalid && invalid) || state.invalid && !invalid) {
        dispatch(['invalid', invalid]);
      }
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const dragLeave = (event:React.DragEvent<HTMLElement>) => {
    console.log('leave');
    const internal = event.dataTransfer.types.includes('application/x-goose.track');
    if (internal || allowExternal(event)) {
      removeEventListener('cleanup', cleanUp);
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
      console.log(`external accepted: ${externalTypes}`);
      addEventListener('cleanup', cleanUp);
      const to = (state.nearerTop) ? props.id : props.id + 1;
      trackClick('queue', `${to} ${externalTypes[0]}`);
      console.log(`queue resource ${externalTypes} at position ${to}`);
    } else if (externalTypes.length === 0) {
      console.log('no valid external types');
      rejectDrop();
    } else {
      rejectDrop();
    }
  };

  return (
    <TestContainer>
      <Test visible={state.nearerTop} invalid={state.invalid} />
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
        <Duration>{timeDisplay(props.track?.youtube[0]?.duration)}</Duration>
      </TrackStyle>
      <Test visible={state.nearerBottom} invalid={state.invalid} />
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
  invalid: boolean,
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

// for future me and anyone else,
// there doesn't seem to be any obvious, built-in way for dragEnd and drop to talk to each other. which seems odd,
// especially since dragEnd can't tell if the drop was in or out of app, and that's extremely important for styling.
// event order is inconsistent too; like enter firing before leave—and all in the same update cycle (or whatever)—
// even if drop fires first, anything it dispatches to the reducer still won't have updated when dragEnd fires, and
// the event is undefined the moment it's out of scope; takes more work than a lazy/ bad sleep callback, anyway
//
// a related annoyance is that whether a drop is accepted depends on calling preventDefault in both enter and over.
// that might be for cross-browser compatibility or other reasons—drops can be accepted by calling it only in over.
// it is also possible to (very carefully) trigger enter without over, and so should do both.
//
// as far as drag and drop is concerned, a drop is only formally canceled if preventDefault hasn't been called and a
// drop happens; that's when dropEffect == 'none'. if preventDefault is called, that's a valid drop. so it's unideal
// that these don't work well with a reducer either; both leak 1 invalid on their first firing. this is almost easily
// solved—move the adjacency logic into a function they can share, still use the reducer for future firings of over,
// and return the value for immediate use to not leak invalids. the real problem though is enter is only called once
// and you're at least /supposed/ to accept or reject the drop (even if only doing it on over seems to work). either
// the entire element is valid or nah; splitting it like I've done with "above" and "below" is apparently wrong
//
// I wish I remembered—there was some reason I didn't go that route, some problem that was more than knowing I was
// supposed to preventDefault in both events. maybe I'm wrong now about whether it works when done in only over
//
// partly it was a holdover from forgetting to test components/ css behavior during the mouseEvent pass; I assumed the
// WebQueue updating and potentially literally moving every track would reset its styling. using the reducer to clear
// styling was a bandaid when it all stuck around.
//
// somehow this collided with dragEnd not being able to tell the difference between a "success" and an actual success,
// various attempts at canceling properly, improperly and differently, and not knowing how to connect these better, an
// easy choice between starting over with a guess at a redesign that might do drops "properly"—and making this work.
//
// I forget the details, but the choices were all basically between favoring dragEnd or drop, with no easy way to
// do both. I could persist the style on the origin for the fraction of a second the server needed to respond, leaving
// styling in place on "success" that was an offscreen drop, canceling styling that was actually successful, being less
// able to clean up styling elsewhere, not having insertion marks on adjacency as a consequence of my not knowing this
// sooner——or I could just have consistent insertion marks, clean up all almost all styling (see custom cleanup event),
// and just ignore drops that I didn't want to be drops. the only loss was the "moving" styling on the origin, which
// I'll figure out with refs or something later
//
// there might be more, but I'm half asleep and this is at least enough before it's gone to help me remember in future.
// hopefully. —have been removing the discarded/ set aside portions of this below from my editing process, and having
// arrived back at this event.dataTransfer line I started this comment to explain a good while ago.. right so
//
// again I forget exactly, but that's gone because you can't "successfully" do a drop outside of the window when the
// only mime type is a custom one that nothing supports. which reminds me also, here toward the very last I had another
// read of the MDN page. I'm not sure if I forgot dropEffects or removed them somewhere along the way, but re-reading:
//
//  > use the value none to indicate that no drop is allowed at this location [...] within the drop and dragend events,
//  > check the dropEffect property to determine which effect was ultimately chosen
//
// extremely funny that one of my problems was trying to gatekeep preventDefault, when just setting dropEffect to none
// depending on adjacency might have worked——have checked, it cancels despite preventDefault, but drop isn't called..
// not sure what I'm missing there. anyway, something to experiment with when I get back around to redoing this