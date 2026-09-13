// EAPI framing adapted from Binaryify/NeteaseCloudMusicApi (MIT).
// License: THIRD_PARTY_MUSIC_LICENSE.txt. No unlocking or credential spoofing.
import { createCipheriv, createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';

export async function netease(path: string, data: Record<string, unknown>) {
  const text = JSON.stringify({...data,e_r:false});
  const digest = createHash('md5').update(`nobody${path}use${text}md5forencrypt`).digest('hex');
  const cipher = createCipheriv('aes-128-ecb',Buffer.from('e82ckenh8dichen8'),null);
  const params = Buffer.concat([cipher.update(`${path}-36cd479b6b5-${text}-36cd479b6b5-${digest}`),cipher.final()]).toString('hex').toUpperCase();
  return fetch('https://interface.music.163.com'+path.replace(/^\/api\//,'/eapi/'),{
    method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({params}),signal:AbortSignal.timeout(10000),redirect:'error'
  });
}
