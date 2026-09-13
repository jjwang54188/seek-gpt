// Public, read-only metadata. Never forward browser cookies or arbitrary URLs.
import { netease } from '../_lib/netease';
export async function onRequestGet({request}: {request: Request}) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  let upstream: URL;
  if (action === 'search') {
    const q = (url.searchParams.get('q') || '').trim();
    if (!q || q.length > 80) return Response.json({error:'请输入 1–80 个字符的歌名或歌手。'},{status:400});
    upstream = new URL('https://music.163.com/api/search/get/web');
    upstream.search = new URLSearchParams({s:q,type:'1',offset:'0',limit:'20'}).toString();
  } else if (action === 'lyrics') {
    const id = url.searchParams.get('id') || '';
    if (!/^\d{1,20}$/.test(id)) return Response.json({error:'歌曲编号不正确。'},{status:400});
    upstream = new URL('https://music.163.com/api/song/lyric');
    upstream.search = new URLSearchParams({id,lv:'1',kv:'1',tv:'-1'}).toString();
  } else return Response.json({error:'不支持的音乐操作。'},{status:400});
  try {
    const body = action === 'search' ? upstream.searchParams.toString() : undefined;
    if (body) upstream.search = '';
    const response = action === 'search'
      ? await netease('/api/search/get',{s:(url.searchParams.get('q')||'').trim(),type:1,offset:0,limit:20})
      : await fetch(upstream,{signal:AbortSignal.timeout(10000),headers:{Accept:'application/json'},redirect:'follow'});
    if (!response.ok) return Response.json({error:'网易云服务暂时拒绝此请求，请稍后重试。',upstreamStatus:response.status},{status:502});
    const data = await response.json() as any;
    if (data.code !== 200) return Response.json({error:'网易云暂时未返回可用数据。',upstreamCode:Number(data.code)||0},{status:502});
    if (action === 'search' && !Array.isArray(data.result?.songs)) return Response.json({error:'网易云未返回歌曲列表，当前搜索连接不可用。原有榜单播放器仍可使用。'},{status:502});
    const result = action === 'search' ? {songs:(data.result?.songs || []).map((s:any)=>({id:String(s.id),name:String(s.name),artist:(s.artists || []).map((a:any)=>a.name).join(' / '),album:String(s.album?.name || ''),duration:Number(s.duration)||0,restricted:s.fee===1||s.fee===4}))} : {lyric:String(data.lrc?.lyric || '').slice(0,100000)};
    return Response.json(result,{headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  } catch { return Response.json({error:'网易云暂时未返回可用数据，请稍后重试。'},{status:502}); }
}
