import * as React from 'react';
import styled from 'styled-components';
import type { User, PlayerStatus } from './types';

type Status = {
  user: User
  player?: PlayerStatus
};

const Bar = styled.div`
background-color: #404347;
overflow: visible;
width: 100%;
height: 6vh;
min-height: 20px;
display: flex;
align-items: center;
justify-content: center;
font-size: 2vh;
z-index: 0;
> div {
  max-height: 100%;
  width: 100%;
  flex: 1;
}
> div:first-child {
  text-align: left;
  padding-left:1em;
}
> div:last-child {
  text-align: right;
  padding-right:1em;
}
`;

const AuthLink = styled.a`
text-decoration: none;
color: #FFFFFF;
text-align: center;
font-size: 2vh;
&:hover { color: #5865f2; }
`;

const ConAccount = styled.p`
font-size: 2vh;
margin: 0px;
`;

const AlwaysVisible = styled.div`
position: absolute;
top: 0;
right: 0;
padding-right:1em;
z-index:3;
height: 6vh;
min-height: 20px;
`;

const Connections = styled.div`
position: absolute;
right:0px;
top:-3.5em;
overflow-y:visible;
width: fit-content;
min-height: 6em;
padding-right:1em;
padding-top:3.5em;
padding-left:1em;
padding-bottom:0.5em;
background-color: #404347;
z-index: -1;
//transform: translateY(100%);
transition: 0.2s transform;
&:hover,:focus-within {
  transform: translateY(3.5em);
}
${AlwaysVisible}:hover + & {
  transform: translateY(3.5em);
}
`;

export function StatusBar(props: { status: Status }) {
  if (props?.status?.user?.status == 'new') {
    return (
      <Bar>
        <AuthLink href='./oauth2?type=discord'>Please click here to link your discord account.</AuthLink>
      </Bar>
    );
  } else {
    return (
      <Bar>
        <div>text here about something</div>
        <div>player controls?</div>
        <div>
          <AlwaysVisible>
              Connections ▼ <br />
            <ConLogo type='discord' active={(props?.status?.user?.discord?.username ? true : false)} />
            <ConLogo type='spotify' active={(props?.status?.user?.spotify?.username ? true : false)} />
          </AlwaysVisible>
          <Connections>
            <Account type='discord' user={props?.status?.user} />
            <Account type='spotify' user={props?.status?.user} />

          </Connections>
        </div>
      </Bar>
    );
  }
}

const LogoImg = styled.img`
height: 1.5vh;
width: auto; 
margin-right:4px;
`;
function ConLogo(props:{ type:'spotify' | 'discord', active:boolean }) {
  const loc = `${process.env.PUBLIC_URL}/media/connections/${props.type}/${props.active}.png`;
  return (
    <>
      <LogoImg src={loc} />
    </>
  );
}

function Account(props:{ type:'spotify' | 'discord', user:User}) {
  switch (props.type) {
  case 'spotify': {
    if (props.user?.spotify) {
      return (
        <ConAccount><ConLogo type='spotify' active={(props.user?.spotify?.username ? true : false)} />{props.user?.spotify?.username}</ConAccount>

      );
    } else {
      return (
        <div>
          <AuthLink href='./oauth2?type=spotify'><ConLogo type='spotify' active={(props.user?.spotify?.username ? true : false)} />Link Spotify</AuthLink>
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