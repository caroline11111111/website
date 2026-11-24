export const formatDate=(value:string|number|Date|null|undefined):string=>{
 if(value===null||value===undefined||value==='')return '—';
 const date=value instanceof Date?value:new Date(value);
 if(Number.isNaN(date.getTime()))return '—';
 return new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'2-digit',year:'numeric'}).format(date);
};

export const formatDateTime=(value:string|number|Date|null|undefined,timeZone?:string):string=>{
 if(value===null||value===undefined||value==='')return '—';
 const date=value instanceof Date?value:new Date(value);
 if(Number.isNaN(date.getTime()))return '—';
 return new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23',...(timeZone?{timeZone}:{})}).format(date);
};

// HTML date inputs use ISO values internally; display this companion label in the site's dd/mm/yyyy format.
export const formatDateInputValue=(value:string|null|undefined):string=>{
 if(!value)return '—';
 const match=value.match(/^(\\d{4})-(\\d{2})-(\\d{2})$/);
 return match?match[3]+'/'+match[2]+'/'+match[1]:'—';
};
