import {useEffect,useState} from 'react';
import {api} from './api';
import Board from './Board';
import {Modal,Toast} from './Dialog';

type Team={id:number;name:string;role:string;boards:{id:number;name:string}[];members:{name:string}[]};
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
  return <div className="auth">
    <section className="auth-showcase">
      <div className="auth-showcase-brand"><div className="brand-mark" aria-hidden="true">GT</div><span>GestionTâches</span></div>
      <div className="showcase-content">
        <p className="eyebrow">LE TRAVAIL D'ÉQUIPE, ENFIN FLUIDE</p>
        <h2>Les idées avancent<br/>quand tout est clair.</h2>
        <p>Rassemblez vos projets, partagez les tâches et gardez toute l’équipe sur la même longueur d’onde.</p>
        <div className="showcase-board" aria-hidden="true">
          <div className="showcase-column"><span>À faire</span><i/><i/><i/></div>
          <div className="showcase-column"><span>En cours</span><i/><i/></div>
          <div className="showcase-column"><span>Terminé</span><i/><i/></div>
        </div>
      </div>
      <span className="showcase-caption">UN ESPACE POUR FAIRE AVANCER VOS PROJETS</span>
    </section>
    <form onSubmit={submit} className="auth-card">
      <div className="auth-form-heading"><p className="eyebrow">{mode==='login'?'BON RETOUR':'VOTRE ESPACE VOUS ATTEND'}</p><h1>{mode==='login'?'Connectez-vous':'Créer un compte'}</h1>
      <p className="auth-intro">{mode==='login'?'Retrouvez vos équipes et reprenez là où vous en étiez.':'Créez votre espace pour organiser les projets de votre équipe.'}</p></div>
      {mode==='register'&&<label>Nom complet<input autoComplete="name" placeholder="Votre nom" value={form.name} onChange={event=>setForm({...form,name:event.target.value})} required/></label>}
      <label>Adresse e-mail<input type="email" autoComplete="email" placeholder="nom@exemple.com" value={form.email} onChange={event=>setForm({...form,email:event.target.value})} required/></label>
      <label>Mot de passe<input type="password" autoComplete={mode==='login'?'current-password':'new-password'} placeholder="6 caractères minimum" value={form.password} onChange={event=>setForm({...form,password:event.target.value})} minLength={mode==='register'?6:undefined} required/></label>
      {error&&<div className="form-error" role="alert">{error}</div>}
      <button className="btn primary" disabled={busy}>{busy?'Veuillez patienter…':mode==='login'?'Se connecter':'Créer mon compte'}</button>
      <button className="text-button auth-switch" type="button" onClick={()=>{setMode(mode==='login'?'register':'login');setError('')}}>{mode==='login'?'Pas encore de compte ? Créer un compte':'Déjà inscrit ? Se connecter'}</button>
    </form>
  </div>;
}

function WorkspaceHome({teams,name,onSelect,onCreateTeam,onCreateBoard}:{teams:Team[];name:string;onSelect:(id:number)=>void;onCreateTeam:()=>void;onCreateBoard:(team:Team)=>void}){
  const boards=teams.flatMap(team=>team.boards.map(board=>({...board,team})));
  const memberCount=teams.reduce((total,team)=>total+team.members.length,0);
  return <div className="workspace-home">
    <header className="home-welcome"><div><p className="eyebrow">VOTRE ESPACE DE TRAVAIL</p><h2>Bonjour, {name.split(' ')[0]} <span aria-hidden="true">✦</span></h2><p>Vos projets, vos équipes et vos prochaines idées au même endroit.</p></div><div className="home-welcome-mark" aria-hidden="true">✳</div></header>
    <section className="home-stats" aria-label="Résumé de l’espace de travail">
      <article><span>ÉQUIPES</span><strong>{teams.length}</strong><small>espace{teams.length===1?'':'s'} partagé{teams.length===1?'':'s'}</small></article>
      <article><span>TABLEAUX</span><strong>{boards.length}</strong><small>{boards.length===1?'projet à suivre':'projets à suivre'}</small></article>
      <article><span>MEMBRES</span><strong>{memberCount}</strong><small>dans vos équipes</small></article>
    </section>
    <section className="home-boards">
      <div className="home-section-heading"><div><p className="eyebrow">REPRENDRE LE FIL</p><h3>Vos tableaux</h3></div><span>{boards.length} au total</span></div>
      {boards.length>0?<div className="home-board-grid">{boards.map(board=><button key={board.id} className="home-board-card" onClick={()=>onSelect(board.id)}>
        <span className="home-board-icon" aria-hidden="true">▦</span><span className="home-board-team">{board.team.name}</span><strong>{board.name}</strong><span className="home-board-bottom"><span className="home-mini-avatar" aria-hidden="true">{board.team.name.charAt(0).toUpperCase()}</span>{board.team.members.length} {board.team.members.length===1?'membre':'membres'}<span className="home-board-arrow" aria-hidden="true">↗</span></span>
      </button>)}</div>:<div className="home-no-boards"><div className="empty-symbol" aria-hidden="true">▦</div><h3>{teams.length===0?'Votre prochain projet commence ici':'Aucun tableau pour le moment'}</h3><p>{teams.length===0?'Créez une équipe et transformez vos idées en prochaines actions.':'Demandez à un administrateur de créer un tableau ou démarrez-en un dans une équipe où vous avez les droits.'}</p>{teams.length===0?<button className="btn primary" onClick={onCreateTeam}>Créer ma première équipe</button>:teams.filter(team=>team.role!=='viewer').map(team=><button key={team.id} className="btn primary" onClick={()=>onCreateBoard(team)}>Créer un tableau dans {team.name}</button>)}</div>}
    </section>
  </div>;
}

export default function App(){
  const [user,setUser]=useState<User|null>(()=>{const value=localStorage.getItem('user');try{return value?JSON.parse(value):null}catch{return null}});
  const [teams,setTeams]=useState<Team[]>([]);const [boardId,setBoardId]=useState<number|null>(null);
  const [menuOpen,setMenuOpen]=useState(false);
  const [dialog,setDialog]=useState<DialogState|null>(null);const [error,setError]=useState('');const [busy,setBusy]=useState(false);const [notice,setNotice]=useState('');
  const notify=(message:string)=>{setNotice(message);window.setTimeout(()=>setNotice(''),3500)};
  const load=()=>api<Team[]>('/teams').then(setTeams).catch(()=>{localStorage.removeItem('token');localStorage.removeItem('user');setUser(null);setTeams([])});
  useEffect(()=>{if(user)load()},[user]);
  useEffect(()=>{
    if(!menuOpen)return;
    const closeOnEscape=(event:KeyboardEvent)=>{if(event.key==='Escape')setMenuOpen(false)};
    document.addEventListener('keydown',closeOnEscape);
    return()=>document.removeEventListener('keydown',closeOnEscape);
  },[menuOpen]);
  const openDialog=(next:DialogState)=>{setError('');setMenuOpen(false);setDialog(next)};
  const submitDialog=async(event:React.FormEvent<HTMLFormElement>)=>{event.preventDefault();if(!dialog)return;setError('');setBusy(true);
    const values:Record<string,string>={};new FormData(event.currentTarget).forEach((value,key)=>{values[key]=String(value)});
    try{await dialog.onSubmit(values);setDialog(null);setBusy(false);notify(`${dialog.title} : opération effectuée.`)}
    catch(caught){setError(caught instanceof Error?caught.message:'Une erreur est survenue.');setBusy(false)}};
  const openLogout=()=>openDialog({title:'Se déconnecter ?',description:'Votre session sera fermée sur cet appareil.',submitLabel:'Se déconnecter',danger:true,onSubmit:async()=>{localStorage.removeItem('token');localStorage.removeItem('user');setUser(null);setTeams([]);setBoardId(null);notify('Vous êtes déconnecté.')}});
  const openCreateTeam=()=>openDialog({title:'Créer une équipe',description:'Les personnes de cette équipe pourront partager leurs tableaux.',submitLabel:'Créer l’équipe',fields:[{name:'name',label:'Nom de l’équipe',required:true}],onSubmit:async values=>{await api('/teams','POST',{name:values.name.trim()});await load()}});
  const openCreateBoard=(team:Team)=>openDialog({title:'Créer un tableau',description:`Nouveau tableau dans « ${team.name} ».`,submitLabel:'Créer le tableau',fields:[{name:'name',label:'Nom du tableau',required:true}],onSubmit:async values=>{const board=await api<{id:number}>(`/teams/${team.id}/boards`,'POST',{name:values.name.trim()});await load();setBoardId(board.id)}});
  const openInvite=(team:Team)=>openDialog({title:'Inviter un membre',description:`Ajoutez un compte existant à « ${team.name} ».`,submitLabel:'Ajouter le membre',fields:[{name:'email',label:'Adresse e-mail',type:'email',required:true},{name:'role',label:'Rôle',type:'select',value:'member',options:[{value:'admin',label:'Administrateur'},{value:'member',label:'Membre'},{value:'viewer',label:'Lecture seule'}]}],onSubmit:async values=>{await api(`/teams/${team.id}/members`,'POST',{email:values.email.trim(),role:values.role});await load()}});
  return <>
    {!user?<Auth onDone={setUser}/>:<div className={'layout'+(menuOpen?' menu-open':'')}>
      <button className="menu-backdrop" aria-label="Fermer le menu" tabIndex={menuOpen?0:-1} onClick={()=>setMenuOpen(false)}/>
      <aside id="workspace-menu" aria-label="Menu de navigation">
        <div className="sidebar-brand"><div className="brand-mark small-mark" aria-hidden="true">GT</div><div><strong>GestionTâches</strong><span>ESPACE DE TRAVAIL</span></div><button className="menu-close" aria-label="Fermer le menu" onClick={()=>setMenuOpen(false)}>×</button></div>
        <div className="team-list">
          <div className="sidebar-section-title"><span>VOS ESPACES</span><span className="team-total">{teams.length}</span></div>
          {teams.map(team=><section key={team.id} className="team">
          <div className="team-h"><span className="team-avatar" aria-hidden="true">{team.name.charAt(0).toUpperCase()}</span><strong>{team.name}</strong><span className="role">{team.role==='viewer'?'Lecture seule':team.role==='admin'?'Admin':'Membre'}</span></div>
          <nav aria-label={`Tableaux de ${team.name}`}>{team.boards.map(board=><button key={board.id} className={'nav'+(board.id===boardId?' on':'')} onClick={()=>{setBoardId(board.id);setMenuOpen(false)}}>{board.name}</button>)}</nav>
          {team.role!=='viewer'&&<button className="link" onClick={()=>openCreateBoard(team)}>＋ Nouveau tableau</button>}
          {team.role==='admin'&&<button className="link" onClick={()=>openInvite(team)}>＋ Inviter un membre</button>}
          <p className="member-list">{team.members.length} {team.members.length===1?'membre':'membres'} · {team.members.map(member=>member.name).join(', ')}</p>
        </section>)}
          {teams.length===0&&<p className="sidebar-empty">Créez une équipe pour commencer à organiser vos tableaux.</p>}
        </div>
        <button className="btn secondary full-width" onClick={openCreateTeam}>＋ Nouvelle équipe</button>
        <div className="sidebar-footer"><div className="avatar" aria-hidden="true">{user.name.charAt(0).toUpperCase()}</div><div className="account"><strong>{user.name}</strong><span>{user.email}</span></div><button className="icon-button logout-button" aria-label="Se déconnecter" title="Se déconnecter" onClick={openLogout}>↪</button></div>
      </aside>
      <main><div className="workspace-toolbar"><button className="menu-toggle" aria-controls="workspace-menu" aria-expanded={menuOpen} onClick={()=>setMenuOpen(open=>!open)}><span aria-hidden="true">☰</span> Menu</button><span className="toolbar-brand">GestionTâches</span></div>{boardId?<Board key={boardId} id={boardId} me={user.id}/>:<WorkspaceHome teams={teams} name={user.name} onSelect={board=>{setBoardId(board);setMenuOpen(false)}} onCreateTeam={openCreateTeam} onCreateBoard={openCreateBoard}/>}</main>
    </div>}
    {dialog&&<Modal title={dialog.title} description={dialog.description} onClose={()=>setDialog(null)}><form className="dialog-form" onSubmit={submitDialog}>
      {dialog.fields?.map(field=><label key={field.name}>{field.label}{field.type==='select'?<select name={field.name} defaultValue={field.value} required={field.required}>{field.options?.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select>:<input name={field.name} type={field.type||'text'} defaultValue={field.value} required={field.required} minLength={field.minLength} autoFocus/>}</label>)}
      {error&&<div className="form-error" role="alert">{error}</div>}
      <div className="modal-actions"><button type="button" className="btn secondary" onClick={()=>setDialog(null)}>Annuler</button><button className={`btn ${dialog.danger?'danger':'primary'}`} disabled={busy}>{busy?'Veuillez patienter…':dialog.submitLabel}</button></div>
    </form></Modal>}
    {notice&&<div className="global-toast"><Toast message={notice}/></div>}
  </>;
}
