export function timeDisplay(seconds:number) {
  let time = new Date(seconds * 1000).toISOString().substr(11, 8).replace(/^[0:]+/, '');
  switch (time.length) {
    case 0: time = `0${time}`;
    case 1: time = `0${time}`;
    case 2: time = `0:${time}`;
    default: return time;
  }
}