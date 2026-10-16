require('dotenv').config();
const express=require('express'),cors=require('cors'),http=require('http'),{Server}=require('socket.io');
const bcrypt=require('bcryptjs'),jwt=require('jsonwebtoken'),{Pool}=require('pg');
const pool=new Pool({connectionString:process.env.DATABASE_URL});
const q=(t,p)=>pool.query(t,p).then(r=>r.rows);
const ORIGIN=process.env.CLIENT_URL||'http://localhost:5173',SECRET=process.env.JWT_SECRET||'dev-secret';
const app=express();app.use(cors({origin:ORIGIN}),express.json());
const server=http.createServer(app);
const io=new Server(server,{cors:{origin:ORIGIN}});
const RANK={viewer:1,member:2,admin:3};
const wrap=f=>(req,res,next)=>f(req,res,next).catch(e=>{console.error(e);res.status(500).json({error:'Erreur serveur'})});
const auth=(req,res,next)=>{try{req.user=jwt.verify((req.headers.authorization||'').replace('Bearer ',''),SECRET);next()}catch{res.status(401).json({error:'Non connecté'})}};
const boardRole=async(uid,bid)=>(await q('select tm.role from team_members tm join boards b on b.team_id=tm.team_id where b.id=$1 and tm.user_id=$2',[bid,uid]))[0]?.role;
const teamRole=async(uid,tid)=>(await q('select role from team_members where team_id=$1 and user_id=$2',[tid,uid]))[0]?.role;
const byBoard=async r=>r.params.id;
const byCol=async r=>(await q('select board_id from columns where id=$1',[r.params.id]))[0]?.board_id;
const byTask=async r=>(await q('select c.board_id from tasks t join columns c on c.id=t.column_id where t.id=$1',[r.params.id]))[0]?.board_id;
const guard=(min,find)=>wrap(async(req,res,next)=>{const bid=await find(req);const role=bid&&await boardRole(req.user.id,bid);
  if(!role)return res.status(403).json({error:'Accès refusé'});
  if(RANK[role]<RANK[min])return res.status(403).json({error:'Permission insuffisante pour votre rôle'});
  req.boardId=bid;next()});
const notify=(req,message)=>io.to('b'+req.boardId).emit('board:changed',{message,by:req.user.name,byId:req.user.id});
const sign=u=>({token:jwt.sign({id:u.id,name:u.name},SECRET,{expiresIn:'7d'}),user:{id:u.id,name:u.name,email:u.email}});

io.use((s,next)=>{try{s.user=jwt.verify(s.handshake.auth.token,SECRET);next()}catch{next(new Error('auth'))}});
io.on('connection',s=>s.on('join',async id=>{if(await boardRole(s.user.id,id))s.join('b'+id)}));

app.post('/api/auth/register',wrap(async(req,res)=>{const{name,email,password}=req.body;
  if(!name||!email||!password||password.length<6)return res.status(400).json({error:'Nom, email et mot de passe (6 caractères min.) requis'});
  if((await q('select 1 from users where email=$1',[email.toLowerCase()])).length)return res.status(409).json({error:'Email déjà utilisé'});
  const u=(await q('insert into users(name,email,password_hash) values($1,$2,$3) returning *',[name,email.toLowerCase(),await bcrypt.hash(password,10)]))[0];
  res.json(sign(u))}));
app.post('/api/auth/login',wrap(async(req,res)=>{const u=(await q('select * from users where email=$1',[(req.body.email||'').toLowerCase()]))[0];
  if(!u||!await bcrypt.compare(req.body.password||'',u.password_hash))return res.status(401).json({error:'Identifiants incorrects'});
  res.json(sign(u))}));

app.get('/api/teams',auth,wrap(async(req,res)=>{
  const teams=await q('select t.id,t.name,tm.role from teams t join team_members tm on tm.team_id=t.id where tm.user_id=$1 order by t.id',[req.user.id]);
  for(const t of teams){t.boards=await q('select id,name from boards where team_id=$1 order by id',[t.id]);
    t.members=await q('select u.id,u.name,u.email,tm.role from team_members tm join users u on u.id=tm.user_id where tm.team_id=$1',[t.id])}
  res.json(teams)}));
app.post('/api/teams',auth,wrap(async(req,res)=>{
  const t=(await q('insert into teams(name) values($1) returning *',[req.body.name]))[0];
  await q('insert into team_members values($1,$2,$3)',[t.id,req.user.id,'admin']);res.json(t)}));
app.post('/api/teams/:id/members',auth,wrap(async(req,res)=>{
  if(await teamRole(req.user.id,req.params.id)!=='admin')return res.status(403).json({error:'Réservé aux administrateurs'});
  const{email,role}=req.body;if(!RANK[role])return res.status(400).json({error:'Rôle invalide'});
  const u=(await q('select id from users where email=$1',[(email||'').toLowerCase()]))[0];
  if(!u)return res.status(404).json({error:'Aucun compte avec cet email'});
  await q('insert into team_members values($1,$2,$3) on conflict(team_id,user_id) do update set role=$3',[req.params.id,u.id,role]);res.json({ok:true})}));
app.post('/api/teams/:id/boards',auth,wrap(async(req,res)=>{
  const r=await teamRole(req.user.id,req.params.id);if(!r||RANK[r]<2)return res.status(403).json({error:'Permission insuffisante'});
  const b=(await q('insert into boards(team_id,name) values($1,$2) returning *',[req.params.id,req.body.name]))[0];
  for(const[i,t]of['À faire','En cours','Terminé'].entries())await q('insert into columns(board_id,title,position) values($1,$2,$3)',[b.id,t,i]);
  res.json(b)}));
app.get('/api/boards/:id',auth,guard('viewer',byBoard),wrap(async(req,res)=>{
  const board=(await q('select * from boards where id=$1',[req.boardId]))[0];
  const columns=await q('select * from columns where board_id=$1 order by position',[req.boardId]);
  for(const c of columns)c.tasks=await q('select * from tasks where column_id=$1 order by position',[c.id]);
  res.json({board,role:await boardRole(req.user.id,req.boardId),columns})}));

app.post('/api/boards/:id/columns',auth,guard('member',byBoard),wrap(async(req,res)=>{
  const c=(await q('insert into columns(board_id,title,position) values($1,$2,(select coalesce(max(position)+1,0) from columns where board_id=$1)) returning *',[req.boardId,req.body.title]))[0];
  notify(req,`a ajouté la colonne « ${c.title} »`);res.json(c)}));
app.patch('/api/columns/:id',auth,guard('member',byCol),wrap(async(req,res)=>{
  await q('update columns set title=$1 where id=$2',[req.body.title,req.params.id]);notify(req,`a renommé une colonne en « ${req.body.title} »`);res.json({ok:true})}));
app.delete('/api/columns/:id',auth,guard('admin',byCol),wrap(async(req,res)=>{
  await q('delete from columns where id=$1',[req.params.id]);notify(req,'a supprimé une colonne');res.json({ok:true})}));

app.post('/api/columns/:id/tasks',auth,guard('member',byCol),wrap(async(req,res)=>{
  const t=(await q('insert into tasks(column_id,title,position) values($1,$2,(select coalesce(max(position)+1,0) from tasks where column_id=$1)) returning *',[req.params.id,req.body.title]))[0];
  notify(req,`a créé la tâche « ${t.title} »`);res.json(t)}));
app.patch('/api/tasks/:id',auth,guard('member',byTask),wrap(async(req,res)=>{
  const{title,description}=req.body;
  await q('update tasks set title=coalesce($1,title),description=coalesce($2,description) where id=$3',[title,description,req.params.id]);
  notify(req,'a modifié une tâche');res.json({ok:true})}));
app.delete('/api/tasks/:id',auth,guard('member',byTask),wrap(async(req,res)=>{
  await q('delete from tasks where id=$1',[req.params.id]);notify(req,'a supprimé une tâche');res.json({ok:true})}));
app.post('/api/tasks/:id/move',auth,guard('member',byTask),wrap(async(req,res)=>{
  const{columnId,index}=req.body;
  const dest=(await q('select board_id,title from columns where id=$1',[columnId]))[0];
  if(!dest||dest.board_id!=req.boardId)return res.status(400).json({error:'Colonne invalide'});
  const ids=(await q('select id from tasks where column_id=$1 and id<>$2 order by position',[columnId,req.params.id])).map(r=>r.id);
  ids.splice(index,0,+req.params.id);
  for(let i=0;i<ids.length;i++)await q('update tasks set column_id=$1,position=$2 where id=$3',[columnId,i,ids[i]]);
  notify(req,`a déplacé une tâche vers « ${dest.title} »`);res.json({ok:true})}));

server.listen(process.env.PORT||4000,()=>console.log('API sur http://localhost:'+(process.env.PORT||4000)));
