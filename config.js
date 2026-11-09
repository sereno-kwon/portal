// Rubi Workshop 고객 포털 설정
// API_URL: my.rubiworkshop.com 과 같은 Apps Script 웹앱 주소 (sereno-kwon/my-rubi 의 config.js API_URL)
//          포털은 그중 portal 동작만 씀. 키(고객 링크의 # 뒤)가 맞는 정제 사본만 돌려받음
window.PORTAL_CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbypQe4DIULfFv2JllxmXAgMFthIm-PRCSEwkM9kSQGCfOxJ7yn4Qp0TxwwJO3lppvYG/exec',
  SHOP: {
    NAME: '루비워크샵',
    NAME_EN: 'Rubi Workshop',
    ADDRESS: '서울시 서초구 신반포로 320 루비빌딩',
    TEL: '1551-5320',
    HOURS: '월~금 12:00~19:00 · 토 10:00~15:30',
    WEB: 'https://rubiworkshop.com',
    INSTAGRAM: 'https://instagram.com/rubi.workshop',
  },
  CARE_YEARS: 1,   // 루비케어 무상 보증 기간 (견적 앱에서 보증 종료일을 넘기지 않았을 때만 씀)
};
