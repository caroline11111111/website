import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
export interface UserAccount { id:string; name:string; email:string; whatsapp:string; phone?:string; address?:string; }
interface AuthContextType { user:UserAccount|null; session:Session|null; login:(email:string,pass:string)=>Promise<void>; register:(name:string,email:string,pass:string,phone:string,address?:string)=>Promise<void>; logout:()=>Promise<void>; isAuthenticated:boolean; loading:boolean; }
const AuthContext=createContext<AuthContextType|undefined>(undefined);
function mapUser(user:User|null):UserAccount|null { if(!user)return null; return {id:user.id,name:user.user_metadata?.full_name||user.user_metadata?.name||'',email:user.email||'',whatsapp:user.user_metadata?.phone||'',phone:user.user_metadata?.phone||'',address:user.user_metadata?.address||''}; }
export const AuthProvider:React.FC<{children:React.ReactNode}>=({children})=>{
 const [session,setSession]=useState<Session|null>(null); const [loading,setLoading]=useState(true);
 useEffect(()=>{let alive=true; supabase.auth.getSession().then(async({data,error})=>{if(!alive)return;if(error)console.error(error);const candidate=data.session;if(candidate){const{data:access,error:accessError}=await supabase.rpc('get_my_admin_access');if(!alive)return;if(accessError||access?.is_admin===true){await supabase.auth.signOut();setSession(null);}else setSession(candidate);}else setSession(null);setLoading(false);}); const {data:listener}=supabase.auth.onAuthStateChange((_event,next)=>setSession(next)); return ()=>{alive=false;listener.subscription.unsubscribe();};},[]);
 const login=async(email:string,pass:string)=>{const {error}=await supabase.auth.signInWithPassword({email,password:pass});if(error)throw error;const{data,error:accessError}=await supabase.rpc('get_my_admin_access');if(accessError||data?.is_admin===true){await supabase.auth.signOut();throw new Error(accessError?'Unable to verify this account for customer access.':'This is a backend administrator account. Please use the Admin Portal to sign in.');}};
 const register=async(name:string,email:string,pass:string,phone:string,address?:string)=>{const {error}=await supabase.auth.signUp({email,password:pass,options:{data:{full_name:name,phone,address}}});if(error)throw error;};
 const logout=async()=>{const {error}=await supabase.auth.signOut();if(error)throw error;};
 useEffect(()=>{if(!session)return;let alive=true;supabase.rpc('get_my_admin_access').then(async({data,error})=>{if(!alive)return;if(error||data?.is_admin===true){await supabase.auth.signOut();if(alive)setSession(null);}});return()=>{alive=false;};},[session?.user.id]);
 const user=mapUser(session?.user||null);
 return <AuthContext.Provider value={{user,session,login,register,logout,isAuthenticated:!!session,loading}}>{children}</AuthContext.Provider>;
};
export const useAuth=()=>{const context=useContext(AuthContext);if(!context)throw new Error('useAuth must be used within an AuthProvider');return context;};