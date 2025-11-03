#!/usr/bin/env node
import https from 'https';

const candidates = [
  'https://pub-b8fe695f5b4b490ebe0dc151042193e2.r2.dev',
  'https://pub-b8fe695f5b4b490ebe0dc151042193e2.r2.dev/cueai-media'
];

const testKeys = [
  'music/christmas_piano_music.mp3',
  'music/christmas_music_box_music.wav',
  'sfx/owl-hoot.wav'
];

function head(url) {
  return new Promise((resolve) => {
    const req = https.request(url, { method: 'HEAD' }, (res) => resolve(res.statusCode));
    req.on('error', () => resolve(0));
    req.end();
  });
}

(async () => {
  for (const base of candidates) {
    let ok = 0;
    for (const key of testKeys) {
      const url = encodeURI(`${base.replace(/\/$/,'')}/${key}`);
      const status = await head(url);
      console.log(`${status} ${url}`);
      if (status === 200) ok++;
    }
    console.log(`Base ${base} success count: ${ok}/${testKeys.length}`);
  }
})();
