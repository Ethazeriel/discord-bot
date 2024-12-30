type NapsterMember = {
  account: {
    id: string,
    type: 'account',
    href: 'https://api.napster.com/v2.2/me/account',
    created: string,
    cobrand: string,
    cocat: string,
    originCode: string,
    email: string,
    country: string,
    zip: null,
    lang: string,
    userName: string,
    firstName: string,
    lastName: string,
    screenName: string,
    nonDmcaRadioUser: boolean,
    parentalControlEnabled: boolean,
    isPublic: boolean,
    isCurrentSubscriptionPayable: boolean,
    scrobblingEnabled: boolean,
    preferredLanguage: string,
    screenNameAutoCreated: string,
    familyPlan: unknown,
    subscription: {
      id: string,
      billingPartnerCode: string,
      catalog: string,
      createDate: string,
      isSuspended: boolean,
      tierCode: string,
      tierName: string,
      productCode: string,
      productName: 'Napster',
      productServiceTerm: string,
      expirationDate: string,
      trialLengthDays: number,
      isTrial: boolean,
      state: string,
      billingPartner: string,
      createdWithSocialProvider: null
    },
    entitlements: {
      canStreamOnWeb: boolean,
      canStreamOnMobile: boolean,
      canStreamOnHomeDevice: boolean,
      canStreamOnPC: boolean,
      canUpgradeStreams: boolean,
      canPlayPremiumRadio: boolean,
      maxStreamCount: number,
      isPlayBasedTier: boolean,
      isMonthlyPlayBasedTier: boolean,
      isOneTimePlayBasedTier: boolean,
      totalPlays: null,
      playsRemaining: null,
      skipLimit: null,
      skipLimitMinutes: null,
      canStreamOffline: boolean,
      maxDeviceCount: number,
      canStreamRadio: boolean,
      canStreamOnDemand: boolean,
      canStreamHiRes: boolean,
      maxStreamBitrate: number,
      maxDownloadBitrate: number,
      maxPcCount: number
    },
    state: null,
    city: null,
    nickName: null,
    middleName: null,
    birthday: null
  }
}

type NapsterTrack = {
  type: string,
  id: string,
  index: number,
  disc: number,
  href: string,
  playbackSeconds: number,
  isAvailableInHiRes: boolean,
  isExplicit: boolean,
  name: string,
  isrc: string,
  shortcut: string,
  blurbs: Array<string>,
  artistName: string,
  artistId: string,
  albumName: string,
  formats: Array<NapsterFormat>,
  losslessFormats: Array<NapsterFormat>,
  albumId: string,
  contributors: Record<string, string>,
  links: NapsterLinks
  previewURL: string,
  isStreamable: boolean
}

type NapsterFormat = {
  type: 'format',
  bitrate: number,
  name: string,
  sampleBits: number,
  sampleRate: number
}

type NapsterLinks = {
  artists?: {
    ids: Array<string>,
    href: string,
  },
  albums?: {
    ids: Array<string>,
    href: string,
  },
  genres?: {
    ids: Array<string>,
    href: string,
  },
  tags?: {
    ids: Array<string>,
    href: string,
  },
  tracks?: {
    href: string
  },
  members?: {
    ids: Array<string>,
    href: string
  },
  sampleArtists?: {
    ids: Array<string>,
    href: string
  }
}

type NapsterTrackResult = {
  meta: {
    totalCount: null,
    returnedCount: number
  },
  tracks: Array<NapsterTrack>
}

type NapsterPlaylistTracksResult = {
  meta: {
    totalCount: number,
    returnedCount: number,
    query?: {
      limit: number,
      offset: number,
      previous?: string
    }
  },
  tracks: Array<NapsterTrack>
}

type NapsterPlaylistResult = {
  meta: {
    totalCount: null,
    returnedCount: number
  },
  playlists: Array<NapsterPlaylist>
}

type NapsterPlaylist = {
  type: 'playlist',
  id: string,
  name: string,
  modified: string,
  href: string,
  trackCount: number,
  privacy: string,
  images: Array<{
    type: 'image',
    id: string,
    url: string,
    contentId: string,
    width: number,
    height: number,
    isDefault: boolean,
    version: number,
    imageType: string
  }>,
  description: string,
  favoriteCount: number,
  freePlayCompliant: boolean,
  links: NapsterLinks
}

type NapsterSearchResult = {
  meta: {
    totalCount: number,
    returnedCount: number
  },
  search: {
    query: string,
    data: {
      tracks: Array<NapsterTrack>
    },
    order: Array<string>
  }
}