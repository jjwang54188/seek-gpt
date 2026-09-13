import qr from 'qrcode-generator';
import {netease} from '../_lib/netease';
import {hash,random,seal,readSession,sessionCookie} from '../_lib/music-session';
const reply=(body:unknown,status=200,cookie?:string)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...(cookie?{'Set-Cookie':cookie}:{})}});
export async function onRequest({request,env}:{request:Request;env:{VISITOR_DB?:any}}){
  const url=new URL(request.url),action=url.searchParams.get('action')||'status';
  if(request.method!=='POST' && !(request.method==='GET'&&action==='status'))return reply({error:'请求方式不正确。'},405);
  if(request.method==='POST'&&(request.headers.get('Origin')!==url.origin||!request.headers.get('Content-Type')?.startsWith('application/json')))return reply({error:'请从本站音乐页操作。'},403);
  const db=env.VISITOR_DB;if(!db)return reply({error:'安全登录存储未连接，暂时无法登录。'},503);
  try{
    await db.exec('CREATE TABLE IF NOT EXISTS music_login_sessions (id TEXT PRIMARY KEY,payload TEXT NOT NULL,expires INTEGER NOT NULL,next_poll INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS music_login_limits (id TEXT PRIMARY KEY,count INTEGER NOT NULL,expires INTEGER NOT NULL);');
    await db.prepare('DELETE FROM music_login_sessions WHERE expires<?').bind(Date.now()).run();
    const session=await readSession(request,db);
    if(action==='status')return reply({loggedIn:!!session?.state.cookie,nickname:session?.state.nickname||'',expires:session?.row.expires||null});
    if(action==='logout'){if(session)await db.prepare('DELETE FROM music_login_sessions WHERE id=?').bind(session.id).run();return reply({loggedIn:false},200,sessionCookie('',0));}
    if(action==='start'){
      if(session?.state.cookie)return reply({error:'当前已登录，请先退出再切换账号。'},409);
      const now=Date.now(),bucket=await hash((request.headers.get('CF-Connecting-IP')||'local')+':'+Math.floor(now/3600000));
      await db.prepare('DELETE FROM music_login_limits WHERE expires<?').bind(now).run();
      const limit=await db.prepare('INSERT INTO music_login_limits(id,count,expires) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET count=count+1 RETURNING count').bind(bucket,now+3600000).first();
      if(limit.count>10)return reply({error:'二维码请求过于频繁，请稍后重试。'},429);
      const response=await netease('/api/login/qrcode/unikey',{type:3});const data=await response.json() as any;
      if(data.code!==200||typeof data.unikey!=='string'||!/^[\w-]{1,200}$/.test(data.unikey))return reply({error:'网易云暂时未提供登录二维码。'},502);
      if(session)await db.prepare('DELETE FROM music_login_sessions WHERE id=?').bind(session.id).run();
      const secret=random(),id=await hash(secret),expires=now+180000;
      const payload=await seal(secret,{qrKey:data.unikey,cookie:''});
      await db.prepare('INSERT INTO music_login_sessions(id,payload,expires,next_poll) VALUES(?,?,?,?)').bind(id,payload,expires,now+3000).run();
      const image=qr(0,'M');image.addData('https://music.163.com/login?codekey='+encodeURIComponent(data.unikey));image.make();
      return reply({image:image.createDataURL(6),expires},200,sessionCookie(secret));
    }
    if(action==='poll'){
      if(!session)return reply({error:'二维码已过期，请重新生成。'},401);
      if(session.state.cookie)return reply({loggedIn:true,nickname:session.state.nickname||''});
      const lock=await db.prepare('UPDATE music_login_sessions SET next_poll=? WHERE id=? AND next_poll<=? RETURNING id').bind(Date.now()+3000,session.id,Date.now()).first();if(!lock)return reply({waiting:true});
      const response=await netease('/api/login/qrcode/client/login',{key:session.state.qrKey,type:3});const data=await response.json() as any;
      if(data.code===800){await db.prepare('DELETE FROM music_login_sessions WHERE id=?').bind(session.id).run();return reply({error:'二维码已过期，请重新生成。'},401);}
      if(data.code===803){
        const headers=response.headers.get('set-cookie')||'';
        const pairs=[...headers.matchAll(/(?:^|[,;]\s*)(MUSIC_U|__csrf|MUSIC_A)=([^;,\r\n]+)/g)].map(m=>m[1]+'='+m[2]);
        if(!pairs.some(s=>s.startsWith('MUSIC_U=')))return reply({error:'网易云未返回完整登录凭证，请重新尝试。'},502);
        const cookie=pairs.join('; ');let nickname='网易云用户';
        try{const user=await(await netease('/api/w/nuser/account/get',{},cookie)).json() as any;if(user.profile?.nickname)nickname=String(user.profile.nickname).slice(0,80);}catch{}
        await db.prepare('UPDATE music_login_sessions SET payload=?,expires=? WHERE id=?').bind(await seal(session.secret,{cookie,nickname}),Date.now()+3600000,session.id).run();
        return reply({loggedIn:true,nickname},200,sessionCookie(session.secret));
      }
      if(data.code!==801&&data.code!==802)return reply({error:'网易云登录状态暂时不可用，请重试。'},502);
      return reply({waiting:true,confirm:data.code===802});
    }
    return reply({error:'不支持的登录操作。'},400);
  }catch{return reply({error:'登录服务暂时无法连接，请稍后重试。'},502);}
}
