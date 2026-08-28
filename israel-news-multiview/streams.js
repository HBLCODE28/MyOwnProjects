/*
  ערוצי ברירת המחדל.
  אפשר לעדכן כתובת stream בלי לגעת ב-app.js.
  type="hls" מיועד לכתובות m3u8.
*/
window.NEWS_CHANNELS = [
  {
    id: "kan11",
    name: "כאן 11",
    short: "11",
    type: "hls",
    url: "https://kan11.media.kan.org.il/hls/live/2024514/2024514/master.m3u8",
    official: "https://www.kan.org.il/live/",
    primary: true
  },
  {
    id: "keshet12",
    name: "קשת 12 / חדשות 12",
    short: "12",
    type: "hls",
    url: "https://mako-streaming.akamaized.net/direct/hls/live/20000821/k12ni-bu/index.m3u8?b-in-range=0-800",
    official: "https://www.mako.co.il/tv-live/Article-90408c620b8df81026.htm",
    primary: true
  },
  {
    id: "reshet13",
    name: "רשת 13 / חדשות 13",
    short: "13",
    type: "hls",
    url: "https://d2xg1g9o5vns8m.cloudfront.net/out/v1/0855d703f7d5436fae6a9c7ce8ca5075/index.m3u8",
    official: "https://13tv.co.il/live/",
    primary: true
  },
  {
    id: "now14",
    name: "עכשיו 14",
    short: "14",
    type: "hls",
    url: "https://n-121-7.il.cdn-redge.media/livehls/oil/ch14/live/ch14/live.livx/playlist.m3u8",
    official: "https://www.c14.co.il/live/",
    primary: true
  },
  {
    id: "i24he",
    name: "i24NEWS עברית",
    short: "i24",
    type: "hls",
    url: "https://i24newshebrew-cdn.encoders.immergo.tv/master.m3u8",
    official: "https://www.i24news.tv/he",
    primary: true
  },
  {
    id: "knesset",
    name: "ערוץ כנסת",
    short: "99",
    type: "hls",
    url: "https://contact.gostreaming.tv/Knesset/myStream/playlist.m3u8",
    official: "https://www.knesset.tv/live/",
    primary: true
  },
  {
    id: "channel9",
    name: "ערוץ 9",
    short: "9",
    type: "hls",
    url: "https://contact.gostreaming.tv/Con-11/index.m3u8",
    official: "https://www.youtube.com/@israel9tv/live",
    primary: false
  }
];
