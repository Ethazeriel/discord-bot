export const youtubePattern = /(?:youtube\.com|youtu\.be)(\/(?:[\w-]+\?v=|embed\/|v\/)?)([\w-]{11})(\S+)?/;
export const youtubePlaylistPattern = /(?:youtube\.com)(\/(?:playlist\?list=)?)([\w-]{34})(\S+)?/;
export const spotifyPattern = /(?:spotify\.com|spotify)(?:\/|:)((?:track|playlist|album){1})(?:\/|:)([a-zA-Z0-9]{22})/;
export const napsterPattern = /(?:play\.napster\.com)(?:\/album\/|\/playlist\/)((?:alb\.|pp\.|mp\.)(?:\d{9}){1}).*((?<=&rsrc=)(?:track|playlist|album){1})(?:&trackId=)?((?:tra\.\d{9}))?/;
export const subsonicPattern = /(?:\/app\/#\/)((?:track|playlist|album){1})(?:\/)([a-f0-9-]{32,36})/;

export const dragPattern = /(text\/plain)/i;