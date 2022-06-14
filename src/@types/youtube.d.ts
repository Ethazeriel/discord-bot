type YoutubeSearchResponse = {
  kind: 'youtube#searchListResponse',
  etag: string,
  nextPageToken: string,
  prevPageToken: string,
  regionCode: string,
  pageInfo: {
    totalResults: integer,
    resultsPerPage: integer
  },
  items: Array<YoutubeSearchItem>
}

type YoutubeSearchItem = {
  kind: 'youtube#searchResult',
  etag: string,
  id: {
    kind: string,
    videoId: string,
    channelId: string,
    playlistId: string
  },
  snippet: {
    publishedAt: string,
    channelId: string,
    title: string,
    description: string,
    thumbnails: Record<string, {
        url: string,
        width: number,
        height: number
      }>
    },
    channelTitle: string,
    liveBroadcastContent: 'upcoming' | 'live' | 'none'
  }