import './App.css';
import * as React from 'react';

// standard disallows reading values of external types mid-drag; can only match keys
const allowExternal = (event:React.DragEvent<HTMLElement>):boolean => { // used on dragOver event
  return true; // comment out to play with tests below
  const index = event.dataTransfer.types.findIndex((type) => typeof type === 'string'); // && dragPattern.test(type)
  return (index !== -1);
};

// see https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API/Recommended_drag_types
const allowedExternalTypes = (event:React.DragEvent<HTMLElement>) => { // used on drop event
  return event.dataTransfer.types; // comment out to play with tests below
  const allowed = event.dataTransfer.types.filter((type) => typeof type === 'string') // && dragPattern.test(type)
    .map((type) => event.dataTransfer.getData(type))
    .filter((type) => type); // anything truthy will be included, in this case using the key itself
    // spotifyPattern.test(type) || subsonicPattern.test(type)

  return (allowed);
};

export function DropCheck() {
  const [allowed, setAllowed] = React.useState<boolean | null>(null);
  const dropStyle = React.useRef<HTMLDivElement>(null);

  const shouldAllow = (event:React.DragEvent<HTMLElement>, internal:boolean) => {
    if (allowed !== null) {
      return allowed;
    }
    let allow = internal;
    allow ||= allowExternal(event);
    if (allow) { setAllowed(allow); }
    // console.log(`should ${allow}`);
    return allow;
  };

  const clearStyling = () => {
    if (dropStyle.current) {
      dropStyle.current.style.border = 'unset';
      dropStyle.current.style.opacity = 'unset';
    }
  };

  const rejectDrop = () => {
    dispatchEvent(new CustomEvent('cleanup'));
    dispatchEvent(new CustomEvent('dragid', { detail: null }));
  };

  const dragEnd = (event:React.DragEvent<HTMLElement>) => {
    event.currentTarget.style.opacity = 'initial';
    if (event.dataTransfer.dropEffect === 'none') {
      // app-origin, cancel
    } else {
      // app-origin, success
    }
  };

  const dragEnter = (event:React.DragEvent<HTMLElement>) => {
    if (!dropStyle.current) { return; } // not mounted; shouldn't be (possible to be) here

    const internal = event.dataTransfer.types.includes('application/x-goose.track');
    if (internal) {
      //
    }

    if (internal || shouldAllow(event, internal)) {
      event.preventDefault();
      event.dataTransfer.dropEffect = (internal) ? 'move' : 'copy';
      event.dataTransfer.effectAllowed = (internal) ? 'move' : 'copy';
      dropStyle.current.style.border = '2px solid #f800e3';
    }
  };

  const dragOver = (event:React.DragEvent<HTMLElement>) => {
    const internal = event.dataTransfer.types.includes('application/x-goose.track');
    if (internal) {
      //
    }

    if (allowed || shouldAllow(event, internal)) {
      event.preventDefault();
    }
  };

  const dragLeave = (event:React.DragEvent<HTMLElement>) => {
    setAllowed(null);
    if (event.currentTarget === event.target) {
      clearStyling();
    }
  };

  const drop = (event:React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setAllowed(null);

    // can/should vary by case (see PlayerQueue and TrackSmall for examples), but here generically the goal is just output
    clearStyling();
    rejectDrop();

    const internal = event.dataTransfer.types.includes('application/x-goose.track');
    const externalTypes:readonly string[] = (!internal) ? allowedExternalTypes(event) : [];
    const types = event.dataTransfer.types.map(type => `\nkey: ${type},\n\tvalue: ${event.dataTransfer.getData(type)}`).toString();

    // emphasis that I'm using externalTypes here only to see if the filters in place (if any, default extremely permissive) are allowing anything through
    // but outputting all types for, hopefully, the convenience of seeing them when tweaking filters. consider printing/comparing externalTypes as needed
    if (internal) {
      // const value = JSON.parse(event.dataTransfer.getData('application/key-set-in-dragStart')) as TypeDefinition; // example; see TrackSmall dragStart
      console.log(`drop check—internal. types: ${types}`);
    } else if (externalTypes.length) {
      console.log(`drop check—allowed external. types: ${types}`);
    } else if (externalTypes.length === 0) {
      console.log(`drop check—disallowed external. no valid types in: ${types}`);
    } else {
      console.log(`drop check—no valid types in: ${types}`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div className='dropzone' ref={dropStyle} style={{ flexGrow: 1, marginTop: '-1px' }} onDragEnd={dragEnd} onDragEnter={dragEnter} onDragOver={dragOver} onDragLeave={dragLeave} onDrop={drop} />
    </div>
  );
}