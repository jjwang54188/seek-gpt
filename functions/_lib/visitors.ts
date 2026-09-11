export type Env = { VISITOR_DB?: any; ADMIN_GITHUB_LOGIN?: string };

export const schema = `CREATE TABLE IF NOT EXISTS visitor_events (
 id INTEGER PRIMARY KEY AUTOINCREMENT, occurred_at TEXT NOT NULL, session_id TEXT NOT NULL,
 ip TEXT, event_type TEXT NOT NULL, path TEXT NOT NULL, target TEXT, detail TEXT, referer TEXT,
 user_agent TEXT, language TEXT, device TEXT, browser TEXT, os TEXT,
 country TEXT, region TEXT, city TEXT, timezone TEXT, colo TEXT, asn TEXT, organization TEXT,
 status INTEGER, duration_ms INTEGER
); CREATE INDEX IF NOT EXISTS idx_visitor_events_time ON visitor_events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_visitor_events_session ON visitor_events(session_id, occurred_at DESC);`;

const cut = (value: unknown, size = 500) => String(value ?? '').slice(0, size);
export function clientInfo(request: Request) {
 const ua = request.headers.get('user-agent') || '';
 const cf: any = (request as any).cf || {};
 const device = /bot|spider|crawler/i.test(ua) ? '机器人' : /mobile|android|iphone/i.test(ua) ? '手机' : /ipad|tablet/i.test(ua) ? '平板' : '电脑';
 const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : '其他';
 const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS/iPadOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '其他';
 return {ip: cut(request.headers.get('CF-Connecting-IP'), 80), ua: cut(ua, 1000), language: cut(request.headers.get('accept-language'), 200), referer: cut(request.headers.get('referer'), 1000), device, browser, os, country: cut(cf.country, 80), region: cut(cf.region, 120), city: cut(cf.city, 120), timezone: cut(cf.timezone, 80), colo: cut(cf.colo, 30), asn: cut(cf.asn, 30), organization: cut(cf.asOrganization, 200)};
}
export function session(request: Request) {
 const found = request.headers.get('cookie')?.match(/(?:^|;\s*)seek_visitor=([^;]+)/)?.[1];
 return found ? {id: cut(found, 80), fresh: false} : {id: crypto.randomUUID(), fresh: true};
}
export async function ensure(db: any) { for (const sql of schema.split(';').map(s => s.trim()).filter(Boolean)) await db.prepare(sql).run(); }
export async function record(db: any, request: Request, data: {event_type:string; path:string; target?:string; detail?:string; status?:number; duration_ms?:number}, sid: string) {
 const c = clientInfo(request);
 await ensure(db);
 await db.prepare(`INSERT INTO visitor_events (occurred_at,session_id,ip,event_type,path,target,detail,referer,user_agent,language,device,browser,os,country,region,city,timezone,colo,asn,organization,status,duration_ms) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
  .bind(new Date().toISOString(),sid,c.ip,data.event_type,cut(data.path),cut(data.target),cut(data.detail,2000),c.referer,c.ua,c.language,c.device,c.browser,c.os,c.country,c.region,c.city,c.timezone,c.colo,c.asn,c.organization,data.status ?? null,data.duration_ms ?? null).run();
}
export async function authorized(request: Request, env: Env) {
 const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
 if (!token) return false;
 const r = await fetch('https://api.github.com/user', {headers:{Authorization:`Bearer ${token}`,'User-Agent':'seek-blog-admin','X-GitHub-Api-Version':'2022-11-28'}});
 if (!r.ok) return false;
 const user: any = await r.json();
 return String(user.login || '').toLowerCase() === (env.ADMIN_GITHUB_LOGIN || 'jjwang54188').toLowerCase();
}
