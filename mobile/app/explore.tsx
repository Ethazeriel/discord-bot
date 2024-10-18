import { StatusBar } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { TrackList } from '@/components/TrackList';

export default function Explore() {
  return (
    <ThemedView
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%'
      }}
    >
      <StatusBar translucent={false} />
      <TrackList listname='horses' target='playlist' />
    </ThemedView>
  );
}
