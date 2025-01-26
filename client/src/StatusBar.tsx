import * as React from 'react';
import styled from 'styled-components';
import { MediaControls } from './MediaControls';
import { Glass } from './components/GlassEffect';


type Status = {
  user: WebUser | { status:'new' }
  player?: PlayerStatus
};

const Bar = styled(Glass)`
position:fixed;
/* border-bottom: 2px solid #373839; */
overflow: visible;
width: 100%;
height: calc(6vh);
min-height: 20px;
max-height: 82px;
display: flex;
align-items: center;
justify-content: center;
pointer-events: none;
font-size: 2vh;
> div {
  max-height: 100%;
  width: 100%;
  flex: 2;
}
> div:first-of-type {
  text-align: left;
  padding-left:1em;
  flex: 1;
}
> div:last-child {
  text-align: right;
  padding-right:1em;
  flex: 1;
}
`;
const SpaceHolder = styled.div`
width: 100%;
height: calc(6vh + 3px);
min-height: 20px;
max-height: 82px;
background-color: #626569;
`;

const AuthLink = styled.a`
text-decoration: none;
color: #FFFFFF;
text-align: center;
&:hover { color: #5865f2; }
`;

const ConAccount = styled.p`
margin: 0px;
white-space: nowrap;
`;

const AlwaysVisible = styled.div`
position: absolute;
pointer-events: auto;
top: 0;
right: 0;
padding-right:1em;
z-index:3;
height: 6vh;
min-height: 20px;
max-height: 80px;
/* background-color: #242526; */
`;

const Connections = styled(Glass)`
position: absolute;
pointer-events: auto;
right:0px;
top:-10em;
overflow-y:visible;
width: fit-content;
max-width: 25vw;
min-height: 6em;
padding-right:1em;
padding-top:4em;
padding-left:1em;
padding-bottom:0.5em;
/* background-color: #242526; */
/* border-bottom: 2px solid #373839; */
border-left: 3px solid #373839;
z-index: -2;
//transform: translateY(100%);
transition: 0.25s transform;
&:hover,:focus-within {
  transform: translateY(9.5em);
}
${AlwaysVisible}:hover + & {
  transform: translateY(9.5em);
}
`;


export function StatusBar(props: { status: Status, playerClick:(action:PlayerAction<ActionType>) => void }) {
  if (props?.status?.user?.status == 'new') {
    return (
      <Bar>
        <AuthLink href={`${window.location.origin}/oauth2?type=discord`}>Please click here to link your discord account.</AuthLink>
      </Bar>
    );
  } else {
    return (
      <>
        <SpaceHolder />
        <Bar>
          <div><Clock /></div>
          <div><MediaControls status={props.status.player} playerClick={props.playerClick} type='bar' buttonSize='30px' /></div>
          <div>Current track: {props.status.player?.tracks[props.status.player?.playhead]?.goose?.track?.name || 'None'}</div>
          <div>{/* free real estate */}</div>
          <div>
            <AlwaysVisible>
              Connections ▼ <br />
              <ConLogo type='discord' active={(props?.status?.user?.discord?.username ? true : false)} />
              <ConLogo type='spotify' active={(props?.status?.user?.spotify?.username ? true : false)} />
              <ConLogo type='lastfm' active={(props?.status?.user?.lastfm?.username ? true : false)} />
              <ConLogo type='napster' active={(props?.status?.user?.napster?.username ? true : false)} />
            </AlwaysVisible>
            <Connections>
              <Account type='discord' user={props?.status?.user} />
              <Account type='spotify' user={props?.status?.user} />
              <Account type='lastfm' user={props?.status?.user} />
              <Account type='napster' user={props?.status?.user} />

            </Connections>
          </div>
        </Bar>
      </>
    );
  }
}

const LogoImg = styled.img`
height: 1.5vh;
width: auto; 
margin-right:4px;
`;
function ConLogo(props:{ type:'spotify' | 'discord' | 'napster' | 'lastfm', active:boolean }) {
  const loc = `/media/connections/${props.type}/${props.active}.png`;
  return (
    <>
      <LogoImg src={loc} />
    </>
  );
}

function Account(props:{ type:'spotify' | 'discord' | 'napster' | 'lastfm', user:WebUser}) {
  switch (props.type) {
    case 'spotify': {
      if (props.user?.spotify) {
        return (<ConAccount><ConLogo type='spotify' active={(props.user?.spotify?.username ? true : false)} />{props.user?.spotify?.username}</ConAccount>);
      } else {
        return (
          <div>
            <AuthLink href={`${window.location.origin}/oauth2?type=spotify`}><ConLogo type='spotify' active={(props.user?.spotify?.username ? true : false)} />Link Spotify</AuthLink>
          </div>
        );
      }
    }

    case 'lastfm': {
      if (props.user?.lastfm) {
        return (<ConAccount><ConLogo type='lastfm' active={(props.user?.lastfm?.username ? true : false)} />{props.user?.lastfm?.username}</ConAccount>);
      } else {
        return (
          <div>
            <AuthLink href={`${window.location.origin}/basicauth?type=lastfm`}><ConLogo type='lastfm' active={(props.user?.lastfm?.username ? true : false)} />Link LastFM</AuthLink>
          </div>
        );
      }
    }

    case 'napster': {
      if (props.user?.napster) {
        return (<ConAccount><ConLogo type='napster' active={(props.user?.napster?.username ? true : false)} />{props.user?.napster?.username}</ConAccount>);
      } else {
        return (
          <div>
            <AuthLink href={`${window.location.origin}/oauth2?type=napster`}><ConLogo type='napster' active={(props.user?.napster?.username ? true : false)} />Link Napster</AuthLink>
          </div>
        );
      }
    }

    case 'discord': { // don't need an if/else here as this should always be true
      return (
        <ConAccount><ConLogo type='discord' active={(props.user?.discord?.username ? true : false)} />{props.user?.discord?.username}#{props.user?.discord?.discriminator}</ConAccount>
      );
    }
  }
}

const Clockh2 = styled.h2`
font-family: 'Courier New', Courier, monospace;
margin:0px;
text-align: left;
align-items: center;
`;
function Clock() {
  const [time, setTime] = React.useState(new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
  const [tock, setTock] = React.useState(false);

  const tick = () => {
    if (tock) {
      setTime(new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
      setTock(false);
    } else {
      setTime(new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).replace(':', ' '));
      setTock(true);
    }
  };
  React.useEffect(() => {
    const timer = setInterval(() => tick(), 1000);
    return () => {clearInterval(timer);};
  });
  return (<Clockh2>{time}</Clockh2>);
}