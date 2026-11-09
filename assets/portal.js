// Rubi Workshop 고객 포털 (portal.rubiworkshop.com)
// 로그인: 루비워크샵이 고객마다 발급한 고객코드(RUBI-가입연도-임의 8자, 예: RUBI-2026-7K3M9QXP). 맞으면 세션(고객 키)을 이 기기에 저장
//   (로그인 유지를 끄면 창을 닫을 때까지만). 코드를 다시 발급하면 세션이 끊겨 로그인 화면으로 돌아옴
//   첫 화면: 그 고객의 '내 자전거' 목록 (my.rubiworkshop.com 첫 화면처럼 번호 목록 + 오른쪽 요약). 줄을 누르면 #b/견적키 로 상세
//   직원 미리보기·예전 링크: #고객키, #고객키/견적키, #견적키 는 로그인 없이 그 키로 엶 (저장하지 않음)
// # 뒤는 서버로 가지 않으므로 GitHub·Cloudflare 접속 기록에 키가 남지 않음. 키로 Apps Script 의 portal 동작을 불러 정제 사본만 받음
// 받는 내용은 Code.gs portalClean_ 가 허용한 칸뿐: 줄별 가격·할인율·원가·재고상태·증빙 번호·내부 메모·이카운트 코드는 처음부터 없음
// 2026-11-09 판: 구성품의 '고객 지참' 표시, 떼어낸 부품(탈거품)과 처리, 업그레이드 견적 표시
(() => {
'use strict';

const CFG = window.PORTAL_CONFIG || {};
const SHOP = CFG.SHOP || {};
const app = document.getElementById('app');
const nav = document.getElementById('nav');
const outBtn = document.getElementById('out');
// 세션 (고객 키). 로그인 유지면 localStorage, 아니면 sessionStorage
const SKEY = 'rubiPortal.session';
const getSession = () => { try { return localStorage.getItem(SKEY) || sessionStorage.getItem(SKEY) || ''; } catch (e) { return ''; } };
const setSession = (k, keep) => { try { (keep ? localStorage : sessionStorage).setItem(SKEY, k); } catch (e) {} };
const clearSession = () => { try { localStorage.removeItem(SKEY); sessionStorage.removeItem(SKEY); } catch (e) {} };
const foot = document.getElementById('foot');

// 진행 단계 (my.rubiworkshop.com 고객관리와 같은 10단계)와 고객에게 보여줄 설명
const STAGES = ['문의', '상담', '견적', '계약금', '예약금', '발주', '입고', '조립', '출고', '루비케어'];
const STAGE_TEXT = {
  '문의': '문의를 받았습니다. 담당자가 곧 연락드립니다.',
  '상담': '타실 길과 몸에 맞는 구성을 함께 정리하고 있습니다.',
  '견적': '구성과 금액을 담은 견적을 드렸습니다. 궁금한 점은 담당자에게 편하게 물어봐 주세요.',
  '계약금': '계약금이 확인되어 빌드가 확정되었습니다.',
  '예약금': '예약금이 확인되어 브랜드 생산과 발주 일정을 잡고 있습니다.',
  '발주': '브랜드에 프레임과 부품을 주문했습니다. 입고되면 바로 알려드립니다.',
  '입고': '프레임과 부품이 루비워크샵에 도착했습니다.',
  '조립': '미캐닉이 조립과 조립 QC를 진행하고 있습니다.',
  '출고': '자전거를 인도했습니다. 즐거운 라이딩 되세요.',
  '루비케어': '루비케어 무상 보증 기간입니다. 점검이 필요하면 언제든 들러 주세요.',
};

const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const comma = n => Math.round(+n || 0).toLocaleString('ko-KR');
const won = n => comma(n) + '원';
const paren = n => n < 0 ? `(${comma(-n)})` : comma(n);
const fmtKo = s => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[1]}년 ${+m[2]}월 ${+m[3]}일` : ''; };
const fmtDot = s => { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[1]}.${m[2]}.${m[3]}` : ''; };
const fmtShort = s => { const m = String(s || '').match(/^\d{4}-(\d{2})-(\d{2})/); return m ? `${+m[1]}.${+m[2]}` : ''; };
const careEnd = ship => { const m = String(ship || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${+m[1] + (+CFG.CARE_YEARS || 1)}-${m[2]}-${m[3]}` : ''; };

function footer() {
  foot.innerHTML = `<div class="in">
    <p class="wm2">${esc(SHOP.NAME_EN || 'Rubi Workshop')}</p>
    <p>${esc(SHOP.NAME || '')}${SHOP.ADDRESS ? ` · ${esc(SHOP.ADDRESS)}` : ''}</p>
    <p>${SHOP.TEL ? `<a href="tel:${esc(SHOP.TEL.replace(/[^\d]/g, ''))}">${esc(SHOP.TEL)}</a>` : ''}${SHOP.HOURS ? ` · ${esc(SHOP.HOURS)}` : ''}</p>
    <p class="ln">${SHOP.WEB ? `<a href="${esc(SHOP.WEB)}" rel="noopener">rubiworkshop.com</a>` : ''}${SHOP.INSTAGRAM ? `<a href="${esc(SHOP.INSTAGRAM)}" rel="noopener">Instagram</a>` : ''}</p>
    <p class="conf">이 화면은 루비워크샵과 고객님 사이의 기밀 정보를 담고 있습니다. 고객코드와 화면 내용을 다른 분께 전달하지 말아 주세요.</p>
  </div>`;
}

function showMessage(title, body) {
  nav.innerHTML = '';
  app.innerHTML = `<section class="msg"><p class="lb">Purchase Journey</p><h1>${esc(title)}</h1><p>${body}</p></section>`;
}

/** 고객관리와 연결되지 않은 견적이면 결제·출고로 단계를 짐작 */
function guessStage(q) {
  if (q.ship) return '출고';
  if (q.paid > 0 && q.remain <= 0) return '발주';
  if (q.paid > 0) return '계약금';
  return '견적';
}

function journeyHtml(q, stage, stages) {
  const cur = STAGES.indexOf(stage);
  const steps = STAGES.map((s, i) => {
    const st = i < cur ? 'done' : i === cur ? 'now' : 'next';
    const d = stages[s];
    return `<li class="${st}"><span class="dot" aria-hidden="true"></span><span class="nm">${esc(s)}</span><span class="dt">${d ? esc(fmtShort(d)) : ''}</span></li>`;
  }).join('');
  return `<section class="sec journey" id="journey" aria-labelledby="h-journey">
    <h2 id="h-journey" class="sh"><span>진행 단계</span><small>${cur + 1} / ${STAGES.length}</small></h2>
    <ol class="track" style="--p:${Math.max(0, cur) / (STAGES.length - 1)}">${steps}</ol>
    <div class="now-card"><p class="lb">지금 단계${stages[stage] ? ` · ${esc(fmtKo(stages[stage]))}부터` : ''}</p><p class="st">${esc(stage)}</p><p class="tx">${esc(STAGE_TEXT[stage] || '')}</p></div>
  </section>`;
}

function payHtml(q, bank) {
  const pct = q.total > 0 ? Math.min(1, q.paid / q.total) : 0;
  const rq = q.request || {};
  let reqVal = '', reqLab = '';
  if (rq.amount !== '' && rq.amount != null && +rq.amount > 0) { reqVal = won(rq.amount); reqLab = rq.label || '결제 요청 금액'; }
  else if (q.remain > 0) { reqVal = won(q.remain); reqLab = rq.label || (q.paid ? '남은 금액' : '결제 요청 금액'); }
  const pays = (q.payments || []).filter(p => p.label || p.amount);
  return `<section class="sec pay" id="pay" aria-labelledby="h-pay">
    <h2 id="h-pay" class="sh"><span>결제</span><small>${q.remain <= 0 && q.paid > 0 ? '결제 완료' : Math.round(pct * 100) + '% 결제'}</small></h2>
    <div class="pay-grid">
      ${reqVal ? `<div class="req"><p class="lb">${esc(reqLab)}</p><p class="v">${esc(reqVal)}</p>${bank ? `<p class="bank"><span>입금 계좌</span>${esc(bank)}</p>` : ''}</div>`
        : `<div class="req ok"><p class="lb">최종 결제 금액</p><p class="v">${won(q.total)}</p><p class="bank"><span>결제가 모두 확인되었습니다. 감사합니다.</span></p></div>`}
      <div class="prog">
        <div class="bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct * 100)}" aria-label="결제 진행"><i style="width:${(pct * 100).toFixed(1)}%"></i></div>
        <dl class="pn"><div><dt>결제 완료</dt><dd>${won(q.paid)}</dd></div><div><dt>남은 금액</dt><dd>${won(Math.max(0, q.remain))}</dd></div><div><dt>최종 견적 금액</dt><dd>${won(q.total)}</dd></div></dl>
      </div>
    </div>
    ${pays.length ? `<table class="tbl"><thead><tr><th scope="col">결제 내용</th><th scope="col">날짜</th><th scope="col">수단</th><th scope="col" class="n">금액</th></tr></thead>
      <tbody>${pays.map(p => `<tr${p.amount < 0 ? ' class="rf"' : ''}><td>${esc(p.label)}</td><td class="d">${esc(fmtKo(p.date))}</td><td class="m">${esc(p.method)}</td><td class="n">${paren(p.amount)}</td></tr>`).join('')}</tbody>
      <tfoot><tr><th scope="row" colspan="3">총 결제 금액</th><td class="n">${comma(q.paid)}</td></tr></tfoot></table>` : ''}
  </section>`;
}

function quoteHtml(q) {
  const rows = (q.summary || []).filter(x => x[1]);
  const max = Math.max(1, ...rows.map(x => x[1]));
  return `<section class="sec quote" id="quote" aria-labelledby="h-quote">
    <h2 id="h-quote" class="sh"><span>견적</span><small>${q.no ? esc(q.no) : ''}${q.issued ? ` · ${esc(fmtDot(q.issued))}` : ''}</small></h2>
    <ul class="bars">${rows.map(([l, v]) => `<li><span class="nm">${esc(l)}</span><span class="b"><i style="width:${(v / max * 100).toFixed(1)}%"></i></span><span class="n">${comma(v)}</span></li>`).join('')}</ul>
    <dl class="sum">
      <div><dt>소비자가 합계</dt><dd>${won(q.list)}</dd></div>
      ${q.offer ? `<div class="of"><dt>스페셜오퍼</dt><dd>${paren(q.offer)}</dd></div>` : ''}
      <div class="tt"><dt>최종 견적 금액<small>부가세 포함</small></dt><dd>${won(q.total)}</dd></div>
    </dl>
    ${q.valid && !q.paid ? `<p class="note">이 견적은 ${esc(fmtKo(q.valid))}까지 유효합니다. 이후에는 환율과 브랜드 가격에 따라 달라질 수 있습니다.</p>` : ''}
  </section>`;
}

function kitHtml(q) {
  const kit = q.kit || [];
  if (!kit.length) return '';
  const groups = [];
  kit.forEach(k => { let g = groups[groups.length - 1]; if (!g || g.cat !== k.cat) groups.push(g = { cat: k.cat, items: [] }); g.items.push(k); });
  return `<section class="sec kit" id="kit" aria-labelledby="h-kit">
    <h2 id="h-kit" class="sh"><span>빌드 구성</span><small>${kit.length}개 품목</small></h2>
    <div class="kit-grid">${groups.map(g => `<div class="grp"><h3>${esc(g.cat)}</h3><ul>${g.items.map(k => `<li><span class="sl">${esc(k.slot || '')}</span><span class="nm">${esc(k.name)}${k.qty > 1 ? ` <small>× ${esc(k.qty)}</small>` : ''}</span>${k.own ? '<span class="gf ow">고객 지참</span>' : k.gift ? '<span class="gf">증정</span>' : ''}</li>`).join('')}</ul></div>`).join('')}</div>
    ${kit.some(k => k.own) ? '<p class="note">고객 지참 부품은 고객님이 가져오신 부품이라 견적 금액에 들어가지 않습니다.</p>' : ''}
  </section>`;
}

/** 떼어낸 부품: 업그레이드·리빌드로 뗀 부품과 처리 (고객 반환, 매장 보관 등) */
function removedHtml(q) {
  const rm = (q.removed || []).filter(x => x.name);
  if (!rm.length) return '';
  return `<section class="sec kit removed" id="removed" aria-labelledby="h-removed">
    <h2 id="h-removed" class="sh"><span>떼어낸 부품</span><small>${rm.length}개</small></h2>
    <div class="kit-grid"><div class="grp"><ul>${rm.map(x => `<li><span class="nm">${esc(x.name)}</span>${x.to ? `<span class="gf">${esc(x.to)}</span>` : ''}</li>`).join('')}</ul></div></div>
  </section>`;
}

function specHtml(q) {
  const care = q.care || careEnd(q.ship);
  const ids = [['고유 시리얼 (S/N)', q.sn], ['프레임 넘버 (F/N)', q.fn], ['루비 시리얼', q.rubiSn], ['출고일', fmtKo(q.ship)], ['루비케어 무상 보증 종료일', care ? fmtKo(care) : '출고 후 1년']].filter(x => x[1]);
  const spec = (q.spec || []).filter(s => (s.fields || []).length);
  if (!ids.length && !spec.length) return '';
  return `<section class="sec spec" id="spec" aria-labelledby="h-spec">
    <h2 id="h-spec" class="sh"><span>빌드 사양</span><small>조립 QC 기준</small></h2>
    ${ids.length ? `<dl class="ids">${ids.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : ''}
    ${spec.map(s => `<div class="sp"><h3>${esc(s.title)}</h3><dl>${s.fields.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></div>`).join('')}
  </section>`;
}

function renderDetail(j, back) {
  document.body.classList.remove('home'); document.body.dataset.view = 'detail';
  const q = j.quote;
  const stage = STAGES.includes(j.stage) ? j.stage : guessStage(q);
  const stages = j.stages || {};
  const title = [q.brand, q.model, q.color].filter(Boolean);
  document.title = `${title.join(' ') || 'Purchase Journey'} · Rubi Workshop`;
  const sections = [['journey', '진행'], ['pay', '결제'], ['quote', '견적'], ['kit', '구성'], ['removed', '탈거품'], ['spec', '사양']];
  const body = `
  ${back ? `<a class="back" href="${esc(homeHref())}">← 내 자전거${state.items.length > 1 ? ` <small>${state.items.length}</small>` : ''}</a>` : ''}
  <section class="hero">
    <p class="lb">${esc(q.name ? q.name + ' 님의 ' + (q.kind || '빌드') : q.kind || 'Your Build')}</p>
    <h1>${title.length ? title.map(esc).join('<br>') : esc(q.title || '자전거')}</h1>
    <p class="meta">${[q.kind && q.parentNo ? '원래 견적 ' + esc(q.parentNo) : '', q.owner ? '담당 ' + esc(q.owner) : '', j.publishedAt ? esc(fmtDot(j.publishedAt)) + ' 업데이트' : ''].filter(Boolean).join('<i>·</i>')}</p>
  </section>
  ${journeyHtml(q, stage, stages)}
  ${payHtml(q, j.bank)}
  ${quoteHtml(q)}
  ${kitHtml(q)}
  ${removedHtml(q)}
  ${specHtml(q)}
  ${q.memo ? `<section class="sec memo" aria-labelledby="h-memo"><h2 id="h-memo" class="sh"><span>안내</span></h2><p>${esc(q.memo)}</p></section>` : ''}
  <section class="sec ask"><p>구성이나 일정이 궁금하시면 ${q.owner ? esc(q.owner) + ' 담당에게 ' : ''}편하게 연락 주세요.</p>${SHOP.TEL ? `<a class="btn" href="tel:${esc(SHOP.TEL.replace(/[^\d]/g, ''))}">${esc(SHOP.TEL)} 전화하기</a>` : ''}</section>`;
  app.innerHTML = body;
  window.scrollTo(0, 0);
  nav.innerHTML = sections.filter(([id]) => document.getElementById(id)).map(([id, l]) => `<a href="#" data-to="${id}">${l}</a>`).join('');
}

// 위 메뉴: 주소의 # 은 키라서 바꾸지 않고 스크롤만
nav.addEventListener('click', e => {
  const a = e.target.closest('[data-to]'); if (!a) return;
  e.preventDefault();
  const el = document.getElementById(a.dataset.to); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

// ─────────── 첫 화면: 내 자전거 ───────────
// 단계로 세 묶음. 결제가 시작됐거나 계약 단계면 진행 중, 출고·루비케어는 출고, 나머지는 견적
const LIVE = ['계약금', '예약금', '발주', '입고', '조립'];
const stageOf = it => STAGES.includes(it.stage) ? it.stage : guessStage(it.quote);
function groupOf(it) {
  const st = stageOf(it);
  if (st === '출고' || st === '루비케어') return 'done';
  if (LIVE.includes(st) || it.quote.paid > 0) return 'live';
  return 'quote';
}
const GROUPS = [['live', '진행 중'], ['quote', '견적'], ['done', '출고 · 루비케어']];
const bikeTitle = q => [q.brand, q.model, q.color].filter(Boolean).join(' ') || q.title || '자전거';
const state = { ckey: '', mode: '', items: [], name: '', q: '', sel: 0, link: false };
// 로그인으로 들어왔으면 주소에 키를 넣지 않음 (#b/견적키), 링크로 들어왔으면 키 그대로
const homeHref = () => state.link ? '#' + state.ckey : '#';
const itemHref = id => state.link ? `#${state.ckey}/${id}` : `#b/${id}`;

function homeList() {
  const term = state.q.trim().toLowerCase();
  const shown = state.items.filter(it => !term || [bikeTitle(it.quote), it.quote.title, it.quote.no, stageOf(it)].join(' ').toLowerCase().includes(term));
  let n = 0;
  const order = [];
  const secs = GROUPS.map(([g, label]) => {
    const rows = shown.filter(it => groupOf(it) === g);
    if (!rows.length) return '';
    return `<section class="hsec" aria-label="${esc(label)}"><h2><span>${esc(label)}</span><span>${rows.length}</span></h2><ol>${rows.map(it => {
      n++; order.push(it.id);
      const q = it.quote, st = stageOf(it);
      const pct = q.total > 0 ? Math.round(Math.min(1, q.paid / q.total) * 100) : 0;
      const pay = q.paid > 0 && q.remain <= 0 ? '결제 완료' : q.paid > 0 ? `결제 ${pct}%` : '';
      const sub = [q.kind && q.title !== q.kind ? q.kind : '', q.title, q.no, q.ship && !q.kind ? fmtDot(q.ship) + ' 출고' : ''].filter(Boolean).join(' · ');
      return `<li><a class="hrow${n - 1 === state.sel ? ' on' : ''}" href="${esc(itemHref(it.id))}" data-i="${n - 1}">
        <span class="no">${String(n).padStart(2, '0')}</span>
        <span class="tt"><span class="nm">${esc(bikeTitle(q))}</span>${sub ? `<span class="sb">${esc(sub)}</span>` : ''}</span>
        <span class="mt">${esc(st)}${pay ? `<i>·</i>${esc(pay)}` : ''}</span><span class="ar" aria-hidden="true">→</span></a></li>`;
    }).join('')}</ol></section>`;
  }).join('');
  state.order = order;
  return secs || '<p class="hnone">맞는 자전거가 없습니다.</p>';
}

function asideToday() {
  const now = new Date();
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return `<div class="ab"><p class="k">Today</p><p class="clock" id="clock">${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}</p>
      <p class="dt">${now.getMonth() + 1}월 ${now.getDate()}일 ${days[now.getDay()]}요일</p>${SHOP.HOURS ? `<p class="sm">쇼룸 ${esc(SHOP.HOURS)}</p>` : ''}</div>`;
}
function asideContact(owners) {
  return `<div class="ab"><p class="k">Contact</p>${owners && owners.length ? `<p class="arow"><span>담당</span><b class="s">${owners.map(esc).join(', ')}</b></p>` : ''}
      ${SHOP.TEL ? `<a class="arow" href="tel:${esc(SHOP.TEL.replace(/[^\d]/g, ''))}"><span>전화</span><b class="s">${esc(SHOP.TEL)}</b></a>` : ''}
      ${SHOP.ADDRESS ? `<p class="sm">${esc(SHOP.ADDRESS)}</p>` : ''}</div>`;
}
function homeAside() {
  const reqs = state.items.map(it => {
    const q = it.quote, rq = q.request || {};
    const amt = rq.amount !== '' && rq.amount != null && +rq.amount > 0 ? +rq.amount : q.remain > 0 ? q.remain : 0;
    return amt ? { it, amt, label: rq.label || '남은 금액' } : null;
  }).filter(Boolean);
  const bank = (state.items.find(it => it.bank) || {}).bank || '';
  const cares = state.items.filter(it => it.quote.ship).map(it => ({ it, end: it.quote.care || careEnd(it.quote.ship) }));
  const owners = [...new Set(state.items.map(it => it.quote.owner).filter(Boolean))];
  return `${asideToday()}
    <div class="ab"><p class="k">Payment</p>${reqs.length ? reqs.map(r => `<a class="arow" href="${esc(itemHref(r.it.id))}"><span>${esc(r.label)}<small>${esc(bikeTitle(r.it.quote))}</small></span><b>${won(r.amt)}</b></a>`).join('')
      + (bank ? `<p class="sm bank">입금 계좌 ${esc(bank)}</p>` : '') : '<p class="sm">결제하실 금액이 없습니다.</p>'}</div>
    ${cares.length ? `<div class="ab"><p class="k">Rubi Care</p>${cares.map(c => `<a class="arow" href="${esc(itemHref(c.it.id))}"><span>${esc(bikeTitle(c.it.quote))}</span><b class="s">${c.end ? esc(fmtDot(c.end)) + '까지' : ''}</b></a>`).join('')}<p class="sm">무상 보증 기간에는 점검과 조정을 언제든 받으실 수 있습니다.</p></div>` : ''}
    ${asideContact(owners)}`;
}

function renderHome() {
  document.body.classList.add('home'); document.body.dataset.view = 'home';
  document.title = `${state.name ? state.name + ' 님의 자전거' : '내 자전거'} · Rubi Workshop`;
  nav.innerHTML = '';
  const many = state.items.length > 3;
  app.innerHTML = `<div class="hwrap"><div class="hmain">
      <p class="hk">${esc(state.name ? state.name + ' 님' : 'Purchase Journey')}</p>
      ${many ? `<label class="hq"><span aria-hidden="true">/</span><input id="hq" value="${esc(state.q)}" placeholder="자전거 찾기" aria-label="자전거 찾기" autocomplete="off"></label>`
        : `<h1 class="hh">내 자전거<small>${state.items.length}</small></h1>`}
      <p class="keys"><kbd>↑</kbd><kbd>↓</kbd> 고르기 <kbd>Enter</kbd> 열기 <kbd>1</kbd>–<kbd>${Math.min(9, state.items.length)}</kbd> 바로 열기</p>
      <div id="hlist">${homeList()}</div>
    </div><aside class="haside" aria-label="요약">${homeAside()}</aside></div>`;
  window.scrollTo(0, 0);
}
function paintList() { const el = document.getElementById('hlist'); if (el) el.innerHTML = homeList(); }

document.addEventListener('input', e => { if (e.target.id === 'hq') { state.q = e.target.value; state.sel = 0; paintList(); } });
document.addEventListener('keydown', e => {
  const home = document.body.dataset.view === 'home';
  if (!home) {
    if (e.key === 'Escape' && state.mode === 'list' && document.body.dataset.view === 'detail') location.hash = homeHref();
    return;
  }
  const typing = e.target.id === 'hq';
  const order = state.order || [];
  if (e.key === '/' && !typing) { const q = document.getElementById('hq'); if (q) { e.preventDefault(); q.focus(); } return; }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    if (!order.length) return;
    e.preventDefault();
    state.sel = (state.sel + (e.key === 'ArrowDown' ? 1 : -1) + order.length) % order.length; paintList();
    const on = document.querySelector('.hrow.on'); if (on) on.scrollIntoView({ block: 'nearest' });
    return;
  }
  if (e.key === 'Enter' && order[state.sel]) { e.preventDefault(); location.hash = itemHref(order[state.sel]); return; }
  if (e.key === 'Escape' && typing && state.q) { state.q = ''; e.target.value = ''; paintList(); return; }
  if (!typing && /^[1-9]$/.test(e.key) && order[+e.key - 1]) { location.hash = itemHref(order[+e.key - 1]); }
});
setInterval(() => { const c = document.getElementById('clock'); if (c) { const d = new Date(); c.textContent = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; } }, 20000);

// ─────────── 로그인 (고객코드) ───────────
/** 치는 대로 RUBI-2026-7K3M9QXP 꼴로 정리. RUBI 를 빼고 연도부터 쳐도 앞에 붙임 */
function fmtCode(v) {
  v = v.toUpperCase().replace(/[^0-9A-Z]/g, '');
  if (v.length <= 4 && 'RUBI'.indexOf(v) === 0) return v;
  const rest = (v.indexOf('RUBI') === 0 ? v.slice(4) : v).slice(0, 12);
  return 'RUBI' + (rest ? '-' + rest.slice(0, 4) : '') + (rest.length > 4 ? '-' + rest.slice(4) : '');
}
function renderLogin(note) {
  document.body.classList.add('home'); document.body.dataset.view = 'login';
  document.title = '고객코드로 들어가기 · Rubi Workshop';
  nav.innerHTML = ''; outBtn.hidden = true;
  app.innerHTML = `<div class="hwrap"><div class="hmain">
      <p class="hk">Purchase Journey</p>
      <h1 class="hh">내 자전거 보기</h1>
      <form class="login" id="login" autocomplete="off" novalidate>
        <label class="hq"><span aria-hidden="true">/</span><input id="code" inputmode="text" autocapitalize="characters" spellcheck="false" placeholder="RUBI-2026-XXXXXXXX" aria-label="고객코드" maxlength="20" autofocus></label>
        <div class="lrow"><label class="keep"><input type="checkbox" id="keep" checked><span>이 기기에서 로그인 유지</span></label><button class="go" type="submit">들어가기 <span aria-hidden="true">→</span></button></div>
        <p class="lmsg" id="lmsg" role="status">${note ? esc(note) : ''}</p>
      </form>
      <div class="lhelp">
        <p>고객코드는 루비워크샵이 고객님께 따로 보내 드린 코드입니다. 예: RUBI-2026-7K3M9QXP</p>
        <p>대소문자와 하이픈은 상관없습니다. 코드를 잊으셨거나 받지 못하셨다면 ${SHOP.TEL ? `<a href="tel:${esc(SHOP.TEL.replace(/[^\d]/g, ''))}">${esc(SHOP.TEL)}</a>` : '루비워크샵'}으로 연락 주세요.</p>
        <p>공용 기기에서는 로그인 유지를 끄고, 다 보신 뒤 로그아웃해 주세요.</p>
      </div>
    </div><aside class="haside" aria-label="요약">${asideToday()}${asideContact()}</aside></div>`;
  window.scrollTo(0, 0);
  const inp = document.getElementById('code');
  inp.addEventListener('input', () => { const p = inp.selectionStart === inp.value.length; inp.value = fmtCode(inp.value); if (p) inp.setSelectionRange(inp.value.length, inp.value.length); });
  document.getElementById('login').addEventListener('submit', async e => {
    e.preventDefault();
    const code = fmtCode(inp.value).replace(/-/g, '');
    const m = document.getElementById('lmsg');
    if (code.length !== 16) { m.textContent = 'RUBI-연도-8자리 고객코드를 모두 넣어 주세요'; inp.focus(); return; }
    const btn = e.target.querySelector('.go'); btn.disabled = true; m.textContent = '확인하는 중입니다';
    try {
      const j = await api(`c=${encodeURIComponent(code)}`);
      if (j.ok && j.session) {
        setSession(j.session, document.getElementById('keep').checked);
        take(j, j.session, false);
        outBtn.hidden = false;
        if (location.hash) location.hash = ''; else renderHome();
        return;
      }
      m.textContent = j.error === 'busy' ? '잠시 후 다시 시도해 주세요' : `고객코드를 확인해 주세요. 맞는데도 안 되면 ${SHOP.TEL || '루비워크샵'}으로 연락 주세요`;
    } catch (er) { m.textContent = '잠시 연결이 원활하지 않습니다. 다시 눌러 주세요'; }
    btn.disabled = false; inp.focus(); inp.select();
  });
}
outBtn.addEventListener('click', () => {
  clearSession();
  Object.assign(state, { ckey: '', mode: '', items: [], name: '', q: '', sel: 0, link: false });
  if (location.hash) location.hash = ''; else renderLogin('로그아웃했습니다');
});

/** 주소: '' (첫 화면) / #b/견적키 (상세, 로그인) / #고객키 · #고객키/견적키 · #견적키 (직원 미리보기·예전 링크, 로그인 없이) */
function route() {
  const raw = decodeURIComponent(location.hash.replace(/^#/, ''));
  const b = raw.match(/^b\/([0-9a-f]+)$/i);
  if (b) return { k: '', sub: b[1] };
  const [k, sub] = raw.split('/').map(x => (x || '').replace(/[^0-9a-f]/gi, ''));
  return k && k.length >= 32 ? { k, sub: sub || '' } : { k: '', sub: '' };
}

async function api(q) {
  const r = await fetch(`${CFG.API_URL}?action=portal&${q}`, { cache: 'no-store', referrerPolicy: 'no-referrer' });
  return r.json();
}
function take(j, key, link) {
  state.ckey = key; state.mode = j.mode || 'one'; state.sel = 0; state.q = ''; state.link = link;
  state.items = j.mode === 'list' ? j.items : [Object.assign({ id: key }, j)];
  state.name = j.mode === 'list' ? j.name : (j.quote && j.quote.name) || '';
}

async function load() {
  footer();
  if (!CFG.API_URL) { showMessage('준비 중입니다', '잠시 후 다시 열어 주세요.'); return; }
  const r = route();
  const link = !!r.k;
  const key = link ? r.k : getSession();
  outBtn.hidden = link || !key;
  if (!key) { renderLogin(); return; }
  try {
    // 같은 키로 이미 받았으면 다시 받지 않음 (목록 ↔ 상세 오갈 때)
    if (state.ckey !== key || !state.mode) {
      const j = await api(`k=${encodeURIComponent(key)}`);
      if (!j.ok) {
        if (!link) { clearSession(); renderLogin('고객코드가 바뀌었거나 공개된 견적이 없습니다. 다시 로그인해 주세요'); return; }
        document.body.classList.remove('home'); document.body.dataset.view = 'msg';
        showMessage('열 수 없는 링크입니다', `링크가 바뀌었거나 공개가 끝났습니다. ${esc(SHOP.TEL || '루비워크샵')}으로 연락 주시면 고객코드로 들어오실 수 있게 안내해 드립니다.`); return;
      }
      take(j, key, link);
    }
    if (state.mode !== 'list') { renderDetail(state.items[0], ''); return; }
    const it = r.sub && state.items.find(x => x.id === r.sub);
    if (it) renderDetail(it, state.ckey);
    else renderHome();
  } catch (e) {
    document.body.classList.remove('home'); document.body.dataset.view = 'msg';
    showMessage('잠시 연결이 원활하지 않습니다', '잠시 후 새로 고침해 주세요.');
  }
}

window.addEventListener('hashchange', load);
load();
// 확인용
window.__portal = { renderDetail, state };
})();
