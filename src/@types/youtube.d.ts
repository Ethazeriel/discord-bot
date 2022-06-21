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

  type YoutubePlaylistResponse = {
    kind: 'youtube#playlistItemListResponse',
    etag: string,
    nextPageToken: string,
    prevPageToken: string,
    pageInfo: {
      totalResults: number,
      resultsPerPage: number
    },
    items: Array<YoutubePlaylistItem>
  }

  type YoutubePlaylistItem = {
    kind: 'youtube#playlistItem',
    etag: string,
    id: string,
    snippet: {
      publishedAt: datetime,
      channelId: string,
      title: string,
      description: string,
      thumbnails: Record<string, {
          url: string,
          width: number,
          height: number
        }>,
      channelTitle: string,
      videoOwnerChannelTitle: string,
      videoOwnerChannelId: string,
      playlistId: string,
      position: number,
      resourceId: {
        kind: string,
        videoId: string,
      }
    },
    contentDetails: {
      videoId: string,
      startAt: string,
      endAt: string,
      note: string,
      videoPublishedAt: string
    },
    status: {
      privacyStatus: string
    }
  }