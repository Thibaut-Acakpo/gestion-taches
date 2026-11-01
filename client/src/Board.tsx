import {useCallback,useEffect,useState} from 'react';
import {DragDropContext,Droppable,Draggable,DropResult} from '@hello-pangea/dnd';
import {io} from 'socket.io-client';
import {api,API,getToken} from './api';
import {Modal,Toast} from './Dialog';

type Task={id:number;title:string;description:string};
type Col={id:number;title:string;tasks:Task[]};
type Toast={id:number;text:string};
type DialogField={name:string;label:string;value?:string;required?:boolean;multiline?:boolean};
type DialogState={title:string;description?:string;submitLabel:string;danger?:boolean;fields?:DialogField[];onSubmit:(values:Record<string,string>)=>Promise<void>};

export default function Board({id,me}:{id:number;me:number}){
  const [data,setData]=useState<{board:{name:string};role:string;columns:Col[]}|null>(null);
  const [loading,setLoading]=useState(true);const [loadError,setLoadError]=useState('');const [search,setSearch]=useState('');
  const [focusTaskId,setFocusTaskId]=useState('');const [focusSeconds,setFocusSeconds]=useState(25*60);const [focusRunning,setFocusRunning]=useState(false);const [focusSessions,setFocusSessions]=useState(0);
  const [toasts,setToasts]=useState<Toast[]>([]);
  const [dialog,setDialog]=useState<DialogState|null>(null);const [dialogError,setDialogError]=useState('');const [busy,setBusy]=useState(false);
  const toast=(text:string)=>{const item={id:Date.now()+Math.random(),text};setToasts(current=>[...current,item]);window.setTimeout(()=>setToasts(current=>current.filter(value=>value.id!==item.id)),3500)};
  const load=useCallback(()=>{setLoading(true);setLoadError('');return api(`/boards/${id}`).then(setData).catch(caught=>{setLoadError(caught instanceof Error?caught.message:'Impossible de charger ce tableau.')}).finally(()=>setLoading(false))},[id]);
  useEffect(()=>{load();
    const s=io(API,{auth:{token:getToken()}});s.on('connect',()=>s.emit('join',id));
    s.on('board:changed',(message:{message:string;by:string;byId:number})=>{
      if(message.byId!==me)toast(`${message.by} ${message.message}`);
      load()});
    return()=>{s.disconnect()}},[id,me,load]);
  useEffect(()=>{
    if(!focusRunning)return;
    if(focusSeconds===0){setFocusRunning(false);setFocusSessions(sessions=>sessions+1);return}
    const timer=window.setTimeout(()=>setFocusSeconds(seconds=>Math.max(0,seconds-1)),1000);
    return()=>window.clearTimeout(timer);
  },[focusRunning,focusSeconds]);
  useEffect(()=>{
    if(data&&focusTaskId&&!data.columns.some(column=>column.tasks.some(task=>String(task.id)===focusTaskId))){
      setFocusRunning(false);setFocusTaskId('');setFocusSeconds(25*60);
    }
  },[data,focusTaskId]);
  if(!data)return <div className="board-state">{loading?<><span className="loading-spinner" aria-hidden="true"/><p className="eyebrow">TABLEAU</p><h2>Chargement du tableau…</h2></>:<><div className="empty-symbol" aria-hidden="true">!</div><p className="eyebrow">TABLEAU INDISPONIBLE</p><h2>Impossible d’ouvrir ce tableau</h2><p>{loadError}</p><button className="btn primary" onClick={load}>Réessayer</button></>}</div>;
  const canEdit=data.role!=='viewer',isAdmin=data.role==='admin';
  const totalTasks=data.columns.reduce((total,column)=>total+column.tasks.length,0);
  const searchTerm=search.trim().toLocaleLowerCase('fr');
  const focusChoices=data.columns.filter(column=>!/(termin|done|complete|archiv)/i.test(column.title)).flatMap(column=>column.tasks.map(task=>({task,column})));
  const selectedFocus=focusChoices.find(item=>String(item.task.id)===focusTaskId);
  const minutes=String(Math.floor(focusSeconds/60)).padStart(2,'0');
  const seconds=String(focusSeconds%60).padStart(2,'0');
  const openDialog=(next:DialogState)=>{setDialogError('');setDialog(next)};
  const submitDialog=async(event:React.FormEvent<HTMLFormElement>)=>{event.preventDefault();if(!dialog)return;setDialogError('');setBusy(true);
    const values:Record<string,string>={};new FormData(event.currentTarget).forEach((value,key)=>{values[key]=String(value)});
    try{await dialog.onSubmit(values);setDialog(null);setBusy(false);toast(`${dialog.title} : opération effectuée.`)}
    catch(caught){setDialogError(caught instanceof Error?caught.message:'Une erreur est survenue.');setBusy(false)}};
  const renameColumn=(column:Col)=>openDialog({title:'Renommer la colonne',submitLabel:'Enregistrer',fields:[{name:'title',label:'Nom de la colonne',value:column.title,required:true}],onSubmit:async values=>{await api(`/columns/${column.id}`,'PATCH',{title:values.title.trim()});await load()}});
  const deleteColumn=(column:Col)=>openDialog({title:'Supprimer cette colonne ?',description:`« ${column.title} » et les ${column.tasks.length} tâche${column.tasks.length===1?'':'s'} qu’elle contient seront supprimées. Cette action est irréversible.`,submitLabel:'Supprimer la colonne',danger:true,onSubmit:async()=>{await api(`/columns/${column.id}`,'DELETE');await load()}});
  const editTask=(task:Task)=>openDialog({title:'Modifier la tâche',submitLabel:'Enregistrer',fields:[{name:'title',label:'Titre',value:task.title,required:true},{name:'description',label:'Description',value:task.description||'',multiline:true}],onSubmit:async values=>{await api(`/tasks/${task.id}`,'PATCH',{title:values.title.trim(),description:values.description});await load()}});
  const deleteTask=(task:Task)=>openDialog({title:'Supprimer cette tâche ?',description:`La tâche « ${task.title} » sera supprimée définitivement.`,submitLabel:'Supprimer la tâche',danger:true,onSubmit:async()=>{await api(`/tasks/${task.id}`,'DELETE');await load()}});
  const addColumn=()=>openDialog({title:'Ajouter une colonne',submitLabel:'Ajouter la colonne',fields:[{name:'title',label:'Nom de la colonne',required:true}],onSubmit:async values=>{await api(`/boards/${id}/columns`,'POST',{title:values.title.trim()});await load()}});
  const addTask=(column:Col)=>openDialog({title:'Ajouter une tâche',description:`Nouvelle tâche dans « ${column.title} ».`,submitLabel:'Ajouter la tâche',fields:[{name:'title',label:'Titre de la tâche',required:true}],onSubmit:async values=>{await api(`/columns/${column.id}/tasks`,'POST',{title:values.title.trim()});await load()}});
  const onDragEnd=(r:DropResult)=>{
    if(!r.destination)return;const{source:s,destination:d}=r;if(s.droppableId===d.droppableId&&s.index===d.index)return;
    const cols=data.columns.map(c=>({...c,tasks:[...c.tasks]}));
    const from=cols.find(c=>String(c.id)===s.droppableId)!,to=cols.find(c=>String(c.id)===d.droppableId)!;
    const[t]=from.tasks.splice(s.index,1);to.tasks.splice(d.index,0,t);
    setData({...data,columns:cols});
    api(`/tasks/${r.draggableId}/move`,'POST',{columnId:+d.droppableId,index:d.index}).catch(()=>load());
  };
  return <div className="board">
    <header className="board-header">
      <div className="board-heading"><div className="board-title"><p className="eyebrow">VOTRE ESPACE DE TRAVAIL <span aria-hidden="true">/</span> TABLEAU</p><h1>{data.board.name}</h1></div><span className="board-stat">{totalTasks} {totalTasks===1?'carte':'cartes'}</span></div>
      <div className="board-tools">
        <label className="search-box"><span aria-hidden="true">⌕</span><input aria-label="Rechercher dans les cartes" placeholder="Rechercher une carte…" value={search} onChange={event=>setSearch(event.target.value)}/>{search&&<button type="button" aria-label="Effacer la recherche" onClick={()=>setSearch('')}>×</button>}</label>
        <span className="role">{data.role==='viewer'?'Lecture seule':data.role==='admin'?'Administrateur':'Membre'}</span>
      </div>
    </header>
    <section className={'focus-studio'+(focusRunning?' focus-active':'')} aria-label="Sprint Focus">
      <div className="focus-mark" aria-hidden="true">{focusRunning?'◉':'✳'}</div>
      <div className="focus-copy"><span className="focus-kicker">SPRINT FOCUS</span><strong>{selectedFocus?selectedFocus.task.title:'Choisissez votre prochaine action'}</strong><span>{selectedFocus?`Dans « ${selectedFocus.column.title} »`:'Un temps calme pour faire avancer une carte, sans vous disperser.'}</span></div>
      <label className="focus-select-label"><span>SE CONCENTRER SUR</span><select aria-label="Choisir la carte du sprint" value={focusTaskId} onChange={event=>setFocusTaskId(event.target.value)} disabled={focusRunning}><option value="">Choisir une carte…</option>{focusChoices.map(({task,column})=><option key={task.id} value={task.id}>{column.title} · {task.title}</option>)}</select></label>
      <div className="focus-timer" aria-live="polite"><span>{minutes}:{seconds}</span><small>{focusRunning?'EN COURS':focusSeconds===0?'SPRINT TERMINÉ':'25 MIN'}</small></div>
      <div className="focus-actions">
        {focusRunning?<button className="focus-button pause" onClick={()=>setFocusRunning(false)}>Pause</button>:<button className="focus-button" disabled={!selectedFocus} onClick={()=>{if(focusSeconds===0)setFocusSeconds(25*60);setSearch('');setFocusRunning(true)}}>{focusSeconds===0?'Recommencer':'Démarrer'}</button>}
        {(focusRunning||focusSeconds!==25*60)&&<button className="focus-reset" aria-label="Réinitialiser le sprint" title="Réinitialiser" onClick={()=>{setFocusRunning(false);setFocusSeconds(25*60)}}>↺</button>}
      </div>
      <span className="focus-completed" aria-label={`${focusSessions} sprint${focusSessions===1?'':'s'} terminé${focusSessions===1?'':'s'}`}><strong>{focusSessions}</strong><small>SPRINT{focusSessions===1?'':'S'}<br/>TERMINÉ{focusSessions===1?'':'S'}</small></span>
    </section>
    <DragDropContext onDragEnd={onDragEnd}><div className="cols" aria-label="Colonnes des tâches">
      {data.columns.map(c=>{const visibleTasks=c.tasks.filter(task=>!searchTerm||`${task.title} ${task.description||''}`.toLocaleLowerCase('fr').includes(searchTerm));return <div className="col" key={c.id}>
        <div className="col-h"><h3>{c.title}</h3><span className="count">{c.tasks.length}</span>
          {canEdit&&<button className="icon-button" aria-label="Renommer la colonne" title="Renommer la colonne" onClick={()=>renameColumn(c)}>✎</button>}
          {isAdmin&&<button className="icon-button" aria-label="Supprimer la colonne" title="Supprimer la colonne" onClick={()=>deleteColumn(c)}>×</button>}
        </div>
        <Droppable droppableId={String(c.id)}>{(p,snap)=><div ref={p.innerRef} {...p.droppableProps} className={'list'+(snap.isDraggingOver?' over':'')}>
          {visibleTasks.length===0&&<p className="list-empty">{searchTerm?'Aucune carte correspondante':'Aucune carte pour le moment'}</p>}
          {visibleTasks.map(t=>{const i=c.tasks.findIndex(task=>task.id===t.id);return <Draggable key={t.id} draggableId={String(t.id)} index={i} isDragDisabled={!canEdit||Boolean(searchTerm)}>{(p2,s2)=>
            <div ref={p2.innerRef} {...p2.draggableProps} {...p2.dragHandleProps} className={'card'+(s2.isDragging?' drag':'')+(focusRunning&&focusTaskId===String(t.id)?' card-in-focus':'')+(focusRunning&&focusTaskId!==String(t.id)?' card-out-of-focus':'')}>
              <div className="task-copy"><strong>{t.title}</strong>{t.description&&<p>{t.description}</p>}</div>
              {canEdit&&<div className="task-actions"><button className="icon-button" aria-label={`Modifier ${t.title}`} title="Modifier la tâche" onClick={event=>{event.stopPropagation();editTask(t)}}>✎</button><button className="icon-button delete-icon" aria-label={`Supprimer ${t.title}`} title="Supprimer la tâche" onClick={event=>{event.stopPropagation();deleteTask(t)}}>×</button></div>}
            </div>}</Draggable>})}
          {p.placeholder}</div>}</Droppable>
        {canEdit&&<button className="add-task" onClick={()=>addTask(c)}>＋ Ajouter une tâche</button>}
      </div>})}
      {canEdit&&<button className="col add-col" onClick={addColumn}>＋ Ajouter une colonne</button>}
    </div></DragDropContext>
    {dialog&&<Modal title={dialog.title} description={dialog.description} onClose={()=>setDialog(null)}><form className="dialog-form" onSubmit={submitDialog}>
      {dialog.fields?.map(field=><label key={field.name}>{field.label}{field.multiline?<textarea name={field.name} defaultValue={field.value} rows={4}/>:<input name={field.name} defaultValue={field.value} required={field.required} autoFocus/>}</label>)}
      {dialogError&&<div className="form-error" role="alert">{dialogError}</div>}
      <div className="modal-actions"><button type="button" className="btn secondary" onClick={()=>setDialog(null)}>Annuler</button><button className={`btn ${dialog.danger?'danger':'primary'}`} disabled={busy}>{busy?'Veuillez patienter…':dialog.submitLabel}</button></div>
    </form></Modal>}
    <div className="toasts">{toasts.map(item=><Toast key={item.id} message={item.text}/>)}</div>
  </div>;
}
