// EAPI framing adapted from Binaryify/NeteaseCloudMusicApi (MIT).
// License: THIRD_PARTY_MUSIC_LICENSE.txt. No unlocking or credential spoofing.
import CryptoJS from 'crypto-js';

export async function netease(path: string, data: Record<string, unknown>, cookie = '') {
  const identity = Object.fromEntries(cookie.split(';').map(pair=>pair.trim().split(/=(.*)/s)).filter(pair=>pair[0] && pair[1]));
  const header = {...identity,requestId:crypto.randomUUID()};
  const text = JSON.stringify({...data,header,e_r:false});
  const digest = CryptoJS.MD5(`nobody${path}use${text}md5forencrypt`).toString();
  const params = CryptoJS.AES.encrypt(`${path}-36cd479b6b5-${text}-36cd479b6b5-${digest}`,CryptoJS.enc.Utf8.parse('e82ckenh8dichen8'),{mode:CryptoJS.mode.ECB,padding:CryptoJS.pad.Pkcs7}).ciphertext.toString().toUpperCase();
  return fetch('https://interface.music.163.com'+path.replace(/^\/api\//,'/eapi/'),{
    method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',...(cookie?{Cookie:cookie}:{})},
    body:new URLSearchParams({params}),signal:AbortSignal.timeout(10000),redirect:'manual'
  });
}
