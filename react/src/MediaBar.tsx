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
  const seek = props.status?.tracks?.[props.status?.playhead]?.goose?.seek;
  const start = props.status?.tracks?.[props.status?.playhead]?.start;
  const duration = props.status?.tracks?.[props.status?.playhead]?.youtube?.duration || 0;
  const paused = props.status?.paused as boolean;
  const now = Date.now() / 1000;
  const [timer, setTimer] = useState(0);
  const [value, setValue] = useState((start) ? (now - start) : (seek) ? (now - seek) : 0);
  useEffect(() => {
    console.log(`seek: ${Math.trunc(seek || 0)}, start: ${Math.trunc(start || 0)}, duration: ${duration}, paused: ${paused}`);
    if (paused) {
      // clearInterval(timer);
    } else if (seek) {
      // clearInterval(timer);
      // setValue(seek);
    } else if (start) {
      // setTimer(oldTimer => {
      //   return (window.setInterval(() => {
      //     if ((value + 1) < duration) {
      //       setValue(oldValue => oldValue + 1);
      //     } else {
      //       // setValue(duration);
      //       // clearInterval(timer);
      //     }
      //   }, 1000));
      // });
    } else { /* clearInterval(timer); */ }

    return (() => clearInterval(timer));
  }, [start, seek, paused]);
  //
  // useEffect(() => {
  //   if (start && !paused) {
  //     console.log(`start, timerID: ${timer}`);
  //     clearInterval(timer);
  //     setTimer(oldTimer => {
  //       return (window.setInterval(() => {
  //         if ((value + 1) < duration) {
  //           setValue(oldValue => oldValue + 1);
  //         } else {
  //           setValue(duration);
  //           clearInterval(timer);
  //         }
  //       }, 1000));
  //     });
  //     console.log(`start, timerID: ${timer}`);
  //   } else { clearInterval(timer); }
  //   return (() => clearInterval(timer));
  // }, [start]);
  // useEffect(() => {
  //   if (seek) {
  //     clearInterval(timer);
  //     setValue(seek);
  //   }
  // }, [seek]);
  // useEffect(() => {
  //   if (paused) {
  //     console.log(`paused, timerID: ${timer}`);
  //     clearInterval(timer);
  //     console.log(`paused, timerID: ${timer}`);
  //   }
  // }, [paused]);

  const interaction = (action:string) => {
    props.playerClick({ action: action });
  };
  const sliderChange = (event:any) => {
    // clearInterval(timer);
    setValue(event.target.value);
  };
  const sliderTest = (event:any) => {
    props.playerClick({ action: 'seek', parameter: value });
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
        <TimeStyle>{timeDisplay((value) ? value : 0)}</TimeStyle>
        <SliderStyle type="range" min="0" max={duration} step="0.5" value={value} onChange={sliderChange} onMouseUp={sliderTest} />
        <TimeStyle>{timeDisplay(duration)}</TimeStyle>
      </SliderRow>
    </MediaContainer>
  ); // // <TimeElapsed status={props.status!} />
} // <SliderStyle type="range" min="0" max="100" step="0.5" value={props.value} onChange={(event) => props.sliderClick(event)} />
// <Slider value={value} sliderClick={sliderTesting} />
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
function Slider(props:{ value:number, sliderClick:(event:any) => void }) {
  return (<SliderStyle type="range" min="0" max="100" step="0.5" value={props.value} onChange={(event) => props.sliderClick(event)} />);
} // <Slider type="range" min="0" max="100" step="0.5" value={(value && duration) ? (value / duration) : 0} onChange={(event) => this.sliderClick(event)} />

const TimeStyle = styled.span`
  
`;
// function TimeElapsed(props:{ status:PlayerStatus }) {
//   let timer: ReturnType<typeof setInterval>; // oh no
//   const [time, setTime] = React.useState(((Date.now() / 1000) - (props.status?.tracks?.[props.status?.playhead]?.start!)) || 0);
//   const tick = () => {
//     if (props.status && props.status?.tracks?.[props.status?.playhead]?.start! && time < props.status.tracks![props.status.playhead]!.youtube.duration) {
//       console.log('tick time');
//       setTime(prevTime => (prevTime + 1));
//     } else {
//       console.log('tick clear');
//       clearInterval(timer);
//     }
//   };
//   useEffect(() => {
//     if (props.status?.paused) {
//       console.log('paused. clearing timer');
//       clearInterval(timer);
//     } else {
//       console.log('unpaused. refreshing timer');
//       timer = setInterval(() => tick(), 1000);
//     }
//     return (() => {
//       console.log('cleanup');
//       clearInterval(timer);
//     });
//   }, [props.status?.paused]);
//   useEffect(() => {
//     if (!props.status?.tracks?.[props.status?.playhead]?.start!) {
//       setTime(0);
//     }
//   }, [props.status?.tracks?.[props.status?.playhead]?.start!]);
//   if (!props.status || !props.status?.tracks?.[props.status?.playhead]?.start!) {
//     return (<TimeStyle>{timeDisplay(0)}</TimeStyle>);
//   } else {
//     return (<TimeStyle>{timeDisplay(time)}</TimeStyle>);
//   }
// }