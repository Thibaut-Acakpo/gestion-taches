import type {ReactNode} from 'react';

export function Modal({title,description,onClose,children}:{title:string;description?:string;onClose:()=>void;children:ReactNode}){
  return <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}>
    <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <button className="modal-close" type="button" onClick={onClose} aria-label="Fermer">×</button>
      <h2 id="modal-title">{title}</h2>
      {description&&<p className="modal-description">{description}</p>}
      {children}
    </section>
  </div>;
}

export function Toast({message}:{message:string}){
  return <div className="toast" role="status" aria-live="polite"><span className="toast-mark" aria-hidden="true">✓</span>{message}</div>;
}
