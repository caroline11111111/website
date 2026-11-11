import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
export interface UserAccount { id:string; name:string; email:string; whatsapp:string; phone?:string; address?:string; }
interface AuthContextType { user:UserAccount|null; session:Session|null; login:(email:string,pass:string)=>Promise<void>; register:(name:string,email:string,pass:string,phone:string,address?:string)=>Promise<void>; logout:()=>Promise<void>; isAuthenticated:boolean; loading:boolean; }
const AuthContext=createContext<AuthContextType|undefined>(undefined);
function mapUser(user:User|null):UserAccount|null { if(!user)return null; return {id:user.id,name:user.user_metadata?.full_name||user.user_metadata?.name||'',email:user.email||'',whatsapp:user.user_metadata?.phone||'',phone:user.user_metadata?.phone||'',address:''}; }
export const AuthProvider:React.FC<{children:React.ReactNode}>=({children})=>{
 const [session,setSession]=useState<Session|null>(null); const [loading,setLoading]=useState(true);
 useEffect(()=>{let alive=true; supabase.auth.getSession().then(({data,error})=>{if(!alive)return;if(error)console.error(error);setSession(data.session);setLoading(false);}); const {data:listener}=supabase.auth.onAuthStateChange((_event,next)=>setSession(next)); return ()=>{alive=false;listener.subscription.unsubscribe();};},[]);
 const login=async(email:string,pass:string)=>{const {error}=await supabase.auth.signInWithPassword({email,password:pass});if(error)throw error;};
 const register=async(name:string,email:string,pass:string,phone:string,address?:string)=>{const {error}=await supabase.auth.signUp({email,password:pass,options:{data:{full_name:name,phone,address}}});if(error)throw error;};
 const logout=async()=>{const {error}=await supabase.auth.signOut();if(error)throw error;};
 const user=mapUser(session?.user||null);
 return <AuthContext.Provider value={{user,session,login,register,logout,isAuthenticated:!!session,loading}}>{children}</AuthContext.Provider>;
};
export const useAuth=()=>{const context=useContext(AuthContext);if(!context)throw new Error('useAuth must be used within an AuthProvider');return context;};