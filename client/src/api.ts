export const API=import.meta.env.VITE_API_URL||'http://localhost:4000';
export const getToken=()=>localStorage.getItem('token')||'';
export async function api<T=any>(path:string,method='GET',body?:unknown):Promise<T>{
  const r=await fetch(API+'/api'+path,{method,headers:{'Content-Type':'application/json',Authorization:'Bearer '+getToken()},body:body?JSON.stringify(body):undefined});
  const d=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(d.error||'Erreur');
  return d;
}
