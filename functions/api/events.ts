import { record, session, type Env } from '../_lib/visitors';
export const onRequestPost = async ({request,env,waitUntil}:{request:Request;env:Env;waitUntil:(p:Promise<any>)=>void}) => {
 if (!env.VISITOR_DB) return new Response(null,{status:204});
 let body:any; try { body = await request.json(); } catch { return new Response(null,{status:400}); }
 if (!['click','leave'].includes(body.type) || typeof body.path !== 'string') return new Response(null,{status:400});
 const s = session(request); waitUntil(record(env.VISITOR_DB,request,{event_type:body.type,path:body.path,target:body.target,detail:body.detail},s.id).catch(()=>{}));
 const headers = new Headers(); if (s.fresh) headers.append('Set-Cookie',`seek_visitor=${s.id}; Path=/; Max-Age=7776000; Secure; HttpOnly; SameSite=Lax`);
 return new Response(null,{status:204,headers});
};
