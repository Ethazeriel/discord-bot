/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useEffect, useReducer, useState, useMemo } from 'react';
import styled from 'styled-components';
import { timeDisplay } from './utils';

import { ReactComponent as Shuffle } from './media/placeholder/shuffle.svg';
import { ReactComponent as Prev } from './media/placeholder/prev.svg';
import { ReactComponent as Play } from './media/placeholder/play.svg';
import { ReactComponent as Pause } from './media/placeholder/pause.svg';
import { ReactComponent as Next } from './media/placeholder/next.svg';
import { ReactComponent as Loop } from './media/placeholder/loop.svg';

import type { Track, PlayerStatus, PlayerClick } from './types';
type Action = 'prev' | 'togglePause' | 'next' | 'shuffle' | 'toggleLoop' | 'seek';
type MediaState = {
  seek:number,
  start:number,
  elapsed:number,
  duration:number,
  paused:boolean,
  loop:boolean,
  seeking:number,
};

// I have no idea how to type this. will figure it out later
function reducer(state:any, [type, value]:[any, any?]) {
  switch (type) {
    case 'interval': {
      const elapsed = (state.seek) ? state.seek : (state.paused) ? state.elapsed : (state.elapsed + 1 <= state.duration) ? state.elapsed + 1 : state.elapsed;
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
  }
}

export function MediaBar(props: { status?:PlayerStatus, playerClick:(action:PlayerClick) => void}) {
  const player = props.status;
  const track = player?.tracks?.[player?.playhead];

  const now = Math.floor(Date.now() / 1000);
  const seek = Math.floor(track?.status?.seek || 0);
  const pause = Math.floor(track?.status?.pause || 0);
  const start = Math.floor(track?.status?.start || now);

  const paused = player?.paused as boolean;
  const elapsed = (paused) ? pause - start : now - start;
  const duration = track?.youtube[0]?.duration || 0;

  const initialState:MediaState = {
    seek: seek,
    start: start,
    elapsed: elapsed,
    duration: duration,
    paused: paused,
    loop: player?.loop || false,
    seeking: 0,
  };
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    const timer = window.setInterval(() => {
      dispatch(['interval']);
    }, 1000);

    return (() => clearInterval(timer));
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
    props.playerClick({ action: action });
  };

  const slider = ([type, value]:any) => {
    if (type == 'seek') { props.playerClick({ action: 'seek', parameter: state.seeking }); }
    dispatch([type, Number(value || state.seeking)]); // onMouseUp doesn't seem to have a value
  };

  return (
    <MediaContainer>
      <ButtonRow>
        <Button onClick={() => button('shuffle')}><Shuffle /></Button>
        <Button onClick={() => button('prev')}><Prev /></Button>
        <Button onClick={() => button('togglePause')}>{(state.paused) ? <Play /> : <Pause />}</Button>
        <Button onClick={() => button('next')}><Next /></Button>
        <Button onClick={() => button('toggleLoop')}><Loop /></Button>
      </ButtonRow>
      <SliderRow>
        <TimeStyle>{timeDisplay(state.seeking || state.elapsed)}</TimeStyle>
        <SliderStyle type="range" min="0" max={state.duration} step="1" value={state.seeking || state.elapsed} onChange={(event) => slider(['slider', event.target.value])} onMouseUp={(event) => slider(['seek'])} />
        <TimeStyle>{timeDisplay(state.duration)}</TimeStyle>
      </SliderRow>
    </MediaContainer>
  );
}

const MediaContainer = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: visible;
`;

const ButtonRow = styled.div`
  height: 36px;
  margin: 4px 0 0 0;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
`;

const Button = styled.svg`
  width: 36px;
  height: 36px;
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
  height: 100%;
  width: 200px;
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