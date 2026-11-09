// Rubi Workshop 고객 포털 (portal.rubiworkshop.com)
// 고객 링크: https://portal.rubiworkshop.com/#키  (키는 my.rubiworkshop.com 견적 앱의 '고객 포털에 공개'에서 만들어짐)
// # 뒤는 서버로 가지 않으므로 GitHub·Cloudflare 접속 기록에 키가 남지 않음. 키로 Apps Script 의 portal 동작을 불러 정제 사본만 받음
// 받는 내용은 Code.gs portalClean_ 가 허용한 칸뿐: 줄별 가격·할인율·내부 메모·이카운트 코드는 처음부터 없음
(() => {
'use strict';

const CFG = window.PORTAL_CONFIG || {};
const SHOP = CFG.SHOP || {};
const app = document.getElementById('app');
const nav = document.getElementById('nav');
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
    <p class="conf">이 화면은 루비워크샵과 고객님 사이의 기밀 정보를 담고 있습니다. 링크를 다른 분께 전달하지 말아 주세요.</p>
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
      <tbody>${pays.map(p => `<tr><td>${esc(p.label)}</td><td class="d">${esc(fmtKo(p.date))}</td><td class="m">${esc(p.method)}</td><td class="n">${comma(p.amount)}</td></tr>`).join('')}</tbody>
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
    <div class="kit-grid">${groups.map(g => `<div class="grp"><h3>${esc(g.cat)}</h3><ul>${g.items.map(k => `<li><span class="sl">${esc(k.slot || '')}</span><span class="nm">${esc(k.name)}${k.qty > 1 ? ` <small>× ${esc(k.qty)}</small>` : ''}</span>${k.gift ? '<span class="gf">증정</span>' : ''}</li>`).join('')}</ul></div>`).join('')}</div>
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

function render(j) {
  const q = j.quote;
  const stage = STAGES.includes(j.stage) ? j.stage : guessStage(q);
  const stages = j.stages || {};
  const title = [q.brand, q.model, q.color].filter(Boolean);
  document.title = `${title.join(' ') || 'Purchase Journey'} · Rubi Workshop`;
  const sections = [['journey', '진행'], ['pay', '결제'], ['quote', '견적'], ['kit', '구성'], ['spec', '사양']];
  const body = `
  <section class="hero">
    <p class="lb">${esc(q.name ? q.name + ' 님의 빌드' : 'Your Build')}</p>
    <h1>${title.length ? title.map(esc).join('<br>') : esc(q.title || '자전거')}</h1>
    <p class="meta">${[q.owner ? '담당 ' + esc(q.owner) : '', j.publishedAt ? esc(fmtDot(j.publishedAt)) + ' 업데이트' : ''].filter(Boolean).join('<i>·</i>')}</p>
  </section>
  ${journeyHtml(q, stage, stages)}
  ${payHtml(q, j.bank)}
  ${quoteHtml(q)}
  ${kitHtml(q)}
  ${specHtml(q)}
  ${q.memo ? `<section class="sec memo" aria-labelledby="h-memo"><h2 id="h-memo" class="sh"><span>안내</span></h2><p>${esc(q.memo)}</p></section>` : ''}
  <section class="sec ask"><p>구성이나 일정이 궁금하시면 ${q.owner ? esc(q.owner) + ' 담당에게 ' : ''}편하게 연락 주세요.</p>${SHOP.TEL ? `<a class="btn" href="tel:${esc(SHOP.TEL.replace(/[^\d]/g, ''))}">${esc(SHOP.TEL)} 전화하기</a>` : ''}</section>`;
  app.innerHTML = body;
  nav.innerHTML = sections.filter(([id]) => document.getElementById(id)).map(([id, l]) => `<a href="#" data-to="${id}">${l}</a>`).join('');
}

// 위 메뉴: 주소의 # 은 키라서 바꾸지 않고 스크롤만
nav.addEventListener('click', e => {
  const a = e.target.closest('[data-to]'); if (!a) return;
  e.preventDefault();
  const el = document.getElementById(a.dataset.to); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

async function load() {
  footer();
  const key = decodeURIComponent(location.hash.replace(/^#/, '')).replace(/[^0-9a-f]/gi, '');
  if (key.length < 32) { showMessage('링크를 확인해 주세요', `루비워크샵에서 보내 드린 링크 전체로 열어 주세요. 링크가 없으시면 ${esc(SHOP.TEL || '루비워크샵')}으로 연락 주세요.`); return; }
  if (!CFG.API_URL) { showMessage('준비 중입니다', '잠시 후 다시 열어 주세요.'); return; }
  try {
    const r = await fetch(`${CFG.API_URL}?action=portal&k=${encodeURIComponent(key)}`, { cache: 'no-store', referrerPolicy: 'no-referrer' });
    const j = await r.json();
    if (!j.ok || !j.quote) { showMessage('열 수 없는 링크입니다', `링크가 바뀌었거나 공개가 끝났습니다. ${esc(SHOP.TEL || '루비워크샵')}으로 연락 주시면 새 링크를 보내 드립니다.`); return; }
    render(j);
  } catch (e) {
    showMessage('잠시 연결이 원활하지 않습니다', '잠시 후 새로 고침해 주세요.');
  }
}

window.addEventListener('hashchange', load);
load();
// 확인용
window.__portal = { render };
})();
