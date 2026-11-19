const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const elements=new Map();
function element(id){
  if(!elements.has(id))elements.set(id,{
    hidden:false,innerHTML:'',listeners:{},classList:{toggle(){}},
    addEventListener(type,listener){this.listeners[type]=listener;},
    focus(){this.focused=true;},scrollIntoView(){this.scrolled=true;},setAttribute(){},
    showModal(){this.open=true;},close(){this.open=false;},pause(){this.paused=true;}
  });
  return elements.get(id);
}
const location={hash:'#home'};
const context=vm.createContext({
  document:{getElementById:element,querySelector:element,querySelectorAll:()=>[],title:''},
  location,history:{replaceState(_state,_title,hash){location.hash=hash;}},
  window:{scrollTo(){},addEventListener(){}},setTimeout,clearTimeout,console
});
const source=fs.readFileSync(__dirname+'/dist/app.js','utf8');
vm.runInContext(source,context);
assert.equal(element('landing').hidden,false);
assert.equal(element('home-edge-lenses').hidden,false);
for(const hash of ['#demo','#app-main','#demo-cosmo','#dashboard','#results-grid','#search-form','#demo-old-result']){
  location.hash=hash;vm.runInContext('route()',context);
  assert.equal(location.hash,'#demo-preview');
  assert.equal(element('demo-preview-view').hidden,false);
  assert.equal(element('landing').hidden,true);
  assert.equal(element('public-header').hidden,false);
  assert.equal(element('home-edge-lenses').hidden,true);
}
location.hash='#about-us';vm.runInContext('route()',context);
assert.equal(element('about-view').hidden,false);
assert.equal(element('public-art').hidden,true);
assert.equal(element('demo-preview-video').paused,true);
location.hash='#demo-preview-view';vm.runInContext('route()',context);
assert.equal(element('demo-preview-view').hidden,false);
location.hash='#home';vm.runInContext('route()',context);
assert.equal(element('landing').hidden,false);
assert.equal(element('demo-preview-view').hidden,true);
vm.runInContext('openSourceNotes(null)',context);
assert.equal(element('evidence-dialog').open,true);
assert.match(element('dialog-body').innerHTML,/Registration deadline unknown/);
assert.match(element('dialog-body').innerHTML,/May 10.*sample UI data/);
const html=fs.readFileSync(__dirname+'/dist/index.html','utf8');
assert.doesNotMatch(html,/id="dashboard"|id="search-form"|id="results-grid"|Test the prototype|id="demo-download-note"/);
assert.doesNotMatch(html,/href="#(?:demo|app-main|demo-cosmo)"/);
assert.match(html,/class="button demo-download"[^>]*disabled/);
assert.match(html,/X search is enabled/);
assert.match(html,/video[\s\S]*controls playsinline preload="metadata"/);
assert.match(html,/rel="icon"[^>]*assets\/bearrok-mark\.svg/);
assert.doesNotMatch(html,/assets\/logo\.png|class="brand-mark"|>\s*b\.\s*</);
const logo=fs.readFileSync(__dirname+'/dist/assets/bearrok-mark.svg','utf8');
assert.equal(require('node:crypto').createHash('sha256').update(logo).digest('hex'),'0541e0f2d48635d5d6911e018ab3941f65bb2f21076e08cd4a40f8aaec20e66b','Use the original smooth Figma export');
assert.match(logo,/viewBox="0 0 896 820"/);
assert.equal((logo.match(/<path\b/g)||[]).length,3,'Use the original smooth Figma vector');
assert.match(logo,/<linearGradient\b/);
assert.doesNotMatch(logo,/<image\b|<clipPath\b|<mask\b|data:image|base64/i);
assert.doesNotMatch(logo,/painted-brushwork|fleet-activity/);
assert.ok(Buffer.byteLength(logo)<65000,'Keep the smooth SVG compact');
const css=fs.readFileSync(__dirname+'/dist/styles.css','utf8');
assert.doesNotMatch(css,/\.brand-mark\b|\.mini-brand\b|content:\s*['"]b\./);
assert.match(css,/block-size:1\.86em/);
assert.equal(fs.existsSync(__dirname+'/dist/assets/logo.png'),false);
assert.doesNotMatch(css,/@media\s*\(prefers-color-scheme:dark\)/);
assert.match(css,/color-scheme:only light/);
assert.match(html,/name="color-scheme" content="light"/);
assert.doesNotMatch(html,/Grok implementation/);
assert.match(html,/href="#workflow">\s*Read the agent design/);
context.window.requestAnimationFrame=callback=>callback();
location.hash='#workflow';vm.runInContext('route()',context);
assert.equal(element('landing').hidden,false);assert.equal(element('workflow').scrolled,true);
console.log('Passed: retired deep links redirect to guided Demo; Home/About/video/edges; source notes; disabled download; original smooth vector logo/favicon; prototype UI removed.');

// Exercise the actual deck controller independently of browser layout.
function deckTarget(){return {style:{setProperty(name,value){this[name]=value;}},handlers:{},dataset:{},classList:{toggle(){},add(){},remove(){}},addEventListener(type,fn){this.handlers[type]=fn;},setAttribute(name,value){this[name]=value;},focus(){this.focused=true;}};}
const deck=deckTarget();deck.contains=()=>false;
const cards=['discover','evidence','internships','scholarships'].map(name=>{
 const card=deckTarget(),button=deckTarget(),detail={};card.dataset.capability=name;
 card.querySelector=selector=>selector==='.capability-toggle'?button:detail;return card;
});
context.deck=deck;context.cards=cards;
vm.runInContext('initCapabilityDeck(deck,cards)',context);
assert.equal(deck.dataset.active,'discover');
cards[2].querySelector('.capability-toggle').handlers.click({});
assert.equal(deck.dataset.active,'internships');
cards[2].querySelector('.capability-toggle').handlers.keydown({key:'ArrowRight',preventDefault(){}});
assert.equal(deck.dataset.active,'scholarships');
assert.equal(cards[3].querySelector('.capability-toggle')['aria-expanded'],'true');
assert.equal(cards[2].querySelector('.capability-detail').inert,true);
deck.handlers.pointerdown({button:0,target:{closest:()=>null},clientX:150,clientY:20,pointerId:1});
deck.handlers.pointermove({clientX:220,clientY:23,pointerId:1});
assert.equal(deck.dataset.active,'internships');
deck.handlers.pointerup();
assert.equal((html.match(/data-capability=/g)||[]).length,4);
assert.match(css,/top:0;height:40px;--edge-mask/);assert.match(css,/bottom:0;height:56px;--edge-mask/);
assert.match(css,/height:min\(70px,9\.33333335svh\)/);
console.log('Passed: four-category deck selection, keyboard, swipe, accessible state, and halved Home bands.');

// A layout-generated pointer event at unchanged coordinates cannot chase selection.
deck.handlers.pointermove({pointerType:'mouse',clientX:300,clientY:100,target:{closest:()=>cards[1]}});
assert.equal(deck.dataset.active,'evidence');
deck.handlers.pointermove({pointerType:'mouse',clientX:300,clientY:100,target:{closest:()=>cards[2]}});
assert.equal(deck.dataset.active,'evidence');
deck.handlers.pointermove({pointerType:'mouse',clientX:320,clientY:100,target:{closest:()=>cards[2]}});
assert.equal(deck.dataset.active,'internships');
assert.match(css,/margin-left:-22px/);assert.match(css,/margin-left:-8px/);
console.log('Passed: overlapping deck and stationary-pointer selection guard.');

assert.match(html,/<strong>Grok<\/strong>/);
assert.doesNotMatch(html,/--deck-index|--deck-slot/);
assert.doesNotMatch(css,/Fixed category rail|Equal-size cards move/);
console.log('Passed: restored fixed-order flex deck with attached category controls.');

assert.equal((html.match(/class="capability-face"/g)||[]).length,4);
assert.doesNotMatch(css,/margin-top:12px;margin-bottom:12px|margin-top:24px;margin-bottom:24px|margin-top:36px;margin-bottom:36px/);
assert.match(css,/flex-direction:row;align-items:stretch/);
assert.match(css,/flex-basis:var\(--expanded-card\)/);
console.log('Passed: equal desktop card heights and full-height horizontal mobile faces.');

let pageScrolls=0;context.window.scrollTo=()=>{pageScrolls++;};
context.window.matchMedia=()=>({matches:true});context.setTimeout=callback=>callback();
deck.clientWidth=265;deck.scrollTo=options=>{deck.laneLeft=options.left;};
cards.forEach((card,i)=>{card.offsetLeft=12+i*48;card.offsetWidth=i===3?209:56;});
vm.runInContext('initCapabilityDeck(deck,cards)',context);
cards[3].querySelector('.capability-toggle').handlers.click({});
assert.equal(deck.laneLeft,112,'Clamp last selection to the card edge, retaining the previous handle');
assert.equal(pageScrolls,0,'Selection scrolls the mobile lane only');
console.log('Passed: mobile selection reveal retains a neighbor without scrolling the page.');
