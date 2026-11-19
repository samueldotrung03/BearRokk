const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const elements = new Map();
function element(id) {
  if (!elements.has(id)) elements.set(id, {
    value: '', hidden: false, textContent: '', innerHTML: '', dataset: {},
    listeners: {}, classList: { toggle() {} },
    addEventListener(type, listener) { this.listeners[type] = listener; },
    focus() {}, setAttribute() {}, click() {},
    showModal() { this.open = true; }, close() { this.open = false; },
    pause() { this.paused = true; }
  });
  return elements.get(id);
}
const context = vm.createContext({
  document: {
    getElementById: element,
    querySelector: element,
    querySelectorAll: () => [],
    title: ''
  },
  location: { hash: '#demo' },
  window: { scrollTo() {}, addEventListener() {} },
  setTimeout, clearTimeout, console
});
vm.runInContext(fs.readFileSync(__dirname + '/dist/app.js', 'utf8'), context);
assert.match(element('results-grid').innerHTML, /Cosmo Hacks 2026/);
assert.match(element('results-grid').innerHTML, /Dec 19, 2026/);
assert.match(element('results-grid').innerHTML, /Unknown · the submission deadline is a separate date/);
assert.doesNotMatch(element('results-grid').innerHTML, /May 10, 2027/);
assert.doesNotMatch(element('results-grid').innerHTML, /\$ \{/);
const submit = element('search-form').listeners.submit;
function search(text, format = 'online', date = 'december') {
  element('student-ask').value = text;
  element('community-format').value = format;
  element('window').value = date;
  submit({ preventDefault() {} });
}
search('Find an online hackathon');
assert.match(element('results-grid').innerHTML, /Cosmo Hacks/);
assert.doesNotMatch(element('results-grid').innerHTML, /Hack Club Slack/);
search('Find a coding community');
assert.match(element('results-grid').innerHTML, /Hack Club Slack/);
assert.doesNotMatch(element('results-grid').innerHTML, /Cosmo Hacks/);
search('Find a scholarship');
assert.equal(element('empty-state').hidden, false);
assert.equal(element('results-grid').innerHTML, '');
search('Find a club and an online hackathon', 'clarify');
assert.match(element('scope-notice').textContent, /should the community also meet online/);
search('Find a community', 'campus');
assert.equal(element('empty-state').hidden, false);
search('Find a hackathon', 'online', 'november');
assert.equal(element('empty-state').hidden, false);
context.location.hash = '#app-main';
vm.runInContext('route()', context);
assert.equal(element('dashboard').hidden, false);
console.log('Passed: populated facts, request types, unsupported requests, location clarification, campus/date empty states, dashboard skip route.');

context.location.hash = '#about-us';
vm.runInContext('route()', context);
assert.equal(element('landing').hidden, true);
assert.equal(element('about-view').hidden, false);
assert.equal(element('public-art').hidden, true);
assert.equal(element('public-header').hidden, false);
context.location.hash = '#demo-preview';
vm.runInContext('route()', context);
assert.equal(element('demo-preview-view').hidden, false);
assert.equal(element('public-art').hidden, false);
assert.equal(element('about-view').hidden, true);
assert.equal(element('landing').hidden, true);
assert.equal(element('public-header').hidden, false);
element('demo-preview-video').paused = false;
context.location.hash = '#home';
vm.runInContext('route()', context);
assert.equal(element('demo-preview-view').hidden, true);
assert.equal(element('demo-preview-video').paused, true);
assert.equal(element('landing').hidden, false);
assert.equal(element('public-art').hidden, false);
context.location.hash = '#demo-preview-view';
vm.runInContext('route()', context);
assert.equal(element('demo-preview-view').hidden, false);
context.location.hash = '#demo';
vm.runInContext('route()', context);
assert.equal(element('dashboard').hidden, false);
assert.equal(element('public-header').hidden, true);
assert.equal(element('public-art').hidden, true);
assert.equal(element('demo-preview-view').hidden, true);
console.log('Passed: dedicated About and Demo pages, shared header, deep-link alias, video pause on exit, interactive dashboard route.');
