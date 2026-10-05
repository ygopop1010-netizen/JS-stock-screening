/* User-adjustable application policy; not verbatim thresholds from the book. */
function sizePosition(p) {
  if (!Object.values(p).every(Number.isFinite)) throw Error('모든 수치를 확인하세요.');
  if (p.capital<=0 || p.entry<=0 || p.stop<=0 || p.stop>=p.entry || p.target1<=p.entry || p.target2<p.target1 || p.pct<=0 || p.pct>5 || p.minrr<=0 || p.cost<0 || p.cost>10 || p.existingrisk<0 || p.totalrisk<=0 || p.totalrisk>100 || p.losses<0 || !Number.isInteger(p.losses) || p.invested<0 || p.exposure<0 || p.exposure>100) throw Error('가격·손절·청산·계좌 한도를 확인하세요. 손절은 진입가보다 낮아야 합니다.');
  const factor=p.losses>=3?.5:1;
  const costPerShare=p.entry*p.cost/100;
  const risk=p.entry-p.stop+costPerShare;
  const budget=Math.max(0,Math.min(p.capital*p.pct/100*factor,p.capital*p.totalrisk/100-p.existingrisk));
  const available=Math.max(0,Math.min(p.capital-p.invested,p.capital*p.exposure/100*factor-p.invested));
  const qty=Math.max(0,Math.floor(Math.min(budget/risk,available/(p.entry+costPerShare))));
  const rr=(p.target1-p.entry-costPerShare)/risk;
  return {factor,risk,budget,available,qty,rr,expectedLoss:qty*risk,meetsRR:rr>=p.minrr};
}
function relativeStrength(stock, benchmark) {
  if (!stock?.history || !benchmark?.history || stock.date!==benchmark.date) return null;
  const prices=new Map(benchmark.history.map(b=>[b.date,b.close]));
  const common=stock.history.filter(b=>prices.has(b.date));
  if(common.length<41)return null;
  const end=common.length-1;
  const excess=(start,finish)=>(common[finish].close/common[start].close-1)*100-(prices.get(common[finish].date)/prices.get(common[start].date)-1)*100;
  const current=excess(end-20,end), previous=excess(end-40,end-20);
  return {current,previous,improving:current>previous};
}
if(typeof module!=='undefined') module.exports={sizePosition,relativeStrength};
