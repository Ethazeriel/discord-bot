import { SimpleTrack } from '@/components/SimpleTrack';
import { useEffect, useState } from 'react';
import { FlatList, View } from 'react-native';

export function TrackList({ target }:{target:'player'}):React.JSX.Element | null
export function TrackList({ listname, target }:{listname:string, target:'playlist'|'spotify'}):React.JSX.Element | null
export function TrackList({ listname, target }:{listname?:string, target:string}):React.JSX.Element | null {
  const [sources, setSources] = useState<Array<Track>>([]);

  let url = '';
  switch (target) {
    case 'playlist': url = `http://172.16.12.119:2468/playlist/${listname}`; break;
    case 'player': url = 'http://172.16.12.119:2468/load'; break;
    case 'spotify': url = `http://172.16.12.119:2468/spotify-playlist/${listname}`; break;
  }
  // not sure I love this here, but here it is for now
  useEffect(() => {
    (async () => {
      const list = await fetch(url, { method: 'GET', credentials: 'include' });
      const json = await list.json();
      let result:Array<Track> = [];
      switch (target) {
        case 'playlist': result = json; break;
        case 'player': result = json.player?.tracks; break;
        case 'spotify': result = json; break;
      }
      setSources(result);
    })();
  }, [listname, target, url]);

  if (Object.keys(sources).length) {
    // console.log(JSON.stringify(sources, null, 2));
    const result = [];
    for (const [i, source] of sources.entries()) {
      // result.push(SimpleTrackFromTrack({source:source, id:i}));
      result.push({ source:source, i:i });
    }
    const renderItem = ({ item }:{item:{source:Track, i:number}}) => {
      return <SimpleTrack source={item.source} id={item.i} key={item.source.goose.UUID!}/>;
    };
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          width: 27000 // this is the wrong way to do this I think
        }}>
        <FlatList data={result} keyExtractor={item => item.source.goose.UUID!} renderItem={renderItem} />

      </View>
    );
  } else {
    return <></>;
  }
}

export async function LoadList() {
  try {
    const response = await fetch('http://172.16.12.119:2468/playlist/okay', { method: 'GET', credentials: 'include' });
    console.log(response);
    const json = await response.json();
    console.log(JSON.stringify(json, null, 2));
    return json;
  } catch (error) { console.error(error); }
}
