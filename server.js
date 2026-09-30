const http=require('http');
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const ROOT=__dirname, PUBLIC=path.join(ROOT,'public'), DATA=path.join(ROOT,'data','codes.json');
const PORT=Number(process.env.PORT||3000), ADMIN_KEY=process.env.ADMIN_KEY||'change-moi-cette-cle';
const MODULES={m1:{name:'Démarrer le e-commerce',file:'Cours_1_Demarrer_le_ecommerce.pdf'},m2:{name:'Facebook & WhatsApp Business',file:'Cours_2_Facebook_WhatsApp_Business.pdf'},m3:{name:'Livraison & service client',file:'Cours_3_Livraison_service_client.pdf'},m4:{name:'Marketing & acquisition',file:'Cours_4_Marketing_acquisition.pdf'},m5:{name:'Organisation & croissance',file:'Cours_5_Organisation_croissance.pdf'}};
function load(){return JSON.parse(fs.readFileSync(DATA,'utf8'));}
function save(x){fs.writeFileSync(DATA,JSON.stringify(x,null,2));}
function newCode(){const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; const r=n=>Array.from({length:n},()=>chars[crypto.randomInt(chars.length)]).join(''); return `ECOM-${r(4)}-${r(4)}-${r(4)}`;}
function replenish(db,pool){const used=new Set(db.used[pool]||[]); db.active[pool]=[]; while(db.active[pool].length<25){const c=newCode(); if(!used.has(c)&&!Object.values(db.active).flat().includes(c)) db.active[pool].push(c);} db.used[pool]=[]; save(db); return db.active[pool];}
function redeem(raw,module){const code=String(raw||'').trim().toUpperCase(); const db=load();
  if(!MODULES[module] && module!=='pack') return {ok:false,status:400,message:'Cours invalide.'};
  let pool=null;
  for(const k of Object.keys(db.active)){if((db.active[k]||[]).includes(code)){pool=k;break;}}
  if(!pool) return {ok:false,status:404,message:'Code incorrect ou déjà utilisé.'};
  if(pool!=='pack' && pool!==module) return {ok:false,status:409,message:'Ce code correspond à un autre cours.'};
  db.active[pool]=db.active[pool].filter(c=>c!==code); db.used[pool]=(db.used[pool]||[]); db.used[pool].push(code); db.history.push({at:new Date().toISOString(),module,pool,code});
  const remaining=db.active[pool].length; let rotated=false; if(remaining===0){replenish(db,pool); rotated=true;}
  else save(db);
  const files=pool==='pack'?Object.values(MODULES).map(x=>`/pdfs/${x.file}`):[`/pdfs/${MODULES[module].file}`];
  return {ok:true,pool,module,files,remainingBeforeRotation:remaining,rotated};
}
function send(res,status,type,body){res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store'});res.end(body);}
function json(res,status,obj){send(res,status,'application/json; charset=utf-8',JSON.stringify(obj));}
function safeFile(p){const full=path.normalize(path.join(PUBLIC,p)); return full.startsWith(PUBLIC+path.sep)?full:null;}
const server=http.createServer((req,res)=>{
  const u=new URL(req.url,`http://${req.headers.host}`);
  if(req.method==='POST' && u.pathname==='/api/redeem'){
    let b=''; req.on('data',c=>{b+=c; if(b.length>10000) req.destroy();}); req.on('end',()=>{try{const x=JSON.parse(b); json(res,200,redeem(x.code,x.module));}catch(e){json(res,400,{ok:false,message:'Requête invalide.'});}}); return;
  }
  if(req.method==='GET' && u.pathname==='/api/admin/codes'){
    if(req.headers['x-admin-key']!==ADMIN_KEY) return json(res,401,{ok:false,message:'Accès administrateur refusé.'});
    const db=load(); const out={}; for(const k of Object.keys(db.active)) out[k]={remaining:db.active[k].length,codes:db.active[k]}; return json(res,200,out);
  }
  if(req.method==='GET' && u.pathname==='/api/health') return json(res,200,{ok:true,service:'ecommerce-pro-v5'});
  let file=u.pathname==='/'?'/index.html':u.pathname; const full=safeFile(file); if(!full) return send(res,403,'text/plain','Forbidden');
  fs.stat(full,(err,st)=>{if(err||!st.isFile()) return send(res,404,'text/plain','Not found'); const ext=path.extname(full); const types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'application/javascript','.json':'application/json','.pdf':'application/pdf','.zip':'application/zip','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp'}; res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream'}); fs.createReadStream(full).pipe(res);});
});
server.listen(PORT,()=>console.log(`E-commerce Pro v5 running on http://localhost:${PORT}`));
