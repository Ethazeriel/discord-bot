import { PropsWithChildren } from 'react';
import styled from 'styled-components';

const GlassStyle = styled.div`
  background: hsl(0deg 0% 0% / 0.1);
`;

const Backdrop = styled.span`
  position: absolute;
  inset: 0;
  height: 200%;
  width: 100%;
  backdrop-filter: blur(16px) brightness(75%) saturate(125%);
  mask-image: linear-gradient( to bottom, black 0% 50%, transparent 50% 100% );
  background: linear-gradient( to bottom, #2e3032 0% 0%, transparent 50%);
  pointer-events: none;
  z-index: -1;
`;

const BackdropEdge = styled.span`
  --thickness: 3px;
  position:absolute;
  inset: 0;
  height:100%;
  transform: translateY(100%);
  background: hsl(0deg 0% 30% / 0.3);
  backdrop-filter: blur(8px) brightness(120%) saturate(125%);
  pointer-events: none;
  mask-image: linear-gradient(
      to bottom,
      black 0,
      black var(--thickness),
      transparent var(--thickness)
    );
    z-index: -3;
`;

export function Glass({ className, children }:PropsWithChildren<{className?:string}>) {
  return (
    <GlassStyle className={className}>
      <Backdrop />
      <BackdropEdge />
      {children}
    </GlassStyle>
  );
}

// adapted (with great pain, I am not good at css) from https://www.joshwcomeau.com/css/backdrop-filter/
// I don't think the small amount of code here quite conveys how annoying this was to get working