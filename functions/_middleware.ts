import { record, session, type Env } from './_lib/visitors';
export const onRequest = async (context: {request:Request; env:Env; next:()=>Promise<Response>; waitUntil:(p:Promise<any>)=>void}) => {
 const {request, env} = context; const url = new URL(request.url); const started = Date.now();
 const response = await context.next();
 const track = request.method === 'GET' && !url.pathname.startsWith('/admin') && !url.pathname.startsWith('/api') && !url.pathname.startsWith('/_astro') && !/\.[a-z0-9]{2,5}$/i.test(url.pathname);
 if (!track || !env.VISITOR_DB) return response;
 const s = session(request);
 context.waitUntil(record(env.VISITOR_DB, request, {event_type:'page_view',path:url.pathname + url.search,status:response.status,duration_ms:Date.now()-started}, s.id).catch(()=>{}));
 if (!s.fresh) return response;
 const headers = new Headers(response.headers); headers.append('Set-Cookie', `seek_visitor=${s.id}; Path=/; Max-Age=7776000; Secure; HttpOnly; SameSite=Lax`);
 return new Response(response.body, {status:response.status,statusText:response.statusText,headers});
};
