declare module '*.png';
declare module '*.jpg';
// declare module '*.svg';

declare module '*.svg' {
  import React from 'react';
  export const ReactComponent: React.FC<React.SVGProps<SVGSVGElement>>; // React.SVGProps<SVGSVGElement>
  const src: string;
  export default src;
}