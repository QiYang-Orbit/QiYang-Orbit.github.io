const encoder = new TextEncoder();
const SESSION_AGE = 30 * 24 * 60 * 60 * 1000;
const AUTH_LIMIT = 20;
export const httpError = (status, code) => Object.assign(new Error(code), { status, code });
function text(value, max, required = false) {
  if (typeof value !== 'string' || value.trim().length > max || (required && !value.trim())) throw httpError(400, 'invalidInput');
  return value.trim();
}
const hex = bytes => [...new Uint8Array(bytes)].map(x => x.toString(16).padStart(2, '0')).join('');
const randomToken = () => hex(crypto.getRandomValues(new Uint8Array(32)));
export async function digest(value) { return hex(await crypto.subtle.digest('SHA-256', encoder.encode(value))); }
export async function passwordHash(value, salt) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(value), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: encoder.encode(salt), iterations: 100000, hash: 'SHA-256' }, key, 256));
}
function equal(a, b) { if(a.length !== b.length) return false; let delta = 0; for(let i=0;i<a.length;i++) delta |= a.charCodeAt(i)^b.charCodeAt(i); return delta === 0; }
export async function first(db, sql, ...args) { return db.prepare(sql).bind(...args).first(); }
async function rows(db, sql, ...args) { return (await db.prepare(sql).bind(...args).all()).results; }
async function run(db, sql, ...args) { return db.prepare(sql).bind(...args).run(); }
function viewUser(user) {
  return { id:user.id, name:user.name, username:user.username, allergies:user.allergies, role:user.role, avatarUrl:user.avatar ? `api/avatar/${user.id}?v=${user.updated_at}` : '' };
}
function foodView(food) { return { id:food.id, name:{zh:food.name_zh,en:food.name_en}, description:{zh:food.description_zh,en:food.description_en}, category:food.category, image:food.image, active:!!food.active, iceOptions:!!food.ice_options, sortOrder:food.sort_order }; }
const cookieName = 'qiqi_session';
function sessionToken(request) { return (request.headers.get('Cookie') || '').split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='))?.slice(cookieName.length+1) || ''; }
function cookie(request, token, maxAge) { return `${cookieName}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`; }
function json(value, status=200, headers={}) { return new Response(JSON.stringify(value), {status, headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}}); }
async function readBody(request) {
  if (!(request.headers.get('Content-Type') || '').startsWith('application/json')) throw httpError(415,'invalidInput');
  if(Number(request.headers.get('Content-Length'))>200000) throw httpError(413,'imageTooLarge');
  const bytes = new Uint8Array(await request.arrayBuffer());
  if(bytes.length>200000) throw httpError(413,'imageTooLarge');
  try { const data=JSON.parse(new TextDecoder().decode(bytes)); if(!data || typeof data!=='object' || Array.isArray(data)) throw Error(); return data; } catch { throw httpError(400,'invalidInput'); }
}
function avatar(value) {
  if(value==='')return '';
  if(typeof value!=='string' || value.length>150000 || !/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+=*$/.test(value)) throw httpError(400,'invalidAvatar');
  const raw=atob(value.split(',')[1]);
  if(raw.length>100000)throw httpError(413,'imageTooLarge');
  const png=raw.startsWith('\x89PNG\r\n\x1a\n'), jpeg=raw.startsWith('\xff\xd8\xff');
  if(!png&&!jpeg)throw httpError(400,'invalidAvatar');
  return value;
}
export async function handleApi(request, env) {
  const url=new URL(request.url), path=url.pathname.replace(/\/$/,'');
  const db=env.DB;
  if(!db)return json({error:'serviceUnavailable'},503);
  try {
    if(!['GET','HEAD'].includes(request.method)) {
      const origin=request.headers.get('Origin');
      if(origin!==url.origin && origin!==env.SITE_ORIGIN) throw httpError(403,'invalidOrigin');
      if(!origin)throw httpError(403,'invalidOrigin');
    }
    const token=sessionToken(request);
    const user=token ? await first(db,'SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.id=? AND s.expires_at>?',await digest(token),Date.now()) : null;
    if(path==='/api/session' && request.method==='GET')return json({user:user?viewUser(user):null,registrationAvailable:!!env.INVITE_CODE});
    if(path==='/api/menu' && request.method==='GET') {
      const foods=await rows(db,'SELECT * FROM foods WHERE active=1 ORDER BY sort_order,id');
      const wishes=user?await rows(db,'SELECT food_id AS foodId,ice FROM wishes WHERE user_id=?',user.id):[];
      return json({foods:foods.map(foodView),wishes});
    }
    if(['/api/auth/signup','/api/auth/login'].includes(path) && request.method==='POST') {
      const data=await readBody(request);
      const ip=request.headers.get('CF-Connecting-IP') || env.CLIENT_IP || 'local';
      const bucket=await digest('auth:'+ip+':'+Math.floor(Date.now()/900000));
      await run(db,'INSERT INTO rate_limits(id,count,expires_at) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET count=count+1',bucket,Date.now()+900000);
      const rate=await first(db,'SELECT count FROM rate_limits WHERE id=?',bucket);
      if(rate.count>AUTH_LIMIT)throw httpError(429,'tooManyAttempts');
      await run(db,'DELETE FROM rate_limits WHERE expires_at<?',Date.now());
      const username=text(data.username,32,true).toLowerCase();
      if(!/^[a-z0-9][a-z0-9_.-]{2,31}$/.test(username))throw httpError(400,'invalidUsername');
      if(typeof data.password!=='string' || data.password.length<10 || data.password.length>128)throw httpError(400,'invalidPassword');
      let account;
      if(path.endsWith('/signup')) {
        if(data.consent!==true)throw httpError(400,'consentRequired');
        if(!env.INVITE_CODE)throw httpError(503,'registrationUnavailable');
        if(!equal(await digest(String(data.inviteCode||'')),await digest(env.INVITE_CODE)))throw httpError(403,'invalidInvite');
        const name=text(data.name,24,true), allergies=text(data.allergies||'',200);
        let role='friend';
        if(username===env.OWNER_USERNAME){
          if(!env.OWNER_SETUP_CODE || !equal(await digest(String(data.ownerCode||'')),await digest(env.OWNER_SETUP_CODE)))throw httpError(403,'ownerSetupRequired');
          role='owner';
        }
        const salt=randomToken(), id=crypto.randomUUID(), hash=await passwordHash(data.password,salt), now=Date.now();
        try{await run(db,'INSERT INTO users(id,username,password_hash,salt,name,allergies,role,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)',id,username,hash,salt,name,allergies,role,now,now);}catch(e){if(String(e).includes('UNIQUE'))throw httpError(409,'usernameUnavailable');throw e;}
        account=await first(db,'SELECT * FROM users WHERE id=?',id);
      }else{
        account=await first(db,'SELECT * FROM users WHERE username=?',username);
        const hash=await passwordHash(data.password,account?.salt||'invalid-account-placeholder');
        if(!account || !equal(hash,account.password_hash))throw httpError(401,'invalidCredentials');
      }
      const session=randomToken();
      await db.batch([db.prepare('DELETE FROM sessions WHERE expires_at<?').bind(Date.now()),db.prepare('INSERT INTO sessions(id,user_id,expires_at) VALUES(?,?,?)').bind(await digest(session),account.id,Date.now()+SESSION_AGE)]);
      return json({user:viewUser(account)},200,{'Set-Cookie':cookie(request,session,SESSION_AGE/1000)});
    }
    if(!user)throw httpError(401,'loginRequired');
    if(path==='/api/auth/logout' && request.method==='POST') {
      await run(db,'DELETE FROM sessions WHERE id=?',await digest(token));
      return json({ok:true},200,{'Set-Cookie':cookie(request,'',0)});
    }
    if(path==='/api/profile' && request.method==='PATCH') {
      const data=await readBody(request),name=text(data.name,24,true),allergies=text(data.allergies||'',200);
      const picture=data.avatar===undefined?user.avatar:avatar(data.avatar);
      await run(db,'UPDATE users SET name=?,allergies=?,avatar=?,updated_at=? WHERE id=?',name,allergies,picture,Date.now(),user.id);
      return json({user:viewUser(await first(db,'SELECT * FROM users WHERE id=?',user.id))});
    }
    const avatarMatch=path.match(/^\/api\/avatar\/([a-f0-9-]+)$/);
    if(avatarMatch && request.method==='GET') {
      if(user.id!==avatarMatch[1] && user.role!=='owner')throw httpError(403,'forbidden');
      const person=await first(db,'SELECT avatar FROM users WHERE id=?',avatarMatch[1]);
      if(!person?.avatar)throw httpError(404,'notFound');
      const [header,body]=person.avatar.split(',');
      return new Response(Uint8Array.from(atob(body),c=>c.charCodeAt(0)),{headers:{'Content-Type':header.includes('image/png')?'image/png':'image/jpeg','Cache-Control':'private, max-age=60','X-Content-Type-Options':'nosniff'}});
    }
    const wishMatch=path.match(/^\/api\/wishes\/([a-z0-9-]+)$/);
    if(wishMatch && request.method==='PUT') {
      const data=await readBody(request),food=await first(db,'SELECT * FROM foods WHERE id=?',wishMatch[1]);
      if(!food?.active)throw httpError(404,'foodUnavailable');
      const ice=food.ice_options?data.ice:'';
      if(food.ice_options && !['ice','noIce'].includes(ice))throw httpError(400,'invalidIce');
      await run(db,'INSERT INTO wishes(user_id,food_id,ice,created_at) VALUES(?,?,?,?) ON CONFLICT(user_id,food_id) DO UPDATE SET ice=excluded.ice',user.id,food.id,ice,Date.now());
      return json({ok:true});
    }
    if(wishMatch && request.method==='DELETE') { await run(db,'DELETE FROM wishes WHERE user_id=? AND food_id=?',user.id,wishMatch[1]);return json({ok:true}); }
    if(path==='/api/requests' && request.method==='GET')return json({requests:await rows(db,'SELECT id,title,note,created_at AS createdAt FROM requests WHERE user_id=? AND status=? ORDER BY created_at DESC',user.id,'open')});
    if(path==='/api/requests' && request.method==='POST') {
      const data=await readBody(request),title=text(data.title,40,true),note=text(data.note||'',200);
      const result=await first(db,'SELECT COUNT(*) AS total FROM requests WHERE user_id=? AND status=?',user.id,'open');
      if(result.total>=20)throw httpError(400,'requestLimit');
      await run(db,'INSERT INTO requests(id,user_id,title,note,created_at) VALUES(?,?,?,?,?)',crypto.randomUUID(),user.id,title,note,Date.now());return json({ok:true},201);
    }
    const requestMatch=path.match(/^\/api\/requests\/([a-f0-9-]+)$/);
    if(requestMatch && request.method==='DELETE'){await run(db,"UPDATE requests SET status='withdrawn' WHERE id=? AND user_id=?",requestMatch[1],user.id);return json({ok:true});}
    if(user.role!=='owner')throw httpError(403,'forbidden');
    if(path==='/api/owner' && request.method==='GET') {
      const [people,foods,wishes,requests]=await Promise.all([rows(db,'SELECT * FROM users ORDER BY created_at'),rows(db,'SELECT * FROM foods ORDER BY sort_order,id'),rows(db,'SELECT user_id AS userId,food_id AS foodId,ice FROM wishes'),rows(db,"SELECT r.id,r.user_id AS userId,r.title,r.note,r.created_at AS createdAt,u.name FROM requests r JOIN users u ON u.id=r.user_id WHERE r.status='open' ORDER BY r.created_at DESC")]);
      return json({people:people.map(viewUser),foods:foods.map(foodView),wishes,requests});
    }
    const foodMatch=path.match(/^\/api\/owner\/foods\/([a-z0-9-]+)$/);
    if(foodMatch && request.method==='PUT') {
      const data=await readBody(request),nameZh=text(data.nameZh,40,true),nameEn=text(data.nameEn,80,true),descZh=text(data.descriptionZh||'',250),descEn=text(data.descriptionEn||'',350);
      if(!['drinks','desserts','meals'].includes(data.category))throw httpError(400,'invalidInput');
      const old=await first(db,'SELECT id FROM foods WHERE id=?',foodMatch[1]);
      const image=text(data.image||'',150);
      if(image && !/^assets\/[a-zA-Z0-9/_-]+\.png$/.test(image))throw httpError(400,'invalidInput');
      const order=Number.isFinite(data.sortOrder)?Math.min(10000,Math.max(0,data.sortOrder)):1000;
      await run(db,'INSERT INTO foods(id,name_zh,name_en,description_zh,description_en,category,image,active,ice_options,sort_order) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name_zh=excluded.name_zh,name_en=excluded.name_en,description_zh=excluded.description_zh,description_en=excluded.description_en,category=excluded.category,image=excluded.image,active=excluded.active,ice_options=excluded.ice_options,sort_order=excluded.sort_order',foodMatch[1],nameZh,nameEn,descZh,descEn,data.category,image,data.active?1:0,data.iceOptions?1:0,order);
      return json({ok:true});
    }
    const archiveMatch=path.match(/^\/api\/owner\/requests\/([a-f0-9-]+)$/);
    if(archiveMatch && request.method==='PATCH'){await run(db,"UPDATE requests SET status='archived' WHERE id=?",archiveMatch[1]);return json({ok:true});}
    throw httpError(404,'notFound');
  } catch(error) { return json({error:error.code||'serviceUnavailable'},error.status||500); }
}
