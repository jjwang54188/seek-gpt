import { authorized, ensure, type Env } from '../_lib/visitors';
export const onRequestGet = async ({request,env}:{request:Request;env:Env}) => {
 if (!await authorized(request,env)) return Response.json({error:'请用站长 GitHub 账号登录。'},{status:401});
 if (!env.VISITOR_DB) return Response.json({error:'访客数据库尚未绑定。'},{status:503});
 await ensure(env.VISITOR_DB);
 await env.VISITOR_DB.prepare("DELETE FROM visitor_events WHERE occurred_at < datetime('now','-90 days')").run();
 const url = new URL(request.url); const limit = Math.min(Math.max(Number(url.searchParams.get('limit'))||200,1),500);
 const [summary, events] = await Promise.all([
  env.VISITOR_DB.prepare("SELECT COUNT(*) total_events, COUNT(DISTINCT session_id) visitors, COUNT(DISTINCT ip) ips, SUM(CASE WHEN event_type='page_view' THEN 1 ELSE 0 END) page_views FROM visitor_events WHERE occurred_at >= datetime('now','-30 days')").first(),
  env.VISITOR_DB.prepare('SELECT * FROM visitor_events ORDER BY occurred_at DESC LIMIT ?').bind(limit).all()
 ]);
 return Response.json({summary,events:events.results || []},{headers:{'Cache-Control':'no-store'}});
};
