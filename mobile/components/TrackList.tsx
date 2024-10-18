import { SimpleTrack } from "@/components/SimpleTrack";
import { useEffect, useState } from "react";
import { FlatList, View } from 'react-native';

export function TrackList({listname}:{listname:String}) {
  const [sources, setSources] = useState<Array<Track>>([]);

  useEffect(() => {
    const getList = (async () => {
      const list = await fetch(`http://172.16.12.119:2468/playlist/${listname}`, { method: 'GET', credentials: 'include' });
      const json = await list.json();
      setSources(json);
    })();
  }, []);

  if (Object.keys(sources).length) {
    // console.log(JSON.stringify(sources, null, 2));
    const result = []
    for (const [i, source] of sources.entries()) {
      // result.push(SimpleTrackFromTrack({source:source, id:i}));
      result.push({source:source, i:i})
    }
    const renderItem = ({item}:{item:{source:Track, i:number}}) => {
      return <SimpleTrack source={item.source} id={item.i} key={item.source.goose.UUID!}/>
    }
    return (
      <View 
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        width: 25000 // this is the wrong way to do this I think
      }}>
        <FlatList data={result} keyExtractor={item => item.source.goose.UUID!} renderItem={renderItem} />
      
      </View>
    );
  } else {
    return <></>
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
