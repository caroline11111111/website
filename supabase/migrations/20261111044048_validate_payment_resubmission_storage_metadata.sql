
create or replace function public.resubmit_payment_proof(
 p_order_id uuid,p_storage_path text,p_original_filename text,p_mime_type text,p_file_size bigint
)
returns uuid language plpgsql security definer set search_path=''
as $$
declare v_user uuid:=auth.uid();v_order public.orders%rowtype;v_id uuid;v_n integer;v_meta jsonb;
begin
 if v_user is null then raise exception 'Authentication required';end if;
 if p_mime_type not in ('image/jpeg','image/png','application/pdf') or p_file_size<=0 or p_file_size>5242880 then raise exception 'Invalid payment proof file';end if;
 if (string_to_array(p_storage_path,'/'))[1]<>v_user::text then raise exception 'Invalid payment proof path';end if;
 select metadata into v_meta from storage.objects where bucket_id='payment-proofs' and name=p_storage_path;
 if not found then raise exception 'Payment proof upload not found';end if;
 if coalesce(v_meta->>'mimetype','')<>p_mime_type or coalesce((v_meta->>'size')::bigint,-1)<>p_file_size then raise exception 'Payment proof file metadata does not match upload';end if;
 select * into v_order from public.orders where id=p_order_id and user_id=v_user for update;
 if not found or v_order.order_status in ('completed','cancelled') then raise exception 'Order not found or closed';end if;
 if v_order.payment_status<>'rejected' then raise exception 'Only rejected payments can be resubmitted';end if;
 select coalesce(max(submission_number),0)+1 into v_n from public.payment_proofs where order_id=p_order_id;
 insert into public.payment_proofs(order_id,user_id,storage_path,original_filename,mime_type,file_size,submission_number)
 values(p_order_id,v_user,p_storage_path,p_original_filename,p_mime_type,p_file_size,v_n) returning id into v_id;
 update public.orders set payment_status='verification_pending',updated_at=now() where id=p_order_id;
 insert into public.payment_status_history(order_id,payment_proof_id,old_status,new_status,reason,changed_by)
 values(p_order_id,v_id,'rejected','verification_pending','Customer submitted a new payment proof',v_user);
 return v_id;
end;
$$;
revoke all on function public.resubmit_payment_proof(uuid,text,text,text,bigint) from public,anon;
grant execute on function public.resubmit_payment_proof(uuid,text,text,text,bigint) to authenticated;
