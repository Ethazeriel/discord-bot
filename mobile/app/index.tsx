import { StatusBar } from 'react-native';
import { ThemedView } from '@/components/ThemedView';
import { LoadGoose, } from '@/components/LoadGoose';
import { TrackList } from '@/components/TrackList';

export default function Index() {
  LoadGoose();
  // const user = null;
  // if (!user) {
  //   LogIn();
  // }
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
      <TrackList target='player'/>
    </ThemedView>
  );
}