import React from 'react';
// import type * as CSS from 'csstype';
import styled from 'styled-components';
// import { timeDisplay } from './utils';

import { ReactComponent as Play } from './media/placeholder/play.svg';
// import { ReactComponent as Pause } from './media/placeholder/pause.svg';
import { ReactComponent as Prev } from './media/placeholder/prev.svg';
import { ReactComponent as Next } from './media/placeholder/next.svg';
import { ReactComponent as Shuffle } from './media/placeholder/shuffle.svg';
import { ReactComponent as Loop } from './media/placeholder/loop.svg';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { Track, PlayerClick } from './types';
type Action = 'prev' | 'togglePause' | 'next' | 'shuffle' | 'toggleLoop' | 'seek';

// declare module 'csstype' {
//   interface Properties {
//     value?: undefined;
//   }
// }

// import './Test.css';

export class MediaBar extends React.Component<{playerClick:(a: PlayerClick) => void}, { value: number }> {
  constructor(props: {playerClick:(a: PlayerClick) => void}) { // , track: Track;
    super(props);
    this.state = {
      value: 52.5,
    };
    this.mediaClick = this.mediaClick.bind(this);
    this.sliderClick = this.sliderClick.bind(this);
  }

  mediaClick(action: Action) {
    this.props.playerClick({ action: action });
  }

  sliderClick(event:any) {
    this.setState({ value: event.target.value });
  }

  render() {
    return (
      <Bar>
        <Controls>
          <Button onClick={() => this.mediaClick('shuffle')}><Shuffle /></Button>
          <Button onClick={() => this.mediaClick('prev')}><Prev /></Button>
          <Button onClick={() => this.mediaClick('togglePause')}><Play /></Button>
          <Button onClick={() => this.mediaClick('next')}><Next /></Button>
          <Button onClick={() => this.mediaClick('toggleLoop')}><Loop /></Button>
        </Controls>
        <div><Slider type="range" min="0" max="100" step="0.5" value={this.state.value} onChange={(event) => this.sliderClick(event)} /></div>
      </Bar>
    );
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const Bar = styled.div`
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

const Controls = styled.div`
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const Button = styled.svg.attrs({
  version: '1.1',
  xmlns: 'http://www.w3.org/2000/svg',
})`
  width: 48px;
  height: 48px;
  margin: 0 2px 0 2px;
  color: #e736e7;
  &:hover {
    color: #fc28ce;
  }
`;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const Slider = styled.input`
  height: 100%;
  width: 220px;
  margin: 0;
  padding: 0;
  object-fit: contain;
  display: block;

  accent-color: #e736e7;
  &:hover {
    accent-color: #e736c1;
  }
`;