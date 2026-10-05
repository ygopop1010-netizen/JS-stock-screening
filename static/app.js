const $ = id => document.getElementById(id);
let stocks=[], markets=[], selected=null;
let watch;try{watch=new Set(JSON.parse(localStorage.getItem('swing-watch')||'[]'));}catch{watch=new Set();}
const num=(n,d=2)=>Number.isFinite(n)?n.toLocaleString('ko-KR',{maximumFractionDigits:d}):'—';
function node(tag,text,cls){const e=document.createElement(tag);e.textContent=text;if(cls)e.className=cls;return e;}
function render(){
 const grid=$('market-grid');grid.replaceChildren();
 for(const m of markets){const card=node('div','', 'market');card.append(node('b',m.name));if(m.error){card.append(node('p','수집 실패','down'));}else{card.append(node('strong',num(m.price)),node('span',`20일 ${num(m.momentum)}%`,m.momentum>=0?'up':'down'),node('small',`${m.date} · ${m.price>m.ma20?'20일선 위':'20일선 아래'}`));if(m.dropped_bars)card.append(node('small',`제공자 오류 ${m.dropped_bars}개 행 제외 · 구간 왜곡 가능`,'neutral'));}grid.append(card);}
 const indices=markets.filter(m=>!m.error&&!['^VIX','^TNX','KRW=X','CL=F','GC=F'].includes(m.symbol));
 const bullish=indices.filter(m=>m.price>m.ma20&&m.ma20>m.ma60).length;
 $('regime').textContent=!indices.length?'판단 불가':bullish/indices.length>=.6?'상승 우세':bullish/indices.length<=.3?'방어적':'혼조';
 $('regime-detail').textContent=`확인 가능 지수 ${indices.length}개 중 상승 추세 ${bullish}개`;
 const vix=markets.find(m=>m.symbol==='^VIX'&&!m.error), fx=markets.find(m=>m.symbol==='KRW=X'&&!m.error);
 $('risk').textContent=[vix?`VIX ${num(vix.price)}`:'VIX 미확인',fx?`환율 ${fx.momentum>0?'상승':'하락'}`:'환율 미확인'].join(' · ');
 $('candidates').textContent=stocks.filter(s=>!s.error&&s.score>=70).length+'개';
 const filter=$('filter').value;
 const visible=stocks.filter(s=>filter==='all'||filter==='KR'&&/\.(KS|KQ)$/.test(s.symbol)||filter==='US'&&!/\.(KS|KQ)$/.test(s.symbol)||filter==='candidate'&&s.score>=70||filter==='watch'&&watch.has(s.symbol)).sort((a,b)=>(b.score??-1)-(a.score??-1));
 $('rows').replaceChildren();
 for(const s of visible){const tr=node('tr','');const star=node('button',watch.has(s.symbol)?'★':'☆','star');star.setAttribute('aria-label',`${s.name} 관심 종목 변경`);star.onclick=()=>{watch.has(s.symbol)?watch.delete(s.symbol):watch.add(s.symbol);localStorage.setItem('swing-watch',JSON.stringify([...watch]));render();};let td=node('td','');td.append(star);tr.append(td);td=node('td',s.name);td.append(node('small',s.symbol+' · '+(s.date||'데이터 없음')));tr.append(td);
 if(s.error){const cell=node('td','수집 실패 · CSV 분석 가능','down');cell.colSpan=5;tr.append(cell);}else{tr.append(node('td',`${num(s.price)} ${s.currency||''}`),node('td',`${num(s.momentum)}%`,s.momentum>=0?'up':'down'),node('td',num(s.rsi,1)),node('td',`${s.score} · ${s.signal}`,s.score>=70?'up':'neutral'));td=node('td','');const button=node('button','계획 보기');button.onclick=()=>{selected=s;loadPlan();$('plan').scrollIntoView({behavior:'smooth'});};td.append(button);tr.append(td);} $('rows').append(tr);}
 if(!visible.length){const tr=node('tr','');const td=node('td','표시할 종목이 없습니다.');td.colSpan=7;tr.append(td);$('rows').append(tr);}
}
const fields=['entry','stop','target1','target2','minrr','cost','existingrisk','totalrisk','losses','invested','exposure','capital','riskpct','marketstate','financial','quality','valuation','sector','flow','event','setup','reviewdate','evidence','thesis','counter','exitplan'];
const questions=['시장 국면 확인','업종의 시장 대비 강도 확인','최근 실적·현금흐름 확인','부채·증자·CB/BW 희석 확인','ROIC·자본효율 추세 확인','상대강도 개선 확인','충분한 거래대금 확인','지지·돌파·눌림 진입 근거','명확한 무효화 가격','1회 허용손실 금액','손절폭 기반 수량 역산','매도 계획 수립'];
questions.forEach((text,i)=>{const label=node('label','');const box=document.createElement('input');box.type='checkbox';box.id='check'+i;box.onchange=plan;label.append(box,document.createTextNode(`${i+1}. ${text}`));$('checklist').append(label);});
let plans={};try{plans=JSON.parse(localStorage.getItem('swing-plans')||'{}');}catch{}
function loadPlan(){const saved=plans[selected.symbol];fields.forEach(id=>{if(saved?.values?.[id]!==undefined)$(id).value=saved.values[id];else if(['entry','stop','target1','target2','reviewdate','evidence','thesis','counter','exitplan'].includes(id))$(id).value=id==='entry'?selected.price:'';else if($(id).tagName==='SELECT')$(id).value='unknown';});questions.forEach((_,i)=>$('check'+i).checked=!!saved?.checks?.[i]);$('saved').textContent=saved?`저장 기록: ${new Date(saved.savedAt).toLocaleString('ko-KR')}`:'';plan();}
function benchmarkFor(s){return markets.find(m=>m.symbol===(s.symbol.endsWith('.KS')?'^KS11':s.symbol.endsWith('.KQ')?'^KQ11':'^GSPC')&&!m.error);}
function plan(){if(!selected)return;const s=selected;$('selected').textContent=`${s.name} (${s.symbol}) · ${s.date} · ${s.currency||'CSV 표시 통화'} 기준`;
 const out=$('plan-output');out.replaceChildren();const bench=benchmarkFor(s),rs=relativeStrength(s,bench);
 const evidence=[`가격 ${num(s.price)} · MA20/60/120 ${num(s.ma20)}/${num(s.ma60)}/${num(s.ma120)}`,`직전 20일 저항 ${num(s.resistance20)} · 최근 20일 저점 ${num(s.support20)}`,`ATR14 ${num(s.atr)} · 2ATR 참고선 ${num(s.stop)} (손절 확정 아님)`,`20일 평균 거래대금 ${num(s.turnover20)} · 상대 거래량 ${num(s.volume_ratio)}`,rs?`${bench.name} 대비 20일 초과수익 ${num(rs.current)}%p · 전 구간보다 ${rs.improving?'개선':'악화'}`:'지수 대비 상대강도 미확인 (같은 기준일 41개 공통 일봉 필요)'];
 evidence.forEach(text=>out.append(node('div',text)));
 let calc;try{calc=sizePosition({capital:Number($('capital').value),entry:Number($('entry').value),stop:Number($('stop').value),target1:Number($('target1').value),target2:Number($('target2').value),pct:Number($('riskpct').value),minrr:Number($('minrr').value),cost:Number($('cost').value),existingrisk:Number($('existingrisk').value),totalrisk:Number($('totalrisk').value),losses:Number($('losses').value),invested:Number($('invested').value),exposure:Number($('exposure').value)});}catch(e){out.append(node('p',`행동: 기다림 · ${e.message}`,'neutral'));return;}
 const blockers=[];
 if(s.dropped_bars||bench?.dropped_bars)blockers.push("제공자 OHLC 오류 행 제외: 원자료 재확인 필요");
 if(!['attack','neutral'].includes($('marketstate').value))blockers.push($('marketstate').value==='defense'?'방어 국면: 신규매수 축소':'시장 국면 미확인');
 ['financial','quality','valuation','sector','flow','event'].forEach(id=>{if($(id).value!=='pass')blockers.push(`${$(id).parentElement.firstChild.textContent.trim()}：${$(id).selectedOptions[0].textContent}`);});
 if(!rs||!rs.improving||rs.current<=0)blockers.push('상대강도 개선 미확인');
 if($('setup').value==='unknown')blockers.push('진입 구조 미정');
 ['reviewdate','evidence','thesis','counter','exitplan'].forEach(id=>{if(!$(id).value.trim())blockers.push('근거·가설·무효화·청산 기록 필요');});
 if(!questions.every((_,i)=>$('check'+i).checked))blockers.push('12문항 체크 미완료');
 if(!calc.meetsRR)blockers.push('비용 반영 손익비 부족');
 if(calc.qty===0)blockers.push('계좌 한도로 진입 가능 수량 없음');
 const age=s.date?Date.now()-new Date(s.date+'T00:00:00Z').getTime():Infinity;const fresh=age>=0&&age<7*86400000;
 if(!fresh)blockers.push('7일 이상 지난 시세: 갱신 필요 (앱 임시 기준)');
 const reviewed=$('reviewdate').value; if(reviewed&&(Date.now()-new Date(reviewed+'T00:00:00Z').getTime()>30*86400000||new Date(reviewed+'T00:00:00Z').getTime()>Date.now()))blockers.push('근거 확인일 재검토 (30일 기준은 앱 임시 기준)');
 out.append(node('h3',blockers.length?'행동: 기다림 / 위험 확인':'행동: 진입 검토 가능 · 수동 검토 기준',blockers.length?'neutral':'up'));
 for(const text of [`손절 ${num(Number($('stop').value))} · 비용 포함 1주 위험 ${num(calc.risk)}`,`1차/2차 청산 ${num(Number($('target1').value))} / ${num(Number($('target2').value))}`,`비용 반영 1차 손익비 ${num(calc.rr)} : 1`,`손실예산 ${num(calc.budget)} · 최대 ${num(calc.qty,0)}주 · 예상 손실 ${num(calc.expectedLoss)}`,`가용 신규 투자금 ${num(calc.available)} · 연속 손실 축소 계수 ${calc.factor}`,`미충족: ${[...new Set(blockers)].join(' · ')||'기록된 필수 조건 충족'}`])out.append(node('div',text));
 out.append(node('small','통과는 사용자 기록 기준입니다. 상관관계·갭 위험은 수량 계산에 포함되지 않습니다. 자동 주문하지 않습니다.'));
}
fields.forEach(id=>$(id).addEventListener('input',plan));
$('saveplan').onclick=()=>{if(!selected){$('saved').textContent='먼저 종목을 선택하세요.';return;}plans[selected.symbol]={symbol:selected.symbol,values:Object.fromEntries(fields.map(id=>[id,$(id).value])),checks:questions.map((_,i)=>$('check'+i).checked),savedAt:new Date().toISOString()};try{localStorage.setItem('swing-plans',JSON.stringify(plans));$('saved').textContent='이 브라우저에 계획을 저장했습니다.';}catch{$('saved').textContent='저장 실패: 브라우저 저장 공간을 확인하세요.';}};
$('exportplan').onclick=()=>{const blob=new Blob([JSON.stringify(plans,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='swing-journal.json';a.click();URL.revokeObjectURL(url);};
try{$('macronotes').value=localStorage.getItem('swing-macro')||'';}catch{}
$('savemacro').onclick=()=>{try{localStorage.setItem('swing-macro',$('macronotes').value);$('macrostatus').textContent=' 기록 저장 완료';}catch{$('macrostatus').textContent=' 저장 실패';}};
$('refreshmacro').onclick=async()=>{const button=$('refreshmacro');button.disabled=true;$('economicstatus').textContent='FRED 경제 관측값 조회 중…';try{const response=await fetch('/api/macro');if(!response.ok)throw Error('서버 응답 오류');const data=await response.json();$('economicgrid').replaceChildren();for(const item of data.observations){const card=node('div','', 'market');card.append(node('b',item.name));if(item.error)card.append(node('p','수집 실패 · 네트워크/제공자 접근 확인','down'));else{card.append(node('strong',`${num(item.value)}${item.unit}`),node('p',item.signal),node('small',`${item.date} 관측 · ${item.source}`));const link=node('a','원문 관측값 ↗');link.href=item.url;link.target='_blank';link.rel='noopener noreferrer';card.append(link);} $('economicgrid').append(card);}const errors=data.observations.filter(x=>x.error).length;$('economicstatus').textContent=`경제지표 조회 완료 · 수집 실패 ${errors}개 · 신호는 관측 해석이며 예측이 아닙니다.`;}catch(e){$('economicstatus').textContent=`경제지표 조회 실패: ${e.message}`;}finally{button.disabled=false;}};
$('filter').onchange=render;$('capital').oninput=plan;$('riskpct').oninput=plan;
$('refresh').onclick=async()=>{const button=$('refresh');button.disabled=true;$('status').textContent='글로벌 시장과 종목 일봉을 수집하는 중입니다…';try{const response=await fetch('/api/dashboard');if(!response.ok)throw Error('서버 응답 오류');const data=await response.json();const imported=stocks.filter(s=>s.source==='사용자 CSV');stocks=data.stocks.map(s=>s.error?(imported.find(x=>x.symbol===s.symbol)||s):s);stocks.push(...imported.filter(s=>!stocks.some(x=>x.symbol===s.symbol)));const importedMarkets=markets.filter(m=>m.source==='사용자 CSV');markets=data.markets.map(m=>m.error?(importedMarkets.find(x=>x.symbol===m.symbol)||m):m);render();const failures=[...stocks,...markets].filter(s=>s.error).length;$('status').textContent=`갱신 완료 · ${new Date(data.fetched_at).toLocaleString('ko-KR')} · 수집 실패 ${failures}개. 기준일이 오래된 자료는 매매에 사용하기 전에 확인하세요.`;}catch(e){$('status').textContent=`갱신 실패: ${e.message}`;}finally{button.disabled=false;}};
$('import').onclick=async()=>{try{const file=$('csv').files[0];if(!file)throw Error('CSV 파일을 선택하세요.');if(file.size>2000000)throw Error('CSV는 2MB 이하만 가능합니다.');const response=await fetch('/api/import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({symbol:$('symbol').value,csv:await file.text()})});const data=await response.json();if(!response.ok)throw Error(data.error);if(data.kind==='market'){markets=markets.filter(m=>m.symbol!==data.symbol);markets.push(data);}else{stocks=stocks.filter(s=>s.symbol!==data.symbol);stocks.push(data);}render();$('status').textContent=`${data.symbol} CSV 분석 완료 · 기준일 ${data.date} · 실제 매매 전 조정주가 여부를 확인하세요.`;}catch(e){$('status').textContent=`CSV 분석 실패: ${e.message}`;}};
