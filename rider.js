(function(){
'use strict';
window.__riderLoaded=true;
if(!window.BC){var __n=document.getElementById('notice');if(__n)__n.innerHTML='<div class="notice warn">shop.js did not load. Upload shop.js to the same folder as this page, then reload.</div>';return}

var BC=window.BC,$=function(s){return document.querySelector(s)},$$=function(s){return [].slice.call(document.querySelectorAll(s))};
var peso=BC.peso,esc=BC.esc;
function notice(t,c){$('#notice').innerHTML=t?'<div class="notice '+(c||'ok')+'">'+t+'</div>':''}
window.addEventListener('error',function(e){notice('Script error: '+esc(e.message||'unknown'),'warn')});
if(!BC.hasCfg){notice('Add your Supabase Project URL and key to <b>config.js</b> (and make sure config.js is uploaded next to rider.html).','warn');return}
if(!BC.libOk){notice('The Supabase library did not load. Check your internet connection and reload.','warn');return}
if(!BC.sb){notice('Problem with the details in <b>config.js</b>: '+esc(BC.err)+'.','warn');return}
var sb=BC.sb;
var orders=[],tab='todo',timer=null,busy=false;
var METHOD={gcash:'GCash',maya:'Maya',cash:'Cash'};
var STATE={paid:'Paid · not started',preparing:'Being prepared',ready:'Ready for pickup'};
var TABS=[['todo','To deliver'],['way','On the way'],['done','Delivered']];

/* ---------- login (same staff accounts as the admin page) ---------- */
function show(session){
  clearInterval(timer);
  if(!session){$('#login').hidden=false;$('#panel').hidden=true;$('#signedIn').hidden=true;return}
  sb.rpc('am_i_staff').then(function(r){
    if(r.error||r.data!==true){notice('This account is not a staff or rider account.','warn');sb.auth.signOut();return}
    notice('');$('#login').hidden=true;$('#panel').hidden=false;$('#signedIn').hidden=false;
    load();
    timer=setInterval(function(){if(!document.hidden)load()},15000);
  });
}
sb.auth.getSession().then(function(r){show(r.data.session)});
sb.auth.onAuthStateChange(function(ev){if(ev==='SIGNED_OUT')show(null)});
$('#doLogin').onclick=function(){
  var b=this;b.disabled=true;$('#loginErr').textContent='';
  sb.auth.signInWithPassword({email:$('#rEmail').value.trim(),password:$('#rPass').value}).then(function(r){
    b.disabled=false;
    if(r.error){$('#loginErr').textContent='Wrong email or password. Ask the shop to check your account.';return}
    $('#rPass').value='';show(r.data.session);
  });
};
$('#rPass').addEventListener('keydown',function(e){if(e.key==='Enter')$('#doLogin').click()});
$('#signOut').onclick=function(){sb.auth.signOut().then(function(){show(null)})};
$('#refresh').onclick=function(){load()};

/* ---------- data ---------- */
function load(){
  return sb.from('orders').select('*').eq('is_delivery',true).order('id',{ascending:false}).limit(100).then(function(r){
    if(r.error){
      var m=(r.error.message||'')+' '+(r.error.code||'');
      $('#rlist').innerHTML='';$('#rfilter').innerHTML='';$('#routeBar').hidden=true;
      notice(/is_delivery|42703/.test(m)?'Delivery isn’t set up in the database yet. Run <b>supabase-delivery.sql</b> in Supabase (SQL Editor), then reload.':'Could not load deliveries. Check your connection and try again.','warn');
      return;
    }
    notice('');orders=r.data||[];paint();
    $('#rUpdated').textContent='Updated '+new Date().toLocaleTimeString('en-PH',{hour:'numeric',minute:'2-digit'});
  });
}
function bucket(o){
  if(o.status==='cancelled')return '';
  if(o.delivery_status==='delivered')return 'done';
  if(o.delivery_status==='out_for_delivery')return 'way';
  if(o.status==='paid'||o.status==='preparing'||o.status==='ready')return 'todo';
  return '';
}
function listFor(k){
  var l=orders.filter(function(o){return bucket(o)===k});
  if(k==='done'){l.sort(function(a,b){return new Date(b.delivered_at||0)-new Date(a.delivered_at||0)});return l.slice(0,20)}
  l.sort(function(a,b){return a.id-b.id});               /* oldest order first */
  if(k==='todo')l=l.filter(function(o){return o.status==='ready'}).concat(l.filter(function(o){return o.status!=='ready'}));
  return l;
}
function clock(iso){try{return new Date(iso).toLocaleString('en-PH',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'})}catch(e){return ''}}
function digits(s){return String(s||'').replace(/[^\d+]/g,'')}

/* ---------- screen ---------- */
function paint(){
  $('#rfilter').innerHTML=TABS.map(function(t){
    var n=listFor(t[0]).length;
    return '<button data-f="'+t[0]+'" class="'+(tab===t[0]?'on':'')+'">'+t[1]+(t[0]!=='done'?' <span class="cnt">'+n+'</span>':'')+'</button>';
  }).join('');
  var list=listFor(tab);
  /* one Google Maps route through every stop that has a GPS pin (max 10) */
  var pts=tab==='done'?[]:list.filter(BC.hasPin).slice(0,10).map(function(o){return Number(o.delivery_lat)+','+Number(o.delivery_lng)});
  if(pts.length>1){
    var dest=pts.pop();
    $('#routeBar').innerHTML='<a class="obtn big alt" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(dest)+'&waypoints='+encodeURIComponent(pts.join('|'))+'">Route all '+(pts.length+1)+' stops in Google Maps</a>';
    $('#routeBar').hidden=false;
  }else $('#routeBar').hidden=true;
  if(!list.length){
    $('#rlist').innerHTML='<p class="hint">'+(tab==='todo'?'No deliveries waiting right now.':tab==='way'?'Nothing on the way.':'No deliveries completed yet.')+'</p>';
    return;
  }
  $('#rlist').innerHTML=list.map(card).join('');
}
function card(o){
  var k=bucket(o),num=digits(o.mobile);
  var items=(o.items||[]).map(function(i){return '<li>'+i.qty+' × '+esc(i.name)+(i.size?' ('+esc(i.size)+')':'')+'</li>'}).join('');
  var nt=BC.noteOf(o);
  var pill=k==='done'?'Delivered':(k==='way'?'On the way':(STATE[o.status]||o.status));
  var addr='<div class="raddr"><b>'+esc(o.delivery_street||'')+'</b><span>'+esc(o.delivery_barangay||'')+'</span><span>'+esc([o.delivery_city,o.delivery_postal].filter(Boolean).join(' '))+'</span>'+
    '<span class="hint">'+(BC.hasPin(o)?'GPS pin saved'+(o.delivery_accuracy_m?' (±'+Number(o.delivery_accuracy_m)+' m)':'')+' · tap Navigate':'No GPS pin · navigate by address')+'</span></div>';
  if(k==='done'){
    return '<div class="card ocard rcard"><div class="ohead"><b>#'+esc(o.ref)+' · '+esc(o.customer_name)+'</b><span class="pill">'+pill+'</span></div><div class="hint">'+esc(BC.addrText(o))+'</div><div class="hint">Delivered '+clock(o.delivered_at)+'</div></div>';
  }
  var btns=['<a class="main" target="_blank" rel="noopener" href="'+esc(BC.mapsUrl(o))+'">Navigate</a>'];
  if(num){btns.push('<a href="tel:'+esc(num)+'">Call</a>');btns.push('<a href="sms:'+esc(num)+'">Text</a>')}
  if(k==='todo'){
    btns.push(o.status==='ready'?'<button class="main" data-a="pick" data-id="'+o.id+'">Picked up · on the way</button>':'<button disabled>Wait until it’s ready</button>');
  }else{
    btns.push('<button class="main" data-a="done" data-id="'+o.id+'">Delivered ✓</button>');
  }
  return '<div class="card ocard rcard"><div class="ohead"><b>#'+esc(o.ref)+' · '+esc(o.customer_name)+'</b><span class="pill">'+esc(pill)+'</span></div>'+
    '<div class="hint">'+clock(o.created_at)+' · <a href="tel:'+esc(num)+'">'+esc(o.mobile)+'</a></div>'+addr+
    '<ul>'+items+'</ul>'+(nt?'<div class="hint">Note: '+esc(nt)+'</div>':'')+
    '<div class="paidbar"><b>Paid online</b> ('+esc(METHOD[o.payment_method]||'online')+') · do not collect cash</div>'+
    '<div class="rtotal"><span>Total</span><span>'+peso(o.total)+'</span></div><div class="btnrow">'+btns.join('')+'</div></div>';
}
$('#rfilter').addEventListener('click',function(e){var b=e.target.closest('button');if(!b)return;tab=b.dataset.f;paint()});
$('#rlist').addEventListener('click',function(e){
  var b=e.target.closest('button[data-a]');if(!b||busy)return;
  var id=+b.dataset.id,now=new Date().toISOString(),patch;
  if(b.dataset.a==='pick')patch={delivery_status:'out_for_delivery',picked_up_at:now};
  else if(b.dataset.a==='done'){if(!confirm('Mark this order as delivered?'))return;patch={delivery_status:'delivered',delivered_at:now,status:'done'}}
  else return;
  busy=true;b.disabled=true;
  sb.from('orders').update(patch).eq('id',id).select().then(function(r){
    busy=false;
    if(r.error||!r.data||!r.data.length)alert('Could not update the order. Check your connection and that you are signed in.');
    load();
  });
});
})();
