'use strict';
const records = [ {
  id:'hackclub',
  type:'club',
  title:'Hack Club Slack',
  organizer:'Hack Club',
  format:'Online · asynchronous community',
  fit:'A place to connect with other young makers and ask coding questions. Free to join, with an age requirement to check first.',
  eligibility:'For ages 13–18. A college student older than 18 should choose another community; this example is not a universal match.',
  action:'View joining instructions',
  url:'https://hackclub.com/slack',
  facts:[['How to join',
  'Follow Hack Club’s Slack joining instructions.'],
  ['Meeting schedule',
  'Unknown · an asynchronous community, no recurring meeting listed.'],
  ['Membership intake',
  'Joining instructions are available; review the organizer’s requirements.']],
  sources:[ {
    name:'Hack Club · joining page',
    url:'https://hackclub.com/slack',
    note:'Organizer instructions for the free online Slack community, including its 13–18 age scope.'
  },
   {
    name:'Hack Club · Slack overview',
    url:'https://welcome.hackclub.com/Slack',
    note:'Organizer overview of the community. A recurring meeting schedule was not established in this source review.'
  }
  ],
  unknown:'Meeting schedule is unlisted. A community joining page does not establish a recurring club meeting or guarantee eligibility.'
},
 {
  id:'cosmo',
  type:'event',
  title:'Cosmo Hacks 2026',
  organizer:'Cosmo Hacks',
  format:'Online · beginner friendly',
  fit:'An online hackathon starting in December, with a theme of Tech for Student & Community Life. Beginners can participate.',
  eligibility:'Middle and high school students ages 13–18, plus college and graduate students. Solo or teams up to four, within the same division.',
  action:'Visit event organizer',
  url:'https://www.cosmohacks.com/',
  facts:[['Event starts',
  'Dec 19, 2026 · 10 AM CST (UTC−6)'],
  ['Event & submissions end',
  'Jan 18, 2027 · 4 PM CST (UTC−6)'],
  ['Registration deadline',
  'Unknown · the submission deadline is a separate date.']],
  sources:[ {
    name:'Cosmo Hacks · official event website',
    url:'https://www.cosmohacks.com/',
    note:'Organizer information on online format, beginner participation, theme, eligibility, and the event window.'
  },
   {
    name:'Cosmo Hacks · Devpost listing',
    url:'https://cosmohacks.devpost.com/',
    note:'Official event listing for event and submission details. The source review did not establish a separate registration cutoff.'
  }
  ],
  unknown:'Registration deadline unknown. January 18 is the event and project submission end, not a verified registration cutoff.'
}
];
const $ = id => document.getElementById(id);
const saved = new Set();
let activeFilter = 'all';
let appliedFormat = 'online';
let appliedWindow = 'december';
let appliedTypes = ['club',
'event'];
let toastTimer;
let lastEvidenceButton;
function cardHTML(record) {
  const isSaved = saved.has(record.id);
  return `<article class="opportunity-card"><div class="card-top"><span class="card-type">${record.type==='club'?'COMMUNITY':'EVENT'} · ONLINE</span><button type="button" class="save-button" data-save="${record.id}" aria-pressed="${isSaved}" aria-label="${isSaved?'Unsave':'Save'} ${record.title}">${isSaved?'Saved':'Save'}</button></div><h3>${record.title}</h3><p class="organizer">${record.organizer} · ${record.format}</p><p class="fit">${record.fit}</p><dl class="card-facts">${record.facts.map(([label,value])=>`<div><dt>${label}
  </dt><dd${value.startsWith('Unknown')?' class="unknown"':''}
  >${value}
  </dd></div>`).join('')}</dl><p class="eligibility-note"><strong>Before you join:</strong> ${record.eligibility}</p><div class="card-actions"><a class="button" href="${record.url}" target="_blank" rel="noopener noreferrer">${record.action}<span class="sr-only"> (opens in a new tab)</span></a><button type="button" class="evidence-button" data-evidence="${record.id}">View source notes</button></div><p class="checked">Prepared example · Sources reviewed Nov 18, 2026</p></article>`;
}
function render() {
  const visible = records.filter(record=> {
    if (!appliedTypes.includes(record.type)) return false;
    if(activeFilter==='saved'&&!saved.has(record.id))return false;
    if(['club',
    'event'].includes(activeFilter)&&record.type!==activeFilter)return false;
    if(record.type==='club'&&appliedFormat==='campus')return false;
    if(record.type==='event'&&appliedWindow==='november')return false;
    return true;
  }
  );
  $('results-grid').innerHTML=visible.map(cardHTML).join('');
  $('result-count').textContent=`${visible.length} prepared ${visible.length===1?'example':'examples'}`;
  $('saved-count').textContent=saved.size;
  $('empty-state').hidden=visible.length>0;
  $('empty-message').textContent=activeFilter==='saved'?'Save a result to keep it in view during this visit.':'These examples include an online community and a hackathon starting in December 2026. Try a broader scope.';
  document.querySelectorAll('[data-filter]').forEach(button=> {
    const selected=button.dataset.filter===activeFilter;
    button.classList.toggle('active',
    selected);
    button.setAttribute('aria-pressed',
    String(selected));
  }
  );
}
let currentView=null;
const homeEntrance={play(){},cancel(){}};
const pageEntrances={home:homeEntrance,preview:{play(){},cancel(){}},about:{play(){},cancel(){}}};
function route() {
  const hash=location.hash;
  const isDemo=['#demo','#app-main','#demo-cosmo'].includes(hash);
  const isAbout=['#about-us','#about-view'].includes(hash);
  const isPreview=['#demo-preview','#demo-preview-view'].includes(hash);
  const entersHomeTop=['','#home','#main'].includes(hash);
  Object.values(pageEntrances).forEach(entrance=>entrance.cancel());
  $('landing').hidden=isDemo || isAbout || isPreview;
  $('dashboard').hidden=!isDemo;
  $('about-view').hidden=!isAbout;
  $('demo-preview-view').hidden=!isPreview;
  $('public-header').hidden=isDemo;
  $('public-art').hidden=isDemo || isAbout;
  if(!isPreview)$('demo-preview-video').pause();
  document.title=isDemo?'Your possibilities — BearRok':isAbout?'About us — BearRok':isPreview?'Demo — BearRok':'BearRok — Find your next thing';
  document.querySelector('.skip').href=isDemo?'#app-main':isAbout?'#about-view':isPreview?'#demo-preview-view':'#main';
  document.querySelectorAll('.nav-cluster>a').forEach(link=>{
    const active=link.getAttribute('href')===(isPreview?'#demo-preview':isAbout?'#about-us':'#home');
    active?link.setAttribute('aria-current','page'):link.removeAttribute('aria-current');
  });
  const nextView=isDemo?'demo':isAbout?'about':isPreview?'preview':'home';
  if(isDemo) {
    render();window.scrollTo(0,0);$('app-main').focus({preventScroll:true});
    if(hash==='#demo-cosmo') {
      appliedTypes=['club','event'];appliedWindow='december';activeFilter='event';render();
      document.querySelector('[data-evidence="cosmo"]').click();
    }
  } else if(currentView!==nextView) {
    window.scrollTo(0,0);
    if(isAbout || isPreview)$(isAbout?'about-view':'demo-preview-view').focus({preventScroll:true});
  } else if(!hash || hash==='#home')window.scrollTo(0,0);
  currentView=nextView;
  if(entersHomeTop)homeEntrance.play();
  else if(isAbout)pageEntrances.about.play();
  else if(isPreview)pageEntrances.preview.play();
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
function toast(message) {
  clearTimeout(toastTimer);
  $('toast').textContent=message;
  $('toast').hidden=false;
  toastTimer=setTimeout(()=>$('toast').hidden=true,
  2800);
}
$('search-form').addEventListener('submit',
event=> {
  event.preventDefault();
  if(!$('student-ask').value.trim()) {
    $('scope-notice').hidden=false;
    $('scope-notice').textContent='Add what you want to find, then explore the prepared examples.';
    $('student-ask').focus();
    return;
  }
  const request = $('student-ask').value.trim();
  const wantsClub = /\b(clubs?|communit(?:y|ies)|people|friends?)\b/i.test(request);
  const wantsEvent = /\b(events?|hackathons?|competitions?|workshops?)\b/i.test(request);
  if (wantsClub && $('community-format').value === 'clarify') {
    $('scope-notice').hidden = false;
    $('scope-notice').textContent = 'One useful detail: should the community also meet online, or would you prefer one near your campus? Choose a Community format above, then explore the prepared results.';
    $('community-format').focus();
    return;
  }
  appliedTypes = [wantsClub ? 'club' : null,
  wantsEvent ? 'event' : null].filter(Boolean);
  appliedFormat=$('community-format').value;
  appliedWindow=$('window').value;
  activeFilter='all';
  const campus=$('campus').value.trim();
  const types = appliedTypes.map(type => type === 'club' ? 'communities' : 'events').join(' and ');
  const notes=[`Your request: “${request}”`,
  `Prepared scope: ${types || 'no supported opportunity type recognized'}. This is keyword matching against two examples, not a live search.`];
  if (!appliedTypes.length) notes.push('Try asking for a coding community or an online hackathon. Scholarships and research openings are outside this demo.');
  if(appliedFormat==='campus')notes.push(campus?`No campus community is available in this example set for ${campus}.`:'Add a campus when you connect live discovery. This example set has no local community.');
  else notes.push('The community example is online; its age requirement still applies.');
  if(appliedWindow==='november')notes.push('No example event starts in November.');
  $('scope-notice').textContent=notes.join(' ');
  $('scope-notice').hidden=false;
  render();
}
);
document.querySelector('.filter-tabs').addEventListener('click',
event=> {
  const button=event.target.closest('[data-filter]');
  if(button) {
    activeFilter=button.dataset.filter;
    render();
  }
}
);
$('results-grid').addEventListener('click',
event=> {
  const saveButton=event.target.closest('[data-save]');
  if(saveButton) {
    const id=saveButton.dataset.save;
    const saving=!saved.has(id);
    saving?saved.add(id):saved.delete(id);
    render();
    toast(saving?'Saved for this visit.':'Removed from saved.');
    const next=document.querySelector(`[data-save="${id}"]`);
    if(next)next.focus();
    else document.querySelector('[data-filter="saved"]').focus();
    return;
  }
  const evidenceButton=event.target.closest('[data-evidence]');
  if(evidenceButton) {
    const record=records.find(item=>item.id===evidenceButton.dataset.evidence);
    lastEvidenceButton=evidenceButton;
    $('dialog-body').innerHTML=`<h2 id="dialog-title">${record.title}</h2><p>Manually reviewed on November 18, 2026. These notes support a prepared example, not a live verification run.</p>${record.sources.map(source=>`<div class="source-entry"><strong>${source.name}
    </strong><p>${source.note}
    </p><a href="${source.url}" target="_blank" rel="noopener noreferrer">${source.url}
    <span class="sr-only"> (opens in a new tab)</span></a></div>`).join('')}<div class="source-warning"><strong>What remains unknown</strong><br>${record.unknown}</div>`;
    $('evidence-dialog').showModal();
  }
}
);
$('close-dialog').addEventListener('click',
()=>$('evidence-dialog').close());
$('evidence-dialog').addEventListener('click',
event=> {
  if(event.target===$('evidence-dialog')) {
    const rect=event.target.getBoundingClientRect();
    if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)event.target.close();
  }
}
);
$('evidence-dialog').addEventListener('close',
()=> {
  if(lastEvidenceButton?.isConnected)lastEvidenceButton.focus();
}
);
$('reset-filters').addEventListener('click',
()=> {
  activeFilter='all';
  appliedTypes=['club',
  'event'];
  appliedFormat='online';
  appliedWindow='december';
  $('student-ask').value='I want a beginner-friendly coding community and an online hackathon next month.';
  $('community-format').value='online';
  $('window').value='december';
  $('scope-notice').hidden=true;
  render();
  document.querySelector('[data-filter="all"]').focus();
}
);
initHomeEntrance();
window.addEventListener('hashchange',route);
route();


// Native scroll remains in charge. Geometry drives reversible motion only;
// everything stays visible when JavaScript or motion is unavailable.
function initLandingStory() {
  if (!window.matchMedia || !window.requestAnimationFrame) return;
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const landing = $('landing');
  const art = document.querySelector('.flow-art');
  const pair = document.querySelector('.capability-pair');
  const panels = [...document.querySelectorAll('[data-capability]')];
  let framePending = false;

  function activatePanel(panel) {
    pair.dataset.active = panel.dataset.capability;
    panels.forEach(item => {
      const active = item === panel;
      item.classList.toggle('is-active', active);
      item.querySelector('button').setAttribute('aria-expanded', String(active));
    });
  }
  panels.forEach(panel => {
    panel.addEventListener('pointerenter', event => {
      if (event.pointerType !== 'touch') activatePanel(panel);
    });
    panel.addEventListener('focusin', () => activatePanel(panel));
    panel.querySelector('button').addEventListener('click', () => activatePanel(panel));
  });

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
  function update() {
    pending=false;
    const available=Math.max(0,landing.scrollHeight-window.innerHeight);
    const top=landing.hidden?0:Math.min(1,window.scrollY/100);
    const bottom=landing.hidden?0:Math.min(1,Math.max(0,available-window.scrollY)/70);
    landing.style.setProperty('--edge-top',String(Math.max(0,top)*.8));
    landing.style.setProperty('--edge-bottom',String(Math.max(0,bottom)*.8));
  }
  function schedule(){if(!pending){pending=true;window.requestAnimationFrame(update);}}
  window.addEventListener('scroll',schedule,{passive:true});
  window.addEventListener('resize',schedule);
  window.addEventListener('hashchange',schedule);
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
    const target=$({home:'main',about:'about-view',preview:'demo-preview-view',demo:'app-main'}[currentView] || 'main');
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
  createPageEntrance('preview','.demo-page','.demo-page-heading');
  createPageEntrance('about','.about-view','.about-copy');
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
    element.style.background=pieces.length%11===0?'#eee6cfdb':'#edf4f0e8';
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
  const groups=[...document.querySelectorAll('.capability-pair,.result-panels')];
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
