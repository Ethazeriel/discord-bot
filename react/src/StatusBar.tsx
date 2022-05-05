import * as React from 'react';
import styled from 'styled-components';
import type { User, PlayerStatus } from './types';
import discordLogo from './media/connections/discord/active.png';


type Status = {
  user: User
  player?: PlayerStatus
};

const Bar = styled.div`
background-color: #404347;
overflow: hidden;
width: 100%;
height: 4vh;
min-height: 20px;
display: flex;
align-items: center;
justify-content: center;
> div {
  max-height: 100%;
}
> div > img {
 height: 20px;
 width: auto; 
 display: inline;
 margin-right:4px;
}
`;

const Dauth = styled.a`
text-decoration: none;
color: #FFFFFF;
text-align: center;
font-size: 2vh;
&:hover { color: #5865f2; }
`;

const Duser = styled.p`
text-align: right;
font-size: 2vh;
margin: 0px;
display: inline-block;
`;

export function StatusBar(props: { status: Status }) {
  if (props?.status?.user?.status == 'new') {
    return (
      <Bar>
        <Dauth href='./oauth2?type=discord'>Please click here to link your discord account.</Dauth>
      </Bar>
    );
  } else {
    return (
      <Bar>
        <div>
          <img src={discordLogo} />
          <Duser>{props?.status?.user?.discord?.username}#{props?.status?.user?.discord?.discriminator}</Duser>
        </div>
      </Bar>
    );
  }
}