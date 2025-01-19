// eslint-disable-next-line spaced-comment
/// <reference types="vite-plugin-svgr/client" />
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useEffect, useReducer, useState, useMemo } from 'react';
import styled from 'styled-components';
import { timeDisplay } from './utils';

import Shuffle from './media/placeholder/shuffle.svg?react';
import Prev from './media/placeholder/prev.svg?react';
import Play from './media/placeholder/play.svg?react';
import Pause from './media/placeholder/pause.svg?react';
import Next from './media/placeholder/next.svg?react';
import Loop from './media/placeholder/loop.svg?react';
import SlowMode from './media/placeholder/slowmode.png';


type Action = 'prev' | 'togglePause' | 'next' | 'shuffle' | 'toggleLoop' | 'seek' | 'slowmode';
type MediaState = {
  seek:number,
  start:number,
  elapsed:number,
  duration:number,
  paused:boolean,
  loop:boolean,
  seeking:number,
  cancel:boolean,
};

// I have no idea how to type this. will figure it out later
function reducer(state:MediaState, [type, value]:[any, any?]) {
  switch (type) {
    case 'interval': {
      const elapsed = (state.seek) ? state.seek : (state.paused) ? state.elapsed : (state.elapsed + 1 <= state.duration) ? state.elapsed + 1 : state.elapsed;
      // console.log(timeDisplay(elapsed));
      return ({ ...state, elapsed: elapsed });
    }
    case 'duration': {
      return ({ ...state, duration: value });
    }
    case 'slider': {
      return ({ ...state, seeking: value });
    }
    case 'seek': {
      return ({ ...state, seek: value, elapsed: value, seeking: 0 });
    }
    case 'start': {
      const elapsed = (state.paused) ? state.elapsed : Math.floor((Date.now() / 1000) - value);
      return ({ ...state, seek: 0, elapsed: elapsed });
    }
    case 'paused': {
      return ({ ...state, paused: value });
    }
    case 'cancel': {
      if (value && state.seeking) {
        console.log('accepting cancel');
        return ({ ...state, cancel: true, seeking: 0 });
      } else if (value) {
        console.log('ignoring cancel');
        return ({ ...state });
      } else {
        console.log('slider released—cancel reset');
        return ({ ...state, cancel: false });
      }

      /*
      probably changes could/should be made so that this could just be
        if (state.seeking) { ... } else { ...state, cancel: false }

      the issue I'm resolving is needing to ignore multiple cancel:true's independent of the
      value in state.seeking. with only mouseUp's cancel:false changing the value. longer form:

      nothing I'm doing nor preventDefault (can?) emit a mouseUp, and probably they shouldn't.

      whether seeking is falsy controls the value in the elapsed timeDisplay, which value the
      slider uses, /and/ at the same time determines if there is a seek in progress
      (and if cancel:false, the seek target on release)

      zeroing seeking communicates the cancel by reverting the display elements, but also means
      that a seek is not in progress. cancel:true is retained to enforce the event handling

      because cancel may be pressed multiple times, and includes multiple presses registering
      if it's held too long. and bcause seeking will be 0 after the first cancel, if repeated
      calls set cancel to false, the slider event handling breaks, often(?) seeking to 0

      the else also can't be cancel:value, becaused pressing to cancel when not seeking blocks
      the slider from working until attempted, failed, released and reattempted. ORing these
      values fails as in the previous sentence, ANDing them fails as above.

      while I could resolve some of this by having input/release set another variable, which
      could be checked here, it still wouldn't help that I'm unsure how to better interlink/
      cancel multiple, separate events.

      [also TODO: make cancel:true effect css styling]
      */
    }
    default: {
      return ({ ...state });
    }
  }
}

export function MediaControls(props: { status?:PlayerStatus, playerClick:(action:PlayerAction<ActionType>) => void, type:'bar'|'buttons'|'slider', buttonSize?:string}) {
  const player = props.status;
  const track = player?.tracks?.[player?.playhead];

  const now = Math.floor(Date.now() / 1000);
  const seek = Math.floor(track?.status?.seek || 0);
  const pause = Math.floor(track?.status?.pause || 0);
  const start = Math.floor(track?.status?.start || now);

  const paused = player?.paused as boolean;
  const elapsed = (paused) ? pause - start : now - start;
  const duration = track ? track.goose.track.duration : 0;

  const initialState:MediaState = {
    seek: seek,
    start: start,
    elapsed: elapsed,
    duration: duration,
    paused: paused,
    loop: player?.loop || false,
    seeking: 0,
    cancel: false,
  };
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    const timer = window.setInterval(() => {
      dispatch(['interval']);
    }, 1000);
    const keyDown = (event:KeyboardEvent): void => {
      if (event.key === 'Escape') { dispatch(['cancel', true]); }
    };
    window.addEventListener('keydown', keyDown);

    return (() => {
      clearInterval(timer);
      window.removeEventListener('keydown', keyDown);
    });
  }, []);

  useEffect(() => {
    dispatch(['start', start]);
  }, [start]);

  useEffect(() => {
    dispatch(['paused', paused]);
  }, [paused]);

  useEffect(() => {
    dispatch(['duration', duration]);
  }, [duration]);

  const button = (action:Action) => {
    props.playerClick({ action:action, parameter:undefined });
  };

  const sliderSlide = (event:React.ChangeEvent<HTMLInputElement>) => {
    if (!state.cancel) {
      dispatch(['slider', event.target.value]);
    } else { /* event.preventDefault(); */ }
  };

  const sliderRelease = (event:React.MouseEvent<HTMLInputElement, MouseEvent>) => {
    if (!state.cancel) {
      props.playerClick({ action: 'seek', parameter: state.seeking });
      dispatch(['seek', state.seeking]);
    } else {
      // event.preventDefault();
      dispatch(['cancel', false]);
    }
  };
  const buttonDisplay = (
    <ButtonRow $size={props.buttonSize}>
      <Button $size={props.buttonSize} onClick={() => button('shuffle')}><Shuffle /></Button>
      <Button $size={props.buttonSize} onClick={() => button('prev')}><Prev /></Button>
      <Button $size={props.buttonSize} onClick={() => button('togglePause')}>{(state.paused) ? <Play /> : <Pause />}</Button>
      <Button $size={props.buttonSize} onClick={() => button('next')}><Next /></Button>
      <Button $size={props.buttonSize} onClick={() => button('toggleLoop')}><Loop /></Button>
      <img src={SlowMode} height={props.buttonSize} width={props.buttonSize} onClick={() => button('slowmode')} />
    </ButtonRow>
  );
  const sliderDisplay = (
    <SliderRow>
      <TimeStyle>{timeDisplay(state.seeking || state.elapsed)}</TimeStyle>
      <SliderStyle type="range" min="0" max={state.duration} step="1" value={state.seeking || state.elapsed} onChange={(event) => sliderSlide(event)} onMouseUp={(event) => sliderRelease(event)} />
      <TimeStyle>{timeDisplay(state.duration)}</TimeStyle>
    </SliderRow>
  );
  switch (props.type) {
    case 'buttons':
      return buttonDisplay;
    case 'slider':
      return sliderDisplay;
    case 'bar':
      return (
        <MediaContainer>
          {buttonDisplay}
          {sliderDisplay}
        </MediaContainer>
      );
  }
}

const MediaContainer = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: visible;
`;

const ButtonRow = styled.div<{ $size?:string }>`
  height: ${props => props.$size || 36}px;
  margin: 4px 0 0 0;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
`;

const Button = styled.svg<{ $size?:string }>`
  pointer-events: auto;
  width: ${props => props.$size || '36px'};
  height: ${props => props.$size || '36ps'};
  margin: 0 2px 0 2px;
  color: #e736e7;
  &:hover {
    color: #fc28ce;
  }
`;

const SliderRow = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
`;

const SliderStyle = styled.input`
  pointer-events: auto;
  height: 100%;
  width: 240px;
  margin: 0;
  padding: 0;
  object-fit: contain;
  display: inline;

  accent-color: #e736e7;
  &:hover {
    accent-color: #e736c1;
  }
`;

const TimeStyle = styled.span`
  font-family: 'Courier New', Courier, monospace;
`;