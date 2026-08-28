/*
  רשימת ערוצי ברירת המחדל.
  כתובות שידור יכולות להשתנות אצל ספקי הטלוויזיה.
  urls מאפשר לנסות מקור חלופי אוטומטית.
  proxyProfile מפעיל את הפרוקסי המקומי של Start.cmd עבור מקור שדורש Referer/Origin.
*/
window.NEWS_CHANNELS = [
  {
    id: "kan11",
    name: "כאן 11",
    short: "11",
    type: "hls",
    urls: [
      "https://kancdn.medonecdn.net/livehls/oil/kancdn-live/live/kan11/live.livx/playlist.m3u8",
      "https://kan11w.media.kan.org.il/hls/live/2105694/2105694/master.m3u8"
    ],
    official: "https://www.kan.org.il/live/?stationId=4482",
    accent: "#1f9bd1",
    primary: true
  },
  {
    id: "keshet12",
    name: "קשת 12 / חדשות 12",
    short: "12",
    type: "hls",
    urls: [
      "https://mako-streaming.akamaized.net/direct/hls/live/20000821/k12ni-bu/index.m3u8?b-in-range=0-800",
      "https://mako-streaming.akamaized.net/stream/hls/live/20000821/k12n12wad/index.m3u8?b-in-range=0-800"
    ],
    proxyProfile: "n12",
    official: "https://www.mako.co.il/tv-live/Article-90408c620b8df81026.htm",
    accent: "#ff4c62",
    primary: true
  },
  {
    id: "reshet13",
    name: "רשת 13 / חדשות 13",
    short: "13",
    type: "hls",
    urls: [
      "https://d2xg1g9o5vns8m.cloudfront.net/out/v1/0855d703f7d5436fae6a9c7ce8ca5075/index.m3u8",
      "https://d18b0e6mopany4.cloudfront.net/out/v1/2f2bc414a3db4698a8e94b89eaf2da2a/index.m3u8"
    ],
    official: "https://13tv.co.il/live/",
    accent: "#7b5cff",
    primary: true
  },
  {
    id: "now14",
    name: "עכשיו 14",
    short: "14",
    type: "hls",
    urls: [
      "https://n-121-7.il.cdn-redge.media/livehls/oil/ch14/live/ch14/live.livx/playlist.m3u8"
    ],
    official: "https://www.c14.co.il/live/",
    accent: "#f0b429",
    primary: true
  },
  {
    id: "i24he",
    name: "i24NEWS עברית",
    short: "i24",
    type: "hls",
    urls: [
      "https://i24newshebrew-cdn.encoders.immergo.tv/2/streamPlaylist.m3u8",
      "https://i24newshebrew-cdn.encoders.immergo.tv/master.m3u8"
    ],
    official: "https://www.i24news.tv/he",
    accent: "#e8416b",
    primary: true
  },
  {
    id: "knesset",
    name: "ערוץ כנסת",
    short: "99",
    type: "hls",
    urls: [
      "https://kneset.gostreaming.tv/p2-kneset/_definst_/myStream/playlist.m3u8"
    ],
    official: "https://www.knesset.tv/live/",
    accent: "#4aa36b",
    primary: true
  },
  {
    id: "channel9",
    name: "ערוץ 9",
    short: "9",
    type: "hls",
    urls: [
      "https://contact.gostreaming.tv/Con-11/index.m3u8"
    ],
    official: "https://www.youtube.com/@israel9tv/live",
    accent: "#e06b34",
    primary: false
  }
];
