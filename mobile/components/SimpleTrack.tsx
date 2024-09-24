import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';
import { timeDisplay } from '@/components/utils';

export function SimpleTrack({source, id}:{source:TrackSource, id:number}) {
  if (Object.keys(source).length) {
    return (
      <ThemedView style={styles.trackStyle}>
        <Image style={styles.image} source={source.art} contentFit="cover" transition={1000} />
        <ThemedView style={styles.numContainer}>
          <ThemedText type="defaultSemiBold">{(id + 1)}</ThemedText>
        </ThemedView>
        <ThemedView style={styles.details}>
          <ThemedText type="subtitle">{source.name}</ThemedText>
          <ThemedText type="default">{source.artist.name} - {source.album.name}</ThemedText>
        </ThemedView>
        <ThemedText style={styles.playtime}>{timeDisplay(source.duration)}</ThemedText>
      </ThemedView>
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
  trackStyle: {
    flexDirection: 'row',
    height: 70,
    width: "100%",
    alignItems: 'center',
    backgroundColor: '#242627',

  },
  numContainer: {
    flex: 1,
    flexDirection: 'column',
    marginLeft: 5,
    backgroundColor: '#242627',
  },
  details: {
    margin: 0,
    flex: 15,
    textAlign: 'left',
    overflow: 'hidden',
    backgroundColor: '#242627',
  },
  playtime: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
    marginRight: 5,
  },
});