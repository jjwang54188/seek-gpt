// The random browser secret is HttpOnly. D1 stores only its hash and AES-GCM
// encrypted provider credentials, never plaintext cookies. Sessions expire in 1h.
const name='__Secure-seek_music';
const encoder=new TextEncoder();
const hex=(data:Uint8Array)=>Array.from(data,b=>b.toString(16).padStart(2,'0')).join('');
export const random=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
export const hash=async(value:string)=>hex(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value))));
const key=(secret:string)=>crypto.subtle.importKey('raw',Uint8Array.from(secret.match(/../g)!,v=>parseInt(v,16)),'AES-GCM',false,['encrypt','decrypt']);
export async function seal(secret:string,value:unknown){const iv=crypto.getRandomValues(new Uint8Array(12));const body=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(secret),encoder.encode(JSON.stringify(value))));return hex(iv)+hex(body);}
export async function unseal(secret:string,payload:string){const raw=Uint8Array.from(payload.match(/../g)!,v=>parseInt(v,16));return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:raw.slice(0,12)},await key(secret),raw.slice(12))));}
export const sessionCookie=(secret:string,age=3600)=>`${name}=${secret}; Path=/api/; Max-Age=${age}; Secure; HttpOnly; SameSite=Strict`;
export async function readSession(request:Request,db:any){
  const secret=request.headers.get('Cookie')?.match(/(?:^|;\s*)__Secure-seek_music=([a-f0-9]{64})(?:;|$)/)?.[1];
  if(!secret||!db)return null;
  const id=await hash(secret);const row=await db.prepare('SELECT payload,expires,next_poll FROM music_login_sessions WHERE id=? AND expires>?').bind(id,Date.now()).first();if(!row)return null;
  try{return {id,secret,row,state:await unseal(secret,row.payload)};}catch{return null;}
}
