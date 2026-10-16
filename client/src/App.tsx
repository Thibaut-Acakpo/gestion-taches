import {useEffect,useState} from 'react';
import {api} from './api';
import Board from './Board';
import {Modal,Toast} from './Dialog';

type Team={id:number;name:string;role:string;boards:{id:number;name:string}[];members:{id:number;name:string;email:string;role:string}[]};
type User={id:number;name:string;email:string};
type Field={name:string;label:string;type?:'text'|'email'|'password'|'select';value?:string;required?:boolean;minLength?:number;options?:{value:string;label:string}[]};
type DialogState={title:string;description?:string;fields?:Field[];submitLabel:string;danger?:boolean;onSubmit:(values:Record<string,string>)=>Promise<void>};

function Auth({onDone}:{onDone:(u:User)=>void}){
  const [mode,setMode]=useState<'login'|'register'>('login');
  const [form,setForm]=useState({name:'',email:'',password:''});
  const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  const submit=async(event:React.FormEvent)=>{event.preventDefault();setError('');setBusy(true);
    try{const data=await api(`/auth/${mode}`,'POST',form);localStorage.setItem('token',data.token);localStorage.setItem('user',JSON.stringify(data.user));onDone(data.user)}
    catch(caught){setError(caught instanceof Error?caught.message:'Une erreur est survenue.');setBusy(false)}};
  return <div className="auth"><form onSubmit={submit} className="auth-card">
    <div className="brand-mark" aria-hidden="true">GT</div>
    <p className="eyebrow">ORGANISATION D'ÉQUIPE</p><h1>GestionTâches</h1>
    <p className="auth-intro">{mode==='login'?'Retrouvez vos équipes et reprenez là où vous en étiez.':'Créez votre espace pour organiser les projets de votre équipe.'}</p>
    {mode==='register'&&<label>Nom complet<input autoComplete="name" placeholder="Votre nom" value={form.name} onChange={event=>setForm({...form,name:event.target.value})} required/></label>}
    <label>Adresse e-mail<input type="email" autoComplete="email" placeholder="nom@exemple.com" value={form.email} onChange={event=>setForm({...form,email:event.target.value})} required/></label>
    <label>Mot de passe<input type="password" autoComplete={mode==='login'?'current-password':'new-password'} placeholder="6 caractères minimum" value={form.password} onChange={event=>setForm({...form,password:event.target.value})} minLength={mode==='register'?6:undefined} required/></label>
    {error&&<div className="form-error" role="alert">{error}</div>}
    <button className="btn primary" disabled={busy}>{busy?'Veuillez patienter…':mode==='login'?'Se connecter':'Créer mon compte'}</button>
    <button className="text-button auth-switch" type="button" onClick={()=>{setMode(mode==='login'?'register':'login');setError('')}}>{mode==='login'?'Pas encore de compte ? Créer un compte':'Déjà inscrit ? Se connecter'}</button>
  </form></div>;
}

export default function App(){
  const [user,setUser]=useState<User|null>(()=>{const value=localStorage.getItem('user');try{return value?JSON.parse(value):null}catch{return null}});
  const [teams,setTeams]=useState<Team[]>([]);const [boardId,setBoardId]=useState<number|null>(null);
  const [dialog,setDialog]=useState<DialogState|null>(null);const [error,setError]=useState('');const [busy,setBusy]=useState(false);const [notice,setNotice]=useState('');
  const notify=(message:string)=>{setNotice(message);window.setTimeout(()=>setNotice(''),3500)};
  const load=()=>api<Team[]>('/teams').then(setTeams).catch(()=>{localStorage.removeItem('token');localStorage.removeItem('user');setUser(null);setTeams([])});
  useEffect(()=>{if(user)load()},[user]);
  const openDialog=(next:DialogState)=>{setError('');setDialog(next)};
  const submitDialog=async(event:React.FormEvent<HTMLFormElement>)=>{event.preventDefault();if(!dialog)return;setError('');setBusy(true);
    const values:Record<string,string>={};new FormData(event.currentTarget).forEach((value,key)=>{values[key]=String(value)});
    try{await dialog.onSubmit(values);setDialog(null);setBusy(false);notify(`${dialog.title} : opération effectuée.`)}
    catch(caught){setError(caught instanceof Error?caught.message:'Une erreur est survenue.');setBusy(false)}};
  const openLogout=()=>openDialog({title:'Se déconnecter ?',description:'Votre session sera fermée sur cet appareil.',submitLabel:'Se déconnecter',danger:true,onSubmit:async()=>{localStorage.removeItem('token');localStorage.removeItem('user');setUser(null);setTeams([]);setBoardId(null);notify('Vous êtes déconnecté.')}});
  const openCreateTeam=()=>openDialog({title:'Créer une équipe',description:'Les personnes de cette équipe pourront partager leurs tableaux.',submitLabel:'Créer l’équipe',fields:[{name:'name',label:'Nom de l’équipe',required:true}],onSubmit:async values=>{await api('/teams','POST',{name:values.name.trim()});await load()}});
  const openCreateBoard=(team:Team)=>openDialog({title:'Créer un tableau',description:`Nouveau tableau dans « ${team.name} ».`,submitLabel:'Créer le tableau',fields:[{name:'name',label:'Nom du tableau',required:true}],onSubmit:async values=>{const board=await api<{id:number}>(`/teams/${team.id}/boards`,'POST',{name:values.name.trim()});await load();setBoardId(board.id)}});
  const openInvite=(team:Team)=>openDialog({title:'Inviter un membre',description:`Ajoutez un compte existant à « ${team.name} ».`,submitLabel:'Ajouter le membre',fields:[{name:'email',label:'Adresse e-mail',type:'email',required:true},{name:'role',label:'Rôle',type:'select',value:'member',options:[{value:'admin',label:'Administrateur'},{value:'member',label:'Membre'},{value:'viewer',label:'Lecture seule'}]}],onSubmit:async values=>{await api(`/teams/${team.id}/members`,'POST',{email:values.email.trim(),role:values.role});await load()}});
  return <>
    {!user?<Auth onDone={setUser}/>:<div className="layout">
      <aside>
        <div className="sidebar-brand"><div className="brand-mark small-mark" aria-hidden="true">GT</div><div><strong>GestionTâches</strong><span>ESPACE DE TRAVAIL</span></div></div>
        <div className="team-list">{teams.map(team=><section key={team.id} className="team">
          <div className="team-h"><strong>{team.name}</strong><span className="role">{team.role==='viewer'?'Lecture seule':team.role==='admin'?'Admin':'Membre'}</span></div>
          <nav aria-label={`Tableaux de ${team.name}`}>{team.boards.map(board=><button key={board.id} className={'nav'+(board.id===boardId?' on':'')} onClick={()=>setBoardId(board.id)}>{board.name}</button>)}</nav>
          {team.role!=='viewer'&&<button className="link" onClick={()=>openCreateBoard(team)}>＋ Nouveau tableau</button>}
          {team.role==='admin'&&<button className="link" onClick={()=>openInvite(team)}>＋ Inviter un membre</button>}
          <p className="member-list">{team.members.length} {team.members.length===1?'membre':'membres'} · {team.members.map(member=>member.name).join(', ')}</p>
        </section>)}</div>
        <button className="btn secondary full-width" onClick={openCreateTeam}>＋ Nouvelle équipe</button>
        <div className="sidebar-footer"><div className="avatar" aria-hidden="true">{user.name.charAt(0).toUpperCase()}</div><div className="account"><strong>{user.name}</strong><span>{user.email}</span></div><button className="icon-button logout-button" aria-label="Se déconnecter" title="Se déconnecter" onClick={openLogout}>↪</button></div>
      </aside>
      <main>{boardId?<Board key={boardId} id={boardId} me={user.id}/>:<div className="empty"><div className="empty-symbol" aria-hidden="true">▦</div><p className="eyebrow">VOTRE ESPACE DE TRAVAIL</p><h2>Choisissez un tableau</h2><p>Sélectionnez un tableau dans la barre latérale, ou créez-en un pour commencer à organiser vos tâches.</p>{teams.length===0&&<button className="btn primary" onClick={openCreateTeam}>Créer ma première équipe</button>}</div>}</main>
    </div>}
    {dialog&&<Modal title={dialog.title} description={dialog.description} onClose={()=>setDialog(null)}><form className="dialog-form" onSubmit={submitDialog}>
      {dialog.fields?.map(field=><label key={field.name}>{field.label}{field.type==='select'?<select name={field.name} defaultValue={field.value} required={field.required}>{field.options?.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select>:<input name={field.name} type={field.type||'text'} defaultValue={field.value} required={field.required} minLength={field.minLength} autoFocus/>}</label>)}
      {error&&<div className="form-error" role="alert">{error}</div>}
      <div className="modal-actions"><button type="button" className="btn secondary" onClick={()=>setDialog(null)}>Annuler</button><button className={`btn ${dialog.danger?'danger':'primary'}`} disabled={busy}>{busy?'Veuillez patienter…':dialog.submitLabel}</button></div>
    </form></Modal>}
    {notice&&<div className="global-toast"><Toast message={notice}/></div>}
  </>;
}
