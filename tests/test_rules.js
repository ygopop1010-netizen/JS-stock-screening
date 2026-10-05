const assert=require('node:assert/strict');
const {sizePosition,relativeStrength}=require('../static/rules.js');
const p={capital:50000000,entry:50000,stop:46000,target1:58000,target2:62000,pct:.6,minrr:2,cost:0,existingrisk:0,totalrisk:3,losses:0,invested:0,exposure:100};
assert.equal(sizePosition(p).qty,75); // Book chapter 6 worked example.
assert.equal(sizePosition({...p,cost:.3}).qty,72);
assert.equal(sizePosition({...p,losses:3}).qty,37);
assert.equal(sizePosition({...p,existingrisk:1500000}).qty,0);
assert.equal(sizePosition({...p,invested:50000000}).qty,0);
assert.equal(sizePosition({...p,exposure:0}).qty,0);
assert.throws(()=>sizePosition({...p,stop:50000}));
assert.throws(()=>sizePosition({...p,capital:NaN}));
const benchmark={date:'2026-01-41',history:Array.from({length:41},(_,i)=>({date:`2026-01-${i+1}`,close:100}))};
const stock={date:benchmark.date,history:benchmark.history.map((b,i)=>({...b,close:100+(i>20?(i-20)*2:0)}))};
assert.equal(relativeStrength(stock,benchmark).improving,true);
assert.equal(relativeStrength({...stock,date:'different'},benchmark),null);
assert.equal(relativeStrength({...stock,history:stock.history.slice(0,20)},benchmark),null);
console.log('Position sizing and aligned relative-strength checks passed');
