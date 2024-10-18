import { ThemedText } from '@/components/ThemedText';
import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';
import { timeDisplay } from '@/components/utils';
import styled from 'styled-components/native';
import React from 'react';

export function SimpleTrack({ source, id }:{source:Track, id:number}): React.JSX.Element | null
export function SimpleTrack({ source, id }:{source:TrackSource, id:number}): React.JSX.Element | null
export function SimpleTrack({ source, id }:{source:any, id:number}): React.JSX.Element | null {
  if (Object.keys(source).length) {

    const track = {
      art:'',
      name:'',
      artist:'',
      album:'',
      duration:0,
    };

    if (source.goose) {
      // source is Track
      track.art = source.goose.track.art;
      track.name = source.goose.track.name;
      track.artist = source.goose.artist.name;
      track.album = source.goose.album.name;
      track.duration = source.goose.track.duration;
    } else {
      // source is TrackSource
      track.art = source.art;
      track.name = source.name;
      track.artist = source.artist.name;
      track.album = source.album.name;
      track.duration = source.duration;
    }


    return (
      <Track style={ id % 2 ? styles.even : styles.odd}>
        <Image style={styles.image} source={track.art} contentFit="cover" transition={1000} />
        <VertCon>
          <ThemedText type="defaultSemiBold">{(id + 1)}</ThemedText>
        </VertCon>
        <Details>
          <ThemedText type="subtitle">{track.name}</ThemedText>
          <ThemedText type="default">{track.artist} - {track.album}</ThemedText>
        </Details>
        <Timer>{timeDisplay(track.duration)}</Timer>
      </Track>
    );
  } else {return null;}
}

const styles = StyleSheet.create({
  image: {
    height: 50,
    width: 50,
    backgroundColor: '#00868633',
    marginLeft: 5,
    marginRight: 5
  },
  even: {
    backgroundColor:'#333536'
  },
  odd: {
    backgroundColor:'#242627'
  }
});

// const Art = styled.Image`
//   height:6.4vh;
//   width:6.4vh;
//   background-color:#00868633;
//   margin-left:0.5%;
//   margin-right:0.5%;
//   object-fit:cover;
//   transition:1000ms;
// `; // TODO - can't define image source if we use this
const Track = styled.View`
  display:flex;
  flex-direction:row;
  height:80px;
  width: 100%;
  align-items:center;
  background-color:#242627;
  /* &:nth-child() {background-color: #223842;} */
`;
const VertCon = styled.View`
  display:flex;
  flex-direction:column;
  margin-left:0.5em;
  margin-right:1%;
  /* background-color:#242627; */
`;
const Details = styled.View`
  margin:0px;
  width:30vw;
  flex:15;
  text-align:left;
  overflow:hidden;
  /* background-color:#242627; */
`;
const Timer = styled.Text`
  font-size:16px;
  line-height:24px;
  font-weight:bold;
  margin-right:5px;
  color:#ECEDEE;
`;