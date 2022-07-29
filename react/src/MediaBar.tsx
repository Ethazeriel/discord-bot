/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useEffect, useState } from 'react';
// import type * as CSS from 'csstype';
import styled from 'styled-components';
import { timeDisplay } from './utils';

import { ReactComponent as Shuffle } from './media/placeholder/shuffle.svg';
import { ReactComponent as Prev } from './media/placeholder/prev.svg';
import { ReactComponent as Play } from './media/placeholder/play.svg';
// import { ReactComponent as Pause } from './media/placeholder/pause.svg';
import { ReactComponent as Next } from './media/placeholder/next.svg';
import { ReactComponent as Loop } from './media/placeholder/loop.svg';


import type { Track, PlayerStatus, PlayerClick } from './types';
type Action = 'prev' | 'togglePause' | 'next' | 'shuffle' | 'toggleLoop' | 'seek';

// declare module 'csstype' {
//   interface Properties {
//     value?: undefined;
//   }
// }

// import './Test.css';

export function MediaBar(props: { status?:PlayerStatus, playerClick:(action:PlayerClick) => void}) {
  const seek = props.status?.tracks?.[props.status?.playhead]?.status?.seek;
  const start = props.status?.tracks?.[props.status?.playhead]?.status?.start;
  const duration = props.status?.tracks?.[props.status?.playhead]?.youtube[0]?.duration || 0;
  const paused = props.status?.paused as boolean;
  // eslint-disable-next-line prefer-const
  const [wtf, setwtf] = useState(50);
  const [now, setNow] = useState(Date.now() / 1000);
  const [seeking, setSeeking] = useState(0);
  const [timer, setTimer] = useState(0);
  const [playhead, setPlayhead] = useState((start) ? (now - start) : (seek) ? (now - seek) : 0);
  useEffect(() => {
    console.log(`seek: ${Math.trunc(seek || 0)}, start: ${Math.trunc(start || 0)}, duration: ${duration}, paused: ${paused}`);
    if (paused) {
      // clearInterval(timer);
    } else if (seek) {
      // clearInterval(timer);
      // setValue(seek);
    } else if (start) {
      setNow(oldValue => Date.now() / 1000);
      setPlayhead(oldValue => now - start);
      setTimer(oldTimer => {
        clearInterval(oldTimer);
        return (window.setInterval(() => {
          if ((playhead + 1) < duration) {
            setwtf(oldValue => oldValue + 1);
            setPlayhead(oldValue => oldValue + 1);
          } else {
            setPlayhead(duration);
          }
        }, 1000));
      });
    } else { /* clearInterval(timer); */ }

    return (() => clearInterval(timer));
  }, [start, seek, paused]);

  const interaction = (action:string) => {
    props.playerClick({ action: action });
  };
  const sliderChange = (event:any) => {
    // clearInterval(timer);
    setSeeking(event.target.value);
  };
  const sliderTest = (event:any) => {
    console.log(`mouseup pre: ${seeking}`);
    setSeeking(oldValue => 0);
    console.log(`mouseup post: ${seeking}`);
    // props.playerClick({ action: 'seek', parameter: target });
  };
  return (
    <MediaContainer>
      <ButtonRow>
        <Button onClick={() => interaction('shuffle')}><Shuffle /></Button>
        <Button onClick={() => interaction('prev')}><Prev /></Button>
        <Button onClick={() => interaction('togglePause')}><Play /></Button>
        <Button onClick={() => interaction('next')}><Next /></Button>
        <Button onClick={() => interaction('toggleLoop')}><Loop /></Button>
      </ButtonRow>
      <SliderRow>
        <div>seeking= {seeking}</div>
        <TimeStyle>{timeDisplay(seeking || wtf)}</TimeStyle>
        <SliderStyle type="range" min="0" max={duration} step="1" value={seeking || wtf} onChange={sliderChange} onMouseUp={sliderTest} />
        <TimeStyle>{timeDisplay(duration)}</TimeStyle>
      </SliderRow>
    </MediaContainer>
  );
}

const getCircularReplacer = () => {
  const seen = new WeakSet();
  return (key: any, value: object | null) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return;
      }
      seen.add(value);
    }
    return value;
  };
};

const MediaContainer = styled.div`
  position: relative;
  width: 100%;
  height: calc(10vh + 2px);
  min-height: 20x;
  max-height: 100px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: visible;
`;

const ButtonRow = styled.div`
  height: 54px;
  margin: 4px 0 0 0;
  padding-top: 2px;
  /* min-width: 320px;
  max-width: 640px;
  min-height: 64px;
  max-height: 128px; */
  position: relative;
  display: block flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
`;

const Button = styled.svg`
  width: 48px;
  height: 48px;
  margin: 0 2px 0 2px;
  color: #e736e7;
  &:hover {
    color: #fc28ce;
  }
`;

const SliderRow = styled.div`
`;

const SliderStyle = styled.input`
  height: 100%;
  width: 220px;
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
  
`;