import { messages } from './i18n.js?v=1';
const $=id=>document.getElementById(id);
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let language='zh';try{language=localStorage.getItem('qiqi.language')==='en'?'en':'zh'}catch{}
const state={language,tab:'menu',category:'drinks',foods:[],wishes:new Map(),requests:[],user:null,owner:null,iceChoices:new Map(),busy:new Set(),authMode:'login',connected:false,pendingFood:null,draftAvatar:undefined,editingFood:null};
function t(key,values={}){let value=messages[state.language][key]||messages.en[key]||key;for(const [name,item]of Object.entries(values))value=value.replaceAll('{'+name+'}',String(item));return value}
const localized=value=>typeof value==='object'?(value[state.language]||value.zh||value.en||''):value;
function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').hidden=true,3200)}
function errorText(error){return t(error.code||'serviceUnavailable')}
async function api(path,{method='GET',body}={}){
  let response;try{response=await fetch('api/'+path,{method,credentials:'same-origin',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,cache:'no-store'})}catch{throw {code:'offline'}}
  let data;try{data=await response.json()}catch{throw {code:'serviceUnavailable'}}
  if(!response.ok){if(response.status===401){state.user=null;renderHeader()}throw {code:data.error||'serviceUnavailable',status:response.status}}
  return data;
}
function avatarHtml(user,size='avatar-small'){return `<span class="avatar ${size}">${user?.avatarUrl?`<img src="${escape(user.avatarUrl)}" alt="${escape(user.name)}" loading="lazy">`:'☺'}</span>`}
function renderHeader(){
  $('header-avatar').innerHTML=state.user?.avatarUrl?`<img src="${escape(state.user.avatarUrl)}" alt="">`:'☺';
  $('header-name').textContent=state.user?.name||t('myCard');$('owner-tab').hidden=state.user?.role!=='owner';
  $('wish-count').textContent=state.wishes.size;$('wish-count').hidden=!state.wishes.size;
}
function applyLanguage(){
 document.documentElement.lang=state.language==='zh'?'zh-CN':'en';document.title=state.language==='zh'?'QiQi的小屋':"QiQi's Cottage";
 document.querySelectorAll('[data-i18n]').forEach(el=>{el.textContent=t(el.dataset.i18n)});
 document.querySelectorAll('.dialog-close').forEach(b=>b.setAttribute('aria-label',t('close')));
 $('hero-image').alt=state.language==='zh'?'粉色屋顶、浅蓝窗框的水彩小屋':'A watercolor cottage with a pink roof and baby-blue windows';
 $('language-select').value=state.language;$('profile-trigger').setAttribute('aria-label',t('myCard'));
 render();renderAuthMode();renderConnection();
}
function renderConnection(){const box=$('connection-notice');box.hidden=state.connected;if(!state.connected)box.innerHTML=`${escape(t('connectionUnavailable'))} <button class="text-link" data-retry>${escape(t('retry'))}</button>`}
function iceValue(food){return state.wishes.get(food.id)?.ice||state.iceChoices.get(food.id)||'ice'}
function iceControls(food){return food.iceOptions?`<div class="ice-options" role="group" aria-label="${state.language==='zh'?'冰块偏好':'Ice preference'}">${['ice','noIce'].map(value=>`<button class="ice-option ${iceValue(food)===value?'active':''}" data-ice="${value}" data-food="${food.id}" aria-pressed="${iceValue(food)===value}" ${state.busy.has(food.id)?'disabled':''}>${escape(t(value))}</button>`).join('')}</div>`:''}
function renderMenu(){
 $('categories').innerHTML=['drinks','desserts','meals','all'].map(category=>`<button class="category-chip ${state.category===category?'active':''}" data-category="${category}" aria-pressed="${state.category===category}">${escape(t(category))}</button>`).join('');
 const foods=state.foods.filter(food=>state.category==='all'||food.category===state.category);
 $('menu-count').textContent=t('itemCount',{count:foods.length});
 $('food-grid').innerHTML=foods.length?foods.map(food=>{const selected=state.wishes.has(food.id);return `<article class="food-card"><div class="food-picture ${food.category}"><img src="${escape(food.image)}" alt="${escape(localized(food.name))}" width="220" height="220" loading="lazy"><span class="availability">${escape(t('available'))}</span></div><div class="food-content"><span class="food-category">${escape(t(food.category))}</span><h2 class="food-name">${escape(localized(food.name))}</h2>${localized(food.description)?`<p class="food-description">${escape(localized(food.description))}</p>`:''}<div class="card-bottom">${iceControls(food)}<button class="wish-button ${selected?'saved':''}" data-wish="${food.id}" aria-pressed="${selected}" ${state.busy.has(food.id)?'disabled':''}><span class="wish-icon" aria-hidden="true">${selected?'♥':'♡'}</span>${escape(t(selected?'savedWish':'addWish'))}</button></div></div></article>`}).join(''):`<div class="empty-state">${escape(t('emptyMenu'))}</div>`;
 if(!$('menu-new-wish')){const button=document.createElement('button');button.id='menu-new-wish';button.className='new-wish-banner';button.dataset.newWish='';$('menu-panel').append(button)}
 $('menu-new-wish').innerHTML=`<strong>${escape(t('newWish'))}</strong><span aria-hidden="true">↗</span>`;
}
function renderWishes(){
 const panel=$('wishes-panel');
 if(!state.user){panel.innerHTML=`<div class="empty-state"><span class="empty-icon">♡</span><p>${escape(t('guestWishes'))}</p><button class="primary-button" data-open-card>${escape(t('loginToSave'))}</button></div>`;return}
 const foods=state.foods.filter(f=>state.wishes.has(f.id));
 panel.innerHTML=`<div class="section-heading"><h1>${escape(t('wishesTitle',{name:state.user.name}))}</h1><span class="muted">${escape(t('wishCount',{count:state.wishes.size}))}</span></div><p class="notice">${escape(t('wishNotice'))}</p><div class="wish-list">${foods.map(food=>`<article class="wish-row"><img src="${escape(food.image)}" alt="" width="62" height="70"><div class="wish-details"><h3>${escape(localized(food.name))}</h3>${food.iceOptions?`<div class="ice-label">${escape(t(iceValue(food)))}</div>`:''}</div><button class="remove-wish" data-wish="${food.id}" ${state.busy.has(food.id)?'disabled':''}>${escape(t('remove'))}</button></article>`).join('')||`<div class="empty-state"><span class="empty-icon">♡</span>${escape(t('emptyWishes'))}</div>`}</div><div class="section-heading"><h2>${escape(t('newWishList'))}</h2><button class="text-link" data-new-wish>＋ ${escape(t('newWish'))}</button></div>${state.requests.map(request=>`<article class="note-card"><h3>${escape(request.title)}</h3><p>${escape(request.note)}</p><button class="subtle-button" data-withdraw="${request.id}">${escape(t('withdraw'))}</button></article>`).join('')||`<div class="empty-state">${escape(t('emptyRequests'))}</div>`}`;
}
function renderOwner(){
 const panel=$('owner-panel');if(state.user?.role!=='owner'){panel.innerHTML='';return}if(!state.owner){panel.innerHTML=`<div class="empty-state">${escape(t('loading'))}</div>`;return}
 const data=state.owner;
 panel.innerHTML=`<div class="section-heading"><h1>${escape(t('ownerHeading'))}</h1><span class="muted">${escape(t('ownerOnly'))}</span></div>${data.people.map(person=>{const wishes=data.wishes.filter(w=>w.userId===person.id);return `<article class="person-card"><div class="person-heading">${avatarHtml(person)}<div><h3>${escape(person.name)}</h3><span class="tiny">@${escape(person.username)}</span></div></div><p>${escape(t('dietaryPrefix'))}${escape(person.allergies||t('notProvided'))}</p><div class="owner-badges">${wishes.map(w=>{const food=data.foods.find(f=>f.id===w.foodId);return `<span class="person-badge">${escape(food?localized(food.name):w.foodId)}${w.ice?` · ${escape(t(w.ice))}`:''}</span>`}).join('')||`<span class="muted">${escape(t('noWishes'))}</span>`}</div></article>`}).join('')||`<div class="empty-state">${escape(t('emptyOwner'))}</div>`}<div class="section-heading"><h2>${escape(t('menuAndPopularity'))}</h2><button class="text-link" data-new-food>＋ ${escape(t('addFood'))}</button></div>${data.foods.map(food=>`<article class="note-card owner-food"><img src="${escape(food.image)}" alt="" width="56" height="56"><div><h3>${escape(localized(food.name))}</h3><p>${escape(t('peopleWant',{count:data.wishes.filter(w=>w.foodId===food.id).length}))}${food.active?'':' · '+escape(t('archived'))}</p></div><button class="text-link" data-edit-food="${food.id}">${escape(t('edit'))}</button></article>`).join('')}<div class="section-heading"><h2>${escape(t('openRequests'))}</h2></div>${data.requests.map(request=>`<article class="note-card"><h3>${escape(request.title)}</h3><span class="tiny">${escape(t('from',{name:request.name}))}</span><p>${escape(request.note)}</p><button class="text-link" data-archive="${request.id}">${escape(t('archive'))}</button></article>`).join('')||`<div class="empty-state">${escape(t('emptyRequests'))}</div>`}`;
}
function render(){renderHeader();renderMenu();renderWishes();renderOwner();for(const tab of ['menu','wishes','owner']){$(tab==='menu'?'menu-panel':tab==='wishes'?'wishes-panel':'owner-panel').hidden=state.tab!==tab}document.querySelectorAll('[data-tab]').forEach(button=>{button.classList.toggle('active',button.dataset.tab===state.tab);button.setAttribute('aria-current',button.dataset.tab===state.tab?'page':'false')})}
async function refresh(){
 try{const [session,menu]=await Promise.all([api('session'),api('menu')]);state.user=session.user;state.foods=menu.foods;state.wishes=new Map(menu.wishes.map(w=>[w.foodId,w]));state.connected=true;state.requests=state.user?(await api('requests')).requests:[];if(state.user?.role==='owner'&&state.tab==='owner')state.owner=await api('owner');else state.owner=null;renderConnection();render()}catch(error){state.connected=false;renderConnection();if(!state.foods.length){try{state.foods=await(await fetch('menu.json')).json();render()}catch{$('food-grid').innerHTML=`<p class="empty-state">${escape(t('offline'))}</p>`}}}
}
function openDialog(id){const dialog=$(id);if(!dialog.open)dialog.showModal();document.body.style.overflow='hidden'}
function closeDialog(id){$(id).close();if(!document.querySelector('dialog[open]'))document.body.style.overflow=''}
function renderAuthMode(){document.querySelectorAll('[data-auth]').forEach(b=>b.classList.toggle('active',b.dataset.auth===state.authMode));$('signup-fields').hidden=state.authMode!=='signup';$('auth-submit').textContent=t(state.authMode==='signup'?'signup':'login');$('auth-password').autocomplete=state.authMode==='signup'?'new-password':'current-password'}
function renderDraftAvatar(){const user=state.user;let url=state.draftAvatar===undefined?user?.avatarUrl:state.draftAvatar;$('profile-avatar').innerHTML=url?`<img src="${escape(url)}" alt="">`:'☺'}
function openCard(){state.draftAvatar=undefined;$('card-error').textContent='';$('signed-out-card').hidden=!!state.user;$('signed-in-card').hidden=!state.user;$('logout-button').hidden=!state.user;$('auth-username').required=!state.user;$('auth-password').required=!state.user;$('profile-name').required=!!state.user;$('profile-name').value=state.user?.name||'';$('profile-allergies').value=state.user?.allergies||'';renderDraftAvatar();renderAuthMode();openDialog('card-dialog')}
async function switchTab(tab){if(tab==='owner'&&state.user?.role!=='owner')return;state.tab=tab;render();if(tab==='wishes'&&state.user){try{state.requests=(await api('requests')).requests;renderWishes()}catch(error){toast(errorText(error))}}if(tab==='owner'){try{state.owner=await api('owner');renderOwner()}catch(error){toast(errorText(error))}}window.scrollTo({top:Math.min(window.scrollY,document.querySelector('.section-nav').offsetTop-12),behavior:'auto'})}
async function toggleWish(id){if(!state.connected){toast(t('syncPending'));return}if(!state.user){state.pendingFood=id;openCard();return}if(state.busy.has(id))return;state.busy.add(id);render();const food=state.foods.find(f=>f.id===id),wasSaved=state.wishes.has(id);try{await api('wishes/'+id,{method:wasSaved?'DELETE':'PUT',...(!wasSaved?{body:{ice:food.iceOptions?iceValue(food):''}}:{})});if(wasSaved)state.wishes.delete(id);else state.wishes.set(id,{foodId:id,ice:food.iceOptions?iceValue(food):''});toast(t(wasSaved?'wishRemoved':'wishAdded'))}catch(error){toast(errorText(error))}finally{state.busy.delete(id);render()}}
async function chooseIce(id,ice){if(state.busy.has(id))return;state.iceChoices.set(id,ice);if(state.wishes.has(id)){state.busy.add(id);try{await api('wishes/'+id,{method:'PUT',body:{ice}});state.wishes.set(id,{foodId:id,ice})}catch(error){toast(errorText(error))}finally{state.busy.delete(id)}}render()}
function openRequest(){if(!state.connected){toast(t('syncPending'));return}if(!state.user){openCard();return}$('request-form').reset();$('request-error').textContent='';openDialog('request-dialog')}
async function actionBusy(form,operation){const buttons=[...form.querySelectorAll('button[type=submit]')];buttons.forEach(b=>b.disabled=true);try{return await operation()}finally{buttons.forEach(b=>b.disabled=false)}}
$('card-form').addEventListener('submit',async event=>{event.preventDefault();$('card-error').textContent='';await actionBusy(event.currentTarget,async()=>{try{
 if(state.user){const body={name:$('profile-name').value,allergies:$('profile-allergies').value};if(state.draftAvatar!==undefined)body.avatar=state.draftAvatar;state.user=(await api('profile',{method:'PATCH',body})).user;toast(t('cardSaved'))}
 else{const body={username:$('auth-username').value,password:$('auth-password').value,...(state.authMode==='signup'?{name:$('signup-name').value,allergies:'',inviteCode:$('invite-code').value,ownerCode:$('owner-code').value,consent:$('signup-consent').checked}:{})};state.user=(await api('auth/'+state.authMode,{method:'POST',body})).user;$('auth-password').value='';$('owner-code').value='';await refresh()}
 closeDialog('card-dialog');renderHeader();if(state.tab==='wishes')renderWishes();if(state.pendingFood){const id=state.pendingFood;state.pendingFood=null;if(!state.wishes.has(id))await toggleWish(id)}
 }catch(error){$('card-error').textContent=errorText(error)}})});
$('request-form').addEventListener('submit',async event=>{event.preventDefault();await actionBusy(event.currentTarget,async()=>{try{await api('requests',{method:'POST',body:{title:$('request-title').value,note:$('request-note').value}});state.requests=(await api('requests')).requests;closeDialog('request-dialog');renderWishes();toast(t('requestSent'))}catch(error){$('request-error').textContent=errorText(error)}})});
$('food-form').addEventListener('submit',async event=>{event.preventDefault();await actionBusy(event.currentTarget,async()=>{try{const food=state.editingFood;await api('owner/foods/'+food.id,{method:'PUT',body:{nameZh:$('edit-name-zh').value,nameEn:$('edit-name-en').value,descriptionZh:$('edit-desc-zh').value,descriptionEn:$('edit-desc-en').value,category:$('edit-category').value,image:food.image,sortOrder:food.sortOrder,active:$('edit-active').checked,iceOptions:$('edit-ice').checked}});closeDialog('food-dialog');await refresh();toast(t('foodSaved'))}catch(error){$('food-error').textContent=errorText(error)}})});
async function prepareAvatar(file){if(!['image/png','image/jpeg'].includes(file.type))throw {code:'invalidAvatar'};if(file.size>8000000)throw {code:'imageTooLarge'};const bitmap=await createImageBitmap(file);const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;const context=canvas.getContext('2d');context.fillStyle='#fff0f7';context.fillRect(0,0,256,256);const side=Math.min(bitmap.width,bitmap.height);context.drawImage(bitmap,(bitmap.width-side)/2,(bitmap.height-side)/2,side,side,0,0,256,256);bitmap.close();return canvas.toDataURL('image/jpeg',.82)}
$('avatar-input').addEventListener('change',async event=>{const file=event.target.files?.[0];if(!file)return;try{state.draftAvatar=await prepareAvatar(file);renderDraftAvatar();toast(t('avatarReady'))}catch(error){$('card-error').textContent=errorText(error)}event.target.value=''});
$('language-select').addEventListener('change',event=>{state.language=event.target.value==='en'?'en':'zh';try{localStorage.setItem('qiqi.language',state.language)}catch{}applyLanguage()});
$('remove-avatar').addEventListener('click',()=>{state.draftAvatar='';renderDraftAvatar()});
$('profile-trigger').addEventListener('click',openCard);$('settings-trigger').addEventListener('click',openCard);$('bottom-profile').addEventListener('click',openCard);
$('privacy-trigger').addEventListener('click',()=>openDialog('privacy-dialog'));
$('card-wishes').addEventListener('click',()=>{closeDialog('card-dialog');switchTab('wishes')});
$('logout-button').addEventListener('click',async()=>{try{await api('auth/logout',{method:'POST',body:{}});state.user=null;state.wishes.clear();state.requests=[];state.owner=null;state.pendingFood=null;state.tab='menu';closeDialog('card-dialog');render();toast(t('loggedOut'))}catch(error){$('card-error').textContent=errorText(error)}});
for(const dialog of document.querySelectorAll('dialog')){dialog.addEventListener('close',()=>{if(!document.querySelector('dialog[open]'))document.body.style.overflow=''});dialog.addEventListener('click',event=>{if(event.target===dialog){const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)closeDialog(dialog.id)}})}
document.addEventListener('click',async event=>{
 const button=event.target.closest('button');if(!button)return;
 if(button.dataset.tab)return switchTab(button.dataset.tab);
 if(button.dataset.close)return closeDialog(button.dataset.close);
 if(button.dataset.category){state.category=button.dataset.category;renderMenu();return}
 if(button.dataset.wish)return toggleWish(button.dataset.wish);
 if(button.dataset.ice)return chooseIce(button.dataset.food,button.dataset.ice);
 if(button.hasAttribute('data-new-wish'))return openRequest();
 if(button.hasAttribute('data-open-card'))return openCard();
 if(button.hasAttribute('data-retry'))return refresh();
 if(button.dataset.auth){state.authMode=button.dataset.auth;renderAuthMode();return}
 if(button.dataset.withdraw){try{await api('requests/'+button.dataset.withdraw,{method:'DELETE'});state.requests=state.requests.filter(r=>r.id!==button.dataset.withdraw);renderWishes()}catch(error){toast(errorText(error))}return}
 if(button.dataset.archive){try{await api('owner/requests/'+button.dataset.archive,{method:'PATCH',body:{}});state.owner=await api('owner');renderOwner()}catch(error){toast(errorText(error))}return}
 if(button.dataset.editFood||button.hasAttribute('data-new-food')){const food=button.dataset.editFood?state.owner.foods.find(f=>f.id===button.dataset.editFood):{id:'food-'+crypto.randomUUID(),name:{zh:'',en:''},description:{zh:'',en:''},category:'drinks',image:'assets/cottage-icon.png',sortOrder:1000,active:true,iceOptions:false};state.editingFood=food;$('edit-id').value=food.id;$('edit-name-zh').value=food.name.zh;$('edit-name-en').value=food.name.en;$('edit-desc-zh').value=food.description.zh;$('edit-desc-en').value=food.description.en;$('edit-category').value=food.category;$('edit-active').checked=food.active;$('edit-ice').checked=food.iceOptions;$('food-error').textContent='';openDialog('food-dialog')}
});
window.addEventListener('online',refresh);
applyLanguage();
try{const config=await(await fetch('config.json',{cache:'no-store'})).json();if(config.backendOrigin){const destination=new URL(config.backendOrigin);if(destination.protocol==='https:'&&destination.origin!==location.origin){location.replace(destination.origin+'/');}}}catch{}
await refresh();
