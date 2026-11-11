-- Normalize Malaysian region matching for shipping quotes.
-- Supports canonical state codes and full state names while preserving country-wide zones.
do $$
declare
  v_def text;
  v_old text := 'and (region_code is null or region_code=p_region_code)';
  v_new text := $match$and (region_code is null or upper(trim(region_code))=upper(trim(p_region_code)) or upper(trim(region_code))=case upper(trim(p_region_code)) when 'JOHOR' then 'JHR' when 'KEDAH' then 'KDH' when 'KELANTAN' then 'KTN' when 'MELAKA' then 'MLK' when 'NEGERI SEMBILAN' then 'NSN' when 'PAHANG' then 'PHG' when 'PENANG' then 'PNG' when 'PULAU PINANG' then 'PNG' when 'PERAK' then 'PRK' when 'PERLIS' then 'PLS' when 'SELANGOR' then 'SGR' when 'TERENGGANU' then 'TRG' when 'KUALA LUMPUR' then 'KUL' when 'W.P. KUALA LUMPUR' then 'KUL' when 'LABUAN' then 'LBN' when 'PUTRAJAYA' then 'PJY' when 'SABAH' then 'SBH' when 'SARAWAK' then 'SWK' else upper(trim(p_region_code)) end or upper(trim(p_region_code))=case upper(trim(region_code)) when 'JOHOR' then 'JHR' when 'KEDAH' then 'KDH' when 'KELANTAN' then 'KTN' when 'MELAKA' then 'MLK' when 'NEGERI SEMBILAN' then 'NSN' when 'PAHANG' then 'PHG' when 'PENANG' then 'PNG' when 'PULAU PINANG' then 'PNG' when 'PERAK' then 'PRK' when 'PERLIS' then 'PLS' when 'SELANGOR' then 'SGR' when 'TERENGGANU' then 'TRG' when 'KUALA LUMPUR' then 'KUL' when 'W.P. KUALA LUMPUR' then 'KUL' when 'LABUAN' then 'LBN' when 'PUTRAJAYA' then 'PJY' when 'SABAH' then 'SBH' when 'SARAWAK' then 'SWK' else upper(trim(region_code)) end)$match$;
begin
  select pg_get_functiondef('public.quote_shipping(uuid[],text,text)'::regprocedure) into v_def;
  if position(v_old in v_def)=0 then
    raise exception 'Expected region matching clause was not found; migration stopped without changing the function';
  end if;
  v_def := replace(v_def, v_old, v_new);
  execute v_def;
end $$;
