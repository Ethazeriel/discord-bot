// declare type DOMEvent<E extends React.Event, T extends Element> = E & { readonly target: T; }
// declare type DOMEvent<E extends React.Event> = E & { readonly target: Element; }

// interface CustomEventMap {
//   "numberEvent": CustomEvent<number>;
// }

// declare global {
//   interface Document {
//     // addEventListener<K extends keyof CustomEventMap>(type: K,
//     //   listener: (this: Document, ev: CustomEventMap[K]) => any,
//     //   options?: boolean | AddEventListenerOptions): void;
//     // // removeEventListener<K extends keyof CustomEventMap>(type: K,
//     // //   listener:)
//     // removeEventListener<K extends keyof CustomEventMap>(type: K,
//     //   listener: (this: Document, ev: CustomEventMap[K]) => any,
//     //   options?: boolean | EventListenerOptions): void;
//     // dispatchEvent<K extends keyof CustomEventMap>(ev: CustomEventMap[K]): void;
//   }
// }

// export { };