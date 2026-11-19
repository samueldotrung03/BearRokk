'use strict';
const $ = id => document.getElementById(id);
let lastEvidenceButton;
let currentView=null;
const homeEntrance={play(){},cancel(){}};
const pageEntrances={home:homeEntrance,preview:{play(){},cancel(){}},about:{play(){},cancel(){}}};
function route() {
  const legacy=['#demo','#app-main','#dashboard','#results-grid','#results-title','#search-form'];
  if(legacy.includes(location.hash) || (/^#demo-/.test(location.hash) && !['#demo-preview','#demo-preview-view'].includes(location.hash))) {
    history.replaceState(null,'','#demo-preview');
  }
  const hash=location.hash;
  const isAbout=['#about-us','#about-view'].includes(hash);
  const isPreview=['#demo-preview','#demo-preview-view'].includes(hash);
  const entersHomeTop=['','#home','#main'].includes(hash);
  Object.values(pageEntrances).forEach(entrance=>entrance.cancel());
  $('landing').hidden=isAbout || isPreview;
  $('about-view').hidden=!isAbout;
  $('demo-preview-view').hidden=!isPreview;
  $('public-header').hidden=false;
  $('home-edge-lenses').hidden=isAbout || isPreview;
  $('public-art').hidden=isAbout;
  if(!isPreview)$('demo-preview-video').pause();
  document.title=isAbout?'About us — BearRok':isPreview?'Demo — BearRok':'BearRok — Find your next thing';
  document.querySelector('.skip').href=isAbout?'#about-view':isPreview?'#demo-preview-view':'#main';
  document.querySelectorAll('.nav-cluster>a').forEach(link=>{
    const active=link.getAttribute('href')===(isPreview?'#demo-preview':isAbout?'#about-us':'#home');
    active?link.setAttribute('aria-current','page'):link.removeAttribute('aria-current');
  });
  const nextView=isAbout?'about':isPreview?'preview':'home';
  if(currentView!==nextView) {
    window.scrollTo(0,0);
    if(isAbout || isPreview)$(isAbout?'about-view':'demo-preview-view').focus({preventScroll:true});
  } else if(!hash || hash==='#home')window.scrollTo(0,0);
  currentView=nextView;
  if(entersHomeTop)homeEntrance.play();
  else if(isAbout)pageEntrances.about.play();
  else if(isPreview)pageEntrances.preview.play();
  if(hash==='#workflow' && window.requestAnimationFrame){
    // Wait for the revealed Home layout and stable frame measurements before anchoring.
    window.requestAnimationFrame(()=>window.requestAnimationFrame(()=>{
      if(currentView!=='home' || location.hash!==hash)return;
      const target=$('workflow');target.scrollIntoView({block:'start',behavior:'instant'});
      target.tabIndex=-1;target.focus({preventScroll:true});
    }));
  }
}
function initPublicNavigation() {
  if(!document.addEventListener)return;
  const video=$('demo-preview-video');
  document.addEventListener('click',event=>{
    const link=event.target.closest('.nav-cluster>a,.brand[href="#home"]');
    if(link && link.getAttribute('href')===location.hash) {
      event.preventDefault();window.scrollTo(0,0);
      pageEntrances[currentView]?.play();
    }
  });
  window.addEventListener('pagehide',()=>video.pause());
  document.addEventListener('visibilitychange',()=>{if(document.hidden)video.pause();});
}
initPublicNavigation();
// These notes concern the manually reviewed Cosmo example, not the supplied Feed screenshot.
function openSourceNotes(trigger) {
  lastEvidenceButton=trigger;
  $('dialog-body').innerHTML=`<h2 id="dialog-title">Cosmo Hacks 2026</h2><p>Manually reviewed November 18, 2026 for the prepared Cosmo example in this pitch. These sources cover the event window and eligibility.</p><div class="source-entry"><strong>Cosmo Hacks · official event website</strong><p>Organizer information on online format, beginner participation, theme, eligibility, and the event window.</p><a href="https://www.cosmohacks.com/" target="_blank" rel="noopener noreferrer">Official event website<span class="sr-only"> (opens in a new tab)</span></a></div><div class="source-entry"><strong>Cosmo Hacks · Devpost listing</strong><p>Official listing for event and submission details. The review did not establish a separate registration cutoff.</p><a href="https://cosmohacks.devpost.com/" target="_blank" rel="noopener noreferrer">Official Devpost listing<span class="sr-only"> (opens in a new tab)</span></a></div><div class="source-warning"><strong>Registration deadline unknown</strong><br>January 18 is the event and project submission end, not a verified registration cutoff. The May 10 date in the Check panel is explicitly sample UI data.</div>`;
  $('evidence-dialog').showModal();
}
function initSourceNotes() {
  if(!document.addEventListener)return;
  document.addEventListener('click',event=>{const trigger=event.target.closest('[data-source-notes]');if(trigger)openSourceNotes(trigger);});
  const dialog=$('evidence-dialog');
  $('close-dialog').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{if(lastEvidenceButton?.isConnected)lastEvidenceButton.focus();});
  dialog.addEventListener('click',event=>{
    if(event.target!==dialog)return;
    const rect=dialog.getBoundingClientRect();
    if(event.clientX<rect.left || event.clientX>rect.right || event.clientY<rect.top || event.clientY>rect.bottom)dialog.close();
  });
}
initSourceNotes();
initHomeEntrance();
window.addEventListener('hashchange',route);
route();


// Native scroll remains in charge. Geometry drives reversible motion only;
// everything stays visible when JavaScript or motion is unavailable.
// Horizontal gestures choose a card; vertical touch scrolling stays native.
function initCapabilityDeck(deck,cards) {
  if(!deck || !cards.length)return;
  let active=0,gesture=null,suppressClick=false,lastHover=null,revealVersion=0;
  function select(index,focus=false) {
    const version=++revealVersion;
    active=(index+cards.length)%cards.length;
    deck.dataset.active=cards[active].dataset.capability;
    cards.forEach((card,i)=>{
      const selected=i===active;
      card.classList.toggle('is-active',selected);
      card.querySelector('.capability-toggle').setAttribute('aria-expanded',String(selected));
      card.querySelector('.capability-detail').inert=!selected;
    });
    if(focus)cards[active].querySelector('.capability-toggle').focus({preventScroll:true});
    if(window.matchMedia && deck.scrollTo && window.matchMedia('(max-width:720px)').matches){
      const selectedIndex=active;
      // Scroll only the lane after widths settle; never move the document.
      setTimeout(()=>{
        if(active!==selectedIndex || version!==revealVersion)return;
        const last=cards[cards.length-1];
        const end=Math.max(0,last.offsetLeft+last.offsetWidth+12-deck.clientWidth);
        deck.scrollTo({left:Math.min(end,Math.max(0,cards[active].offsetLeft-12)),behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
      },780);
    }
  }
  cards.forEach((card,index)=>{
    const button=card.querySelector('.capability-toggle');
    button.addEventListener('focus',()=>select(index));
    button.addEventListener('click',event=>{if(suppressClick){event.preventDefault();return;}select(index);});
    button.addEventListener('keydown',event=>{
      const offset={ArrowRight:1,ArrowDown:1,ArrowLeft:-1,ArrowUp:-1}[event.key];
      if(offset || event.key==='Home' || event.key==='End'){
        event.preventDefault();select(event.key==='Home'?0:event.key==='End'?cards.length-1:active+offset,true);
      }
    });
  });
  deck.addEventListener('pointerdown',event=>{
    if(event.button!==0 || event.target.closest('[data-source-notes],a'))return;
    gesture={x:event.clientX,y:event.clientY,id:event.pointerId,index:active};suppressClick=false;
  });
  deck.addEventListener('pointermove',event=>{
    if(!gesture){
      // Reflow beneath a stationary pointer must not chase another card.
      const moved=!lastHover || Math.hypot(event.clientX-lastHover.x,event.clientY-lastHover.y)>3;
      if(event.pointerType!=='touch' && moved && !deck.contains(document.activeElement)){
        lastHover={x:event.clientX,y:event.clientY};
        const card=event.target.closest('[data-capability]');
        const index=cards.indexOf(card);if(index>=0 && index!==active)select(index);
      }
      return;
    }
    if(event.pointerId!==gesture.id)return;
    const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y;
    if(!gesture.drag && Math.abs(dy)>Math.abs(dx)+8){gesture=null;return;}
    if(Math.abs(dx)>24 && Math.abs(dx)>Math.abs(dy)*1.3){
      gesture.drag=true;suppressClick=true;deck.classList.add('is-dragging');
      deck.setPointerCapture?.(event.pointerId);
      select(gesture.index+(dx<0?1:-1));
    }
  });
  function release(){gesture=null;deck.classList.remove('is-dragging');setTimeout(()=>{suppressClick=false;},0);}
  deck.addEventListener('pointerup',release);deck.addEventListener('pointercancel',release);
  deck.addEventListener('pointerleave',()=>{lastHover=null;});
  select(0);
}

function initLandingStory() {
  if (!window.matchMedia || !window.requestAnimationFrame) return;
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const landing = $('landing');
  const art = document.querySelector('.flow-art');
  const pair = document.querySelector('.capability-pair');
  const panels = [...document.querySelectorAll('[data-capability]')];
  let framePending = false;

  initCapabilityDeck(pair,panels);

  function paintScroll() {
    framePending = false;
    if (landing.hidden && $('demo-preview-view').hidden) return;
    if (motionPreference.matches) {
      art.style.removeProperty('--art-y');
      art.style.removeProperty('--art-rotate');
      art.style.removeProperty('--flow-offset');
      return;
    }
    const travel = window.scrollY;
    art.style.setProperty('--art-y', `${-Math.min(travel * .045, 220)}px`);
    art.style.setProperty('--art-rotate', `${-9 + Math.sin(travel / 1200) * 17}deg`);
    art.style.setProperty('--flow-offset', `${-travel * .65}`);
  }
  function schedulePaint() {
    if (framePending) return;
    framePending = true;
    window.requestAnimationFrame(paintScroll);
  }
  window.addEventListener('scroll', schedulePaint, { passive: true });
  window.addEventListener('resize', schedulePaint);
  window.addEventListener('hashchange', () => {
    schedulePaint();
    if (location.hash==='#home') return;
    if (!landing.hidden && location.hash) {
      const target = document.getElementById(location.hash.slice(1));
      if (target) window.requestAnimationFrame(() => target.scrollIntoView());
    }
  });
  motionPreference.addEventListener('change', schedulePaint);
  schedulePaint();
}
initLandingStory();
initStablePanelFrames();
function initViewportEdges() {
  if (!window.requestAnimationFrame) return;
  let pending=false;
  const landing=$('landing');
  const lenses=$('home-edge-lenses');
  const top=lenses.querySelector('.viewport-edge-top');
  const bottom=lenses.querySelector('.viewport-edge-bottom');
  function update() {
    pending=false;lenses.hidden=landing.hidden;
    const scrolling=document.scrollingElement || document.documentElement;
    const maxScroll=Math.max(0,scrolling.scrollHeight-scrolling.clientHeight);
    const remaining=Math.max(0,maxScroll-Math.max(0,window.scrollY));
    const fadeDistance=window.innerWidth<=720?120:160;
    // A one-pixel tolerance covers fractional maximum offsets and mobile rounding.
    const progress=landing.hidden || maxScroll<=1?0:Math.max(0,Math.min(1,(remaining-1)/(fadeDistance-1)));
    const strength=progress*progress*(3-2*progress);
    // Opacity belongs to each lens, never to their backdrop-root wrapper.
    lenses.style.setProperty('--home-edge-strength',String(strength));
    // The lenses are a viewport-level sibling, outside all filtered page surfaces.
    const target=document.activeElement;
    const protect=target?.matches?.('#landing :is(a,button,input,select,textarea):focus-visible');
    const rect=protect?target.getBoundingClientRect():null;
    for(const lens of [top,bottom]) {
      const box=lens.getBoundingClientRect();
      lens.style.setProperty('--focus-x',rect?(rect.left+rect.width/2)+'px':'-10000px');
      lens.style.setProperty('--focus-y',rect?(rect.top+rect.height/2-box.top)+'px':'-10000px');
      lens.style.setProperty('--focus-rx',rect?(rect.width/2+22)+'px':'0px');
      lens.style.setProperty('--focus-ry',rect?(rect.height/2+16)+'px':'0px');
    }
  }
  function schedule(){if(!pending){pending=true;window.requestAnimationFrame(update);}}
  window.addEventListener('scroll',schedule,{passive:true});
  window.addEventListener('resize',schedule);
  window.addEventListener('hashchange',schedule);
  window.addEventListener('pageshow',schedule);
  window.addEventListener('load',schedule);
  document.addEventListener('focusin',schedule);
  document.addEventListener('focusout',schedule);
  if(window.ResizeObserver){const observer=new ResizeObserver(schedule);observer.observe(document.body);observer.observe(landing);}
  schedule();
}
initViewportEdges();

function initResultPanels() {
  const group=document.querySelector('.result-panels');
  const panels=[...document.querySelectorAll('[data-result]')];
  if(!group || !panels.length) return;
  let hovered=null, focused=null, pinned=null, inputMode=null;
  group.addEventListener('pointerdown',event=>{inputMode=event.pointerType;});
  function paint() {
    const active=focused || hovered || pinned;
    panels.forEach(panel=>{
      panel.classList.toggle('is-emphasized',panel===active);
      panel.classList.toggle('is-softened',Boolean(active && panel!==active));
      panel.querySelector('.result-select').setAttribute('aria-pressed',String(panel===pinned));
    });
  }
  function reset() {hovered=null;focused=null;pinned=null;paint();}
  panels.forEach(panel=>{
    panel.addEventListener('pointerenter',event=>{
      if(event.pointerType==='touch')return;
      hovered=panel;paint();
    });
    panel.addEventListener('pointerleave',event=>{
      if(event.pointerType==='touch')return;
      hovered=null;if(inputMode!=='touch')pinned=null;paint();
    });
    panel.addEventListener('focusin',()=>{
      // Touch selection has its own explicit toggle, so pointer focus does not latch it.
      if(panel.matches(':focus-within') && panel.querySelector(':focus-visible'))focused=panel;
      paint();
    });
    panel.addEventListener('focusout',event=>{
      if(!panel.contains(event.relatedTarget)) {focused=null;if(inputMode!=='touch')pinned=null;paint();}
    });
    panel.querySelector('.result-select').addEventListener('click',event=>{
      if(event.detail===0)inputMode='keyboard';
      const deselect=pinned===panel;
      pinned=deselect?null:panel;
      if(deselect){hovered=null;focused=null;}
      paint();
    });
  });
  group.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();reset();}
  });
  document.addEventListener('pointerdown',event=>{
    if(!event.target.closest('[data-result]'))reset();
  });
  paint();
}
initResultPanels();

// An illustrated architecture loop, never a representation of a live backend run.
function initAgentFlow() {
  const roles=[...document.querySelectorAll('[data-agent]')];
  if(!roles.length || !window.requestAnimationFrame) return;
  const figure=document.querySelector('.agent-flow');
  const topology=$('agent-topology');
  const paths=$('agent-paths');
  const play=$('flow-play');
  const phases=['trigger','master','managers','scouts','extractors','validators','readers','presentation','feed','memory'];
  const labels=['Run triggers','Master · profile & memory','Four search managers · parallel','Shared scout fleet','Extractor fleet','Validators · keep or reject','Application readers · kept results','Presentation · rank & explain','Student feed · save, like, dislike','Memory → next run'];
  const links=[['trigger','master'],...['manager1','manager2','manager3','manager4'].map(id=>['master',id]),...['manager1','manager2','manager3','manager4'].map(id=>[id,'scouts']),['scouts','extractors'],['extractors','validators'],['validators','readers'],['readers','presentation'],['presentation','feed'],['feed','memory'],['memory','master']];
  let phase=0, timer=null, userPaused=false, inView=true;
  let selectedId=null;
  const flowStorageKey='bearrok-flow-motion';
  try {userPaused=window.localStorage.getItem(flowStorageKey)==='off';} catch {}
  figure.classList.add('is-motion-enabled');
  const stepDuration=()=>['scouts','extractors'].includes(phases[phase])?2200:1100;
  const descriptions={
    trigger:'A profile change, feedback, a schedule, or a request starts a run.',
    master:'Reads the student’s profile and memory, then assigns four search slots.',
    manager1:'Plans one category slice while the other three managers work in parallel.',
    manager2:'Plans another category slice, independently of the other managers.',
    manager3:'Plans a third category slice and sends jobs to the shared worker queue.',
    manager4:'Plans the fourth category slice; all four slots follow the student’s interests.',
    scouts:'Discover candidate URLs through the shared worker queue.',
    extractors:'Read candidate pages and turn their details into structured records.',
    validators:'Check the candidates and decide which results to keep or reject.',
    readers:'Read application details for the results that passed validation.',
    presentation:'Rank the results and explain why each one fits the student.',
    feed:'Show the possibilities and collect saves, likes, and dislikes.',
    memory:'Keep feedback in the current process to guide the next run.'
  };
  const roleById=Object.fromEntries(roles.map(node=>[node.dataset.agent,node]));
  function draw() {
    const box=topology.getBoundingClientRect();
    const bounds=Object.fromEntries(roles.map(node=>{const r=node.getBoundingClientRect();return[node.dataset.agent,{x:r.left-box.left,y:r.top-box.top,w:r.width,h:r.height}];}));
    paths.innerHTML=links.map(([from,to])=>{
      const a=bounds[from],b=bounds[to];let d;
      if(from==='memory') {
        const x=box.width-5;d=`M${a.x+a.w} ${a.y+a.h/2}H${x}V${b.y+b.h/2}H${b.x+b.w}`;
      } else if(Math.abs(a.y-b.y)<10) {
        d=`M${a.x+a.w} ${a.y+a.h/2}H${b.x}`;
      } else {
        const sx=a.x+a.w/2,sy=a.y+a.h,tx=b.x+b.w/2,ty=b.y,mid=sy+(ty-sy)/2;
        d=`M${sx} ${sy}V${mid}H${tx}V${ty}`;
      }
      const phaseFrom=roleById[from].dataset.phase;
      return `<path class="agent-wire" data-from="${from}" data-to="${to}" d="${d}"/><path class="agent-pulse" pathLength="100" data-departure="${phaseFrom}" d="${d}"/>`;
    }).join('');
    paint();
  }
  function paint() {
    figure.style.setProperty('--flow-step',stepDuration()+'ms');
    figure.classList.toggle('is-paused',userPaused || document.hidden || !inView);
    roles.forEach(role=>{
      const selected=role.dataset.agent===selectedId;
      role.classList.toggle('is-selected',selected);
      role.classList.toggle('is-current',!selectedId && role.dataset.phase===phases[phase]);
      role.setAttribute('aria-pressed',String(selected));
      const description=role.querySelector('.agent-description');
      description.textContent=descriptions[role.dataset.agent];
      description.hidden=!selected;
    });
    const managerSelected=selectedId && selectedId.startsWith('manager');
    $('agent-manager-detail').hidden=!managerSelected;
    $('agent-manager-detail').textContent=managerSelected?descriptions[selectedId]:'';
    topology.querySelectorAll('.agent-wire').forEach(path=>{
      path.classList.toggle('is-current-phase',!selectedId && roleById[path.dataset.from].dataset.phase===phases[phase]);
      path.classList.toggle('is-connected',Boolean(selectedId && (path.dataset.from===selectedId || path.dataset.to===selectedId)));
    });
    topology.querySelectorAll('.agent-pulse').forEach(path=>{
      path.classList.toggle('is-current',!selectedId && path.dataset.departure===phases[phase]);
    });
    $('flow-phase').textContent=selectedId
      ?'Selected: '+roleById[selectedId].querySelector('span').textContent.trim()
      :labels[phase];
    play.textContent=userPaused?'Play flow':'Pause flow';
    play.disabled=false;
    play.setAttribute('aria-label',userPaused?'Play the agent flow':'Pause the agent flow');
    play.setAttribute('aria-pressed',String(!userPaused));
  }
  function schedule() {
    clearTimeout(timer);paint();
    if(userPaused || document.hidden || !inView) return;
    timer=setTimeout(()=>{phase=phase===phases.length-1?1:phase+1;schedule();},stepDuration());
  }
  roles.forEach(role=>{
    role.addEventListener('click',()=>{
      selectedId=role.dataset.agent;
      phase=phases.indexOf(role.dataset.phase);
      userPaused=true;
      try {window.localStorage.setItem(flowStorageKey,'off');} catch {}
      $('agent-selection-status').textContent='Selected '+role.querySelector('span').textContent.trim()+'. '+descriptions[selectedId]+' Flow paused.';
      schedule();
    });
  });
  play.addEventListener('click',()=>{
    userPaused=!userPaused;
    try {window.localStorage.setItem(flowStorageKey,userPaused?'off':'on');} catch {}
    if(!userPaused)selectedId=null;
    $('agent-selection-status').textContent=userPaused?'Flow paused.':'Flow playing.';
    schedule();
  });
  document.addEventListener('visibilitychange',schedule);
  window.addEventListener('hashchange',schedule);
  window.addEventListener('pagehide',()=>{clearTimeout(timer);});
  window.addEventListener('pageshow',schedule);
  if(window.IntersectionObserver)new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;schedule();},{threshold:.05}).observe(figure);
  if(window.ResizeObserver)new ResizeObserver(()=>window.requestAnimationFrame(draw)).observe(topology);
  window.addEventListener('resize',()=>window.requestAnimationFrame(draw));
  draw();schedule();
}
initAgentFlow();

function initBackToTop() {
  const button=$('back-to-top');
  if(!button || !window.requestAnimationFrame)return;
  let pending=false;
  function update(){pending=false;button.hidden=window.scrollY<320;}
  function schedule(){if(!pending){pending=true;window.requestAnimationFrame(update);}}
  button.addEventListener('click',()=>{
    window.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
    const target=$({home:'main',about:'about-view',preview:'demo-preview-view'}[currentView] || 'main');
    target.tabIndex=-1;target.focus({preventScroll:true});
    pageEntrances[currentView]?.play();
  });
  window.addEventListener('scroll',schedule,{passive:true});
  window.addEventListener('hashchange',schedule);
  window.addEventListener('resize',schedule);
  schedule();
}
initBackToTop();

// One real content layer; the decorative shards never duplicate text or change layout.
function initHomeEntrance() {
  createPageEntrance('home','.hero-showcase','.hero-copy');
  createClarityEntrance('preview','.demo-page');
  createClarityEntrance('about','.about-view');
  initPortraitBounce();
}
function createPageEntrance(view,rootSelector,panelSelector) {
  const hero=document.querySelector(rootSelector);
  const copy=document.querySelector(panelSelector);
  if(!copy || typeof copy.animate!=='function' || !window.requestAnimationFrame)return;
  const content=copy.querySelector('.entrance-content');
  const followups=hero?[...hero.querySelectorAll('.entrance-followup')]:[];
  if(!hero || !content)return;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  const layer=document.createElement('div');
  layer.className='hero-fragments';layer.setAttribute('aria-hidden','true');layer.hidden=true;
  copy.prepend(layer);
  const pieces=[];
  const columns=7, rows=4;
  const noise=index=>{const n=Math.sin(index*91.37)*10000;return n-Math.floor(n);};
  const points=Array.from({length:rows+1},(_,row)=>Array.from({length:columns+1},(_,col)=>[
    col===0?0:col===columns?100:col*100/columns+(noise(row*20+col)-.5)*7,
    row===0?0:row===rows?100:row*100/rows+(noise(row*29+col+10)-.5)*8
  ]));
  function addPiece(polygon) {
    const element=document.createElement('span');element.className='hero-fragment';
    element.style.clipPath='polygon('+polygon.map(point=>point.join('% ')+'%').join(',')+')';
    const center=polygon.reduce((sum,point)=>[sum[0]+point[0]/polygon.length,sum[1]+point[1]/polygon.length],[0,0]);
    element.style.transformOrigin=center.join('% ')+'%';
    element.style.background=pieces.length%11===0?'var(--intro-fragment-warm)':'var(--intro-fragment)';
    layer.append(element);pieces.push({element,center});
  }
  for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){
    const a=points[row][col],b=points[row][col+1],c=points[row+1][col+1],d=points[row+1][col];
    if((row+col)%3===0)addPiece([a,b,c,d]);
    else if((row+col)%2){addPiece([a,b,d]);addPiece([b,c,d]);}
    else {addPiece([a,b,c]);addPiece([a,c,d]);}
  }
  let generation=0, animations=[], frame=null;
  function animate(element,keyframes,options){const animation=element.animate(keyframes,options);animations.push(animation);return animation.finished.catch(()=>{});}
  function reset() {
    generation++;
    if(frame!==null)window.cancelAnimationFrame(frame);
    frame=null;animations.forEach(animation=>animation.cancel());animations=[];
    hero.classList.remove('page-entering','page-unified');layer.hidden=true;
    document.documentElement.classList.remove('page-intro-pending');
  }
  async function assemble(id) {
    if(id!==generation || currentView!==view)return;
    const quiet=reduced.matches, compact=window.innerWidth<=720;
    hero.classList.add('page-entering');
    document.documentElement.classList.remove('page-intro-pending');
    layer.hidden=false;
    const tasks=pieces.map(({element,center},index)=>{
      const delay=quiet?noise(index+7)*700:noise(index+7)*380;
      const dx=(center[0]-50)*(compact?1.3:2.4),dy=(center[1]-50)*(compact?1:1.7);
      const transform='translate('+dx+'px,'+dy+'px) rotate('+((noise(index+30)-.5)*16)+'deg)';
      return animate(element,quiet
        ?[{opacity:0},{opacity:.55,offset:.45},{opacity:1}]
        :[{opacity:0,transform},{opacity:.7,offset:.28},{opacity:1,transform:'translate(0,0) rotate(0deg)'}],
        {duration:quiet?520:900,delay,fill:'both',easing:'cubic-bezier(.2,.7,.2,1)'});
    });
    const words=animate(content,[{opacity:0},{opacity:1}],{duration:450,delay:quiet?420:650,fill:'both'});
    await Promise.all([...tasks,words]);
    if(id!==generation)return;
    hero.classList.add('page-unified');
    await animate(layer,[{opacity:1},{opacity:0}],{duration:220,fill:'both'});
    if(id!==generation)return;
    layer.hidden=true;
    const images=followups.flatMap(element=>[...element.querySelectorAll('img')]);
    await Promise.all(images.map(image=>image.decode?image.decode().catch(()=>{}):Promise.resolve()));
    if(id!==generation)return;
    await Promise.all(followups.map((element,index)=>animate(element,quiet
      ?[{opacity:0},{opacity:1}]
      :[{opacity:0,transform:'translateY(14px)'},{opacity:1,transform:'translateY(0)'}],
      {duration:600,delay:index*90,fill:'both',easing:'cubic-bezier(.2,.7,.2,1)'})));
    if(id===generation)reset();
  }
  pageEntrances[view].cancel=reset;
  pageEntrances[view].play=()=>{
    if(view==='preview')$('demo-preview-video').pause();
    reset();hero.classList.add('page-entering');
    const id=generation, deadline=performance.now()+2200;
    function atTop(){
      if(id!==generation || currentView!==view)return;
      if(window.scrollY<=12){frame=null;assemble(id);return;}
      if(performance.now()>deadline){reset();return;}
      frame=window.requestAnimationFrame(atTop);
    }
    atTop();
  };
  window.addEventListener('pagehide',reset);
  reduced.addEventListener('change',reset);
}

// Flex width changes used to rewrap text and resize the common artwork surface.
// Reserve the largest legitimate state once per width, never in response to hover.
function initStablePanelFrames() {
  const groups=[...document.querySelectorAll('.result-panels')];
  if(!groups.length || !window.requestAnimationFrame)return;
  let pending=false;
  function measure() {
    pending=false;
    for(const group of groups) {
      if(window.innerWidth<=720){group.style.removeProperty('min-height');continue;}
      const width=group.getBoundingClientRect().width;
      if(!width)continue;
      const clone=group.cloneNode(true);
      clone.setAttribute('aria-hidden','true');clone.inert=true;
      clone.style.cssText='position:fixed!important;left:-20000px!important;top:0!important;width:'+width+'px!important;height:auto!important;min-height:0!important;max-height:none!important;margin:0!important;visibility:hidden!important;pointer-events:none!important;';
      const children=[...clone.children].filter(child=>child.matches('.capability,.result-panel'));
      clone.querySelectorAll('*').forEach(element=>{
        element.style.setProperty('transition','none','important');
        element.style.setProperty('animation','none','important');
        element.style.setProperty('transform','none','important');
      });
      group.parentElement.append(clone);
      let tallest=0;
      for(let active=-1;active<children.length;active++) {
        children.forEach((child,index)=>{
          child.classList.toggle('is-active',child.matches('.capability') && index===active);
          child.classList.toggle('is-emphasized',child.matches('.result-panel') && index===active);
          child.classList.remove('is-softened');
        });
        tallest=Math.max(tallest,clone.getBoundingClientRect().height);
      }
      clone.remove();group.style.minHeight=Math.ceil(tallest+2)+'px';
    }
  }
  function schedule(){if(!pending){pending=true;window.requestAnimationFrame(measure);}}
  window.addEventListener('resize',schedule);
  window.addEventListener('hashchange',schedule);
  if(document.fonts)document.fonts.ready.then(schedule);
  if(window.ResizeObserver){
    const widths=new WeakMap();
    const observer=new ResizeObserver(entries=>{
      for(const entry of entries){
        const width=entry.contentRect.width;
        if(widths.get(entry.target)!==width){widths.set(entry.target,width);schedule();}
      }
    });
    groups.forEach(group=>observer.observe(group));
  }
  schedule();
}

// Short public pages use one continuous reveal; header and About artwork remain stationary.
function createClarityEntrance(view,rootSelector) {
  const root=document.querySelector(rootSelector);
  if(!root || typeof root.animate!=='function')return;
  const content=root.querySelector('.clarity-content');
  if(!content)return;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  let generation=0,animation=null,firstPlay=true;
  function reset(){
    generation++;
    animation?.cancel();animation=null;
    root.classList.remove('page-clarity-entering');
    document.documentElement.classList.remove('page-intro-pending');
  }
  pageEntrances[view].cancel=reset;
  pageEntrances[view].play=()=>{
    reset();
    if(currentView!==view)return;
    if(view==='preview')$('demo-preview-video').pause();
    const id=generation;
    const initialStart=firstPlay && document.documentElement.dataset.entranceView===view?Number(document.documentElement.dataset.clarityStarted):NaN;
    firstPlay=false;
    const duration=Number.isFinite(initialStart)?Math.max(0,1250-(performance.now()-initialStart)):1250;
    root.classList.add('page-clarity-entering');
    animation=content.animate([
      {filter:'blur('+(reduced.matches?6:12)+'px)',opacity:.45},
      {filter:'blur(0px)',opacity:1}
    ],{duration,easing:'cubic-bezier(.2,.55,.3,1)',fill:'both'});
    animation.finished.then(()=>{if(id===generation)reset();}).catch(()=>{});
  };
  window.addEventListener('pagehide',reset);
}
function initPortraitBounce(){
  const portraits=[...document.querySelectorAll('.team-portrait')];
  if(!portraits.length || typeof portraits[0].animate!=='function' || !window.matchMedia)return;
  const animations=new Map();
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  function bounce(portrait){
    animations.get(portrait)?.cancel();
    const animation=portrait.animate(reduced.matches
      ?[{opacity:1},{opacity:.82,offset:.4},{opacity:1}]
      :[{transform:'translateY(0)'},{transform:'translateY(-7px)',offset:.4},{transform:'translateY(1px)',offset:.75},{transform:'translateY(0)'}],
      {duration:reduced.matches?280:430,easing:'ease-out'});
    animations.set(portrait,animation);
    animation.finished.then(()=>{if(animations.get(portrait)===animation)animations.delete(portrait);}).catch(()=>{});
  }
  portraits.forEach(portrait=>{
    portrait.addEventListener('pointerenter',event=>{if(event.pointerType!=='touch')bounce(portrait);});
    portrait.addEventListener('pointerdown',event=>{if(event.pointerType==='touch')bounce(portrait);});
  });
  function reset(){animations.forEach(animation=>animation.cancel());animations.clear();}
  window.addEventListener('hashchange',reset);window.addEventListener('pagehide',reset);
}
