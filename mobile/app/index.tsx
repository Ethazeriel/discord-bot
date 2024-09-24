import { Text, View } from "react-native";
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { SimpleTrack } from "@/components/SimpleTrack";

export default function Index() {
  return (
    <ThemedView
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <SimpleTrack source={example} id={1} />
    </ThemedView>
  );
}

const example = {
    "id": [
      "6QL6LDRzZI6McFYURfDm7H",
      "5wFMLUa2p7Uoz9a8is0IMH"
    ],
    "name": "As Death Embraces",
    "art": "https://i.scdn.co/image/ab67616d0000b273817a9af094d11b2b6936f0ba",
    "duration": 193.413,
    "url": "https://open.spotify.com/track/6QL6LDRzZI6McFYURfDm7H",
    "album": {
      "id": "3RBULTZJ97bvVzZLpxcB0j",
      "name": "The Mountain",
      "trackNumber": 7
    },
    "artist": {
      "id": "2SRIVGDkdqQnrQdaXxDkJt",
      "name": "Haken"
    }
  };

// export default function Index() {
//   return (
//     <ThemedView
//       style={{
//         flex: 1,
//         justifyContent: "center",
//         alignItems: "center",
//       }}
//     >
//       <ThemedText>Edit app/index.tsx to edit this screen.</ThemedText>
//     </ThemedView>
//   );
// }