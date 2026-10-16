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
  const [toasts,setToasts]=useState<Toast[]>([]);
  const [dialog,setDialog]=useState<DialogState|null>(null);const [dialogError,setDialogError]=useState('');const [busy,setBusy]=useState(false);
  const toast=(text:string)=>{const item={id:Date.now()+Math.random(),text};setToasts(current=>[...current,item]);window.setTimeout(()=>setToasts(current=>current.filter(value=>value.id!==item.id)),3500)};
  const load=useCallback(()=>api(`/boards/${id}`).then(setData),[id]);
  useEffect(()=>{load();
    const s=io(API,{auth:{token:getToken()}});s.on('connect',()=>s.emit('join',id));
    s.on('board:changed',(message:{message:string;by:string;byId:number})=>{
      if(message.byId!==me)toast(`${message.by} ${message.message}`);
      load()});
    return()=>{s.disconnect()}},[id,me,load]);
  if(!data)return <div className="empty"><p className="eyebrow">TABLEAU</p><h2>Chargement du tableau…</h2></div>;
  const canEdit=data.role!=='viewer',isAdmin=data.role==='admin';
  const openDialog=(next:DialogState)=>{setDialogError('');setDialog(next)};
  const submitDialog=async(event:React.FormEvent<HTMLFormElement>)=>{event.preventDefault();if(!dialog)return;setDialogError('');setBusy(true);
    const values:Record<string,string>={};new FormData(event.currentTarget).forEach((value,key)=>{values[key]=String(value)});
    try{await dialog.onSubmit(values);setDialog(null);setBusy(false);toast(`${dialog.title} : opération effectuée.`)}
    catch(caught){setDialogError(caught instanceof Error?caught.message:'Une erreur est survenue.');setBusy(false)}};
  const renameColumn=(column:Col)=>openDialog({title:'Renommer la colonne',submitLabel:'Enregistrer',fields:[{name:'title',label:'Nom de la colonne',value:column.title,required:true}],onSubmit:async values=>{await api(`/columns/${column.id}`,'PATCH',{title:values.title.trim()});await load()}});
  const deleteColumn=(column:Col)=>openDialog({title:'Supprimer cette colonne ?',description:`« ${column.title} » et les ${column.tasks.length} tâche${column.tasks.length===1?'':'s'} qu’elle contient seront supprimées. Cette action est irréversible.`,submitLabel:'Supprimer la colonne',danger:true,onSubmit:async()=>{await api(`/columns/${column.id}`,'DELETE');await load()}});
  const editTask=(column:Col,task:Task)=>openDialog({title:'Modifier la tâche',submitLabel:'Enregistrer',fields:[{name:'title',label:'Titre',value:task.title,required:true},{name:'description',label:'Description',value:task.description||'',multiline:true}],onSubmit:async values=>{await api(`/tasks/${task.id}`,'PATCH',{title:values.title.trim(),description:values.description});await load()}});
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
    <header className="board-header"><div><p className="eyebrow">TABLEAU DE TRAVAIL</p><h1>{data.board.name}</h1></div><span className="role">{data.role==='viewer'?'Lecture seule':data.role==='admin'?'Administrateur':'Membre'}</span></header>
    <DragDropContext onDragEnd={onDragEnd}><div className="cols" aria-label="Colonnes des tâches">
      {data.columns.map(c=><div className="col" key={c.id}>
        <div className="col-h"><h3>{c.title}</h3><span className="count">{c.tasks.length}</span>
          {canEdit&&<button className="icon-button" aria-label="Renommer la colonne" title="Renommer la colonne" onClick={()=>renameColumn(c)}>✎</button>}
          {isAdmin&&<button className="icon-button" aria-label="Supprimer la colonne" title="Supprimer la colonne" onClick={()=>deleteColumn(c)}>×</button>}
        </div>
        <Droppable droppableId={String(c.id)}>{(p,snap)=><div ref={p.innerRef} {...p.droppableProps} className={'list'+(snap.isDraggingOver?' over':'')}>
          {c.tasks.map((t,i)=><Draggable key={t.id} draggableId={String(t.id)} index={i} isDragDisabled={!canEdit}>{(p2,s2)=>
            <div ref={p2.innerRef} {...p2.draggableProps} {...p2.dragHandleProps} className={'card'+(s2.isDragging?' drag':'')}>
              <div className="task-copy"><strong>{t.title}</strong>{t.description&&<p>{t.description}</p>}</div>
              {canEdit&&<div className="task-actions"><button className="icon-button" aria-label={`Modifier ${t.title}`} title="Modifier la tâche" onClick={event=>{event.stopPropagation();editTask(c,t)}}>✎</button><button className="icon-button delete-icon" aria-label={`Supprimer ${t.title}`} title="Supprimer la tâche" onClick={event=>{event.stopPropagation();deleteTask(t)}}>×</button></div>}
            </div>}</Draggable>)}
          {p.placeholder}</div>}</Droppable>
        {canEdit&&<button className="add-task" onClick={()=>addTask(c)}>＋ Ajouter une tâche</button>}
      </div>)}
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
