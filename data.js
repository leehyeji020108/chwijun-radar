/* 취준 Radar — seed data (v3)
 * SEED_EVENTS: 예시 지원 데이터는 포함하지 않는다. 기존 저장 데이터 호환용 빈 배열.
 * PDB: 퍼스널 기업 DB TOP60 (2026-07 딥리서치 스냅샷)
 */
const SEED_EVENTS = [];

const PDB = [
 {
  "rank": 1,
  "company": "오비맥주(AB InBev)",
  "stage": "1A 지금 핵심",
  "path": "글로벌 주류·브랜드",
  "score": 91.1,
  "absolute": "A+",
  "industry": "S",
  "role": "Commercial · Trade Marketing · Brand Business · 해외사업 · 채널전략",
  "url": "https://www.ob.co.kr/",
  "override": ""
 },
 {
  "rank": 2,
  "company": "상미당홀딩스(SPC그룹)",
  "stage": "1A 지금 핵심",
  "path": "프랜차이즈·멀티브랜드",
  "score": 89,
  "absolute": "A",
  "industry": "S",
  "role": "사업기획·사업관리 · 신규브랜드 도입 · 글로벌사업 · 가맹기획 · 점포개발",
  "url": "https://www.spc.co.kr/",
  "override": ""
 },
 {
  "rank": 3,
  "company": "CJ푸드빌",
  "stage": "1A 지금 핵심",
  "path": "프랜차이즈·멀티브랜드",
  "score": 89,
  "absolute": "A",
  "industry": "A+",
  "role": "사업기획·사업관리 · 신규브랜드 도입 · 글로벌사업 · 가맹기획 · 점포개발",
  "url": "https://www.cjfoodville.co.kr/eng/main.asp",
  "override": ""
 },
 {
  "rank": 4,
  "company": "빅바이트컴퍼니(Shake Shack·Chipotle·Jamba)",
  "stage": "1A 지금 핵심",
  "path": "프랜차이즈·멀티브랜드",
  "score": 88.7,
  "absolute": "C",
  "industry": "A",
  "role": "사업기획·사업관리 · 신규브랜드 도입 · 글로벌사업 · 가맹기획 · 점포개발",
  "url": "https://newsroom.chipotle.com/2025-09-10-CHIPOTLE-TO-EXPAND-TO-ASIA-FOR-THE-FIRST-TIME-THROUGH-A-JOINT-VENTURE-WITH-SPC-GROUP",
  "override": ""
 },
 {
  "rank": 5,
  "company": "신세계L&B",
  "stage": "1A 지금 핵심",
  "path": "글로벌 주류·브랜드",
  "score": 88.2,
  "absolute": "B",
  "industry": "A+",
  "role": "Commercial · Trade Marketing · Brand Business · 해외사업 · 채널전략",
  "url": "https://www.shinsegae-lnb.com/",
  "override": ""
 },
 {
  "rank": 6,
  "company": "롯데GRS",
  "stage": "1A 지금 핵심",
  "path": "프랜차이즈·멀티브랜드",
  "score": 88.1,
  "absolute": "B+",
  "industry": "S",
  "role": "사업기획·사업관리 · 신규브랜드 도입 · 글로벌사업 · 가맹기획 · 점포개발",
  "url": "https://www.lottegrs.com/",
  "override": ""
 },
 {
  "rank": 7,
  "company": "하이트진로",
  "stage": "1B 지금 도전",
  "path": "글로벌 주류·브랜드",
  "score": 88,
  "absolute": "A+",
  "industry": "S",
  "role": "Commercial · Trade Marketing · Brand Business · 해외사업 · 채널전략",
  "url": "https://www.hitejinro.com/",
  "override": ""
 },
 {
  "rank": 8,
  "company": "더본코리아",
  "stage": "1A 지금 핵심",
  "path": "프랜차이즈·멀티브랜드",
  "score": 87.8,
  "absolute": "B+",
  "industry": "A+",
  "role": "사업기획·사업관리 · 신규브랜드 도입 · 글로벌사업 · 가맹기획 · 점포개발",
  "url": "https://www.theborn.co.kr/",
  "override": ""
 },
 {
  "rank": 9,
  "company": "삼양식품",
  "stage": "1A 지금 핵심",
  "path": "제조·유통·브랜드",
  "score": 87.5,
  "absolute": "A",
  "industry": "S",
  "role": "사업관리 · 영업기획 · 해외사업 · 상품·브랜드 사업 · SCM·수요기획",
  "url": "https://www.samyangfoods.com/",
  "override": ""
 },
 {
  "rank": 10,
  "company": "CJ제일제당",
  "stage": "1A 지금 핵심",
  "path": "제조·유통·브랜드",
  "score": 87.2,
  "absolute": "S",
  "industry": "S",
  "role": "사업관리 · 영업기획 · 해외사업 · 상품·브랜드 사업 · SCM·수요기획",
  "url": "https://www.cj.co.kr/kr/about/business/food",
  "override": ""
 },
 {
  "rank": 11,
  "company": "CJ올리브영",
  "stage": "1A 지금 핵심",
  "path": "리테일·식자재·카테고리",
  "score": 87.1,
  "absolute": "S",
  "industry": "S",
  "role": "MD·카테고리 · 상품기획 · 사업관리 · 매입·마진 · PB",
  "url": "https://recruit.cj.net/",
  "override": "현재 보정: 뷰티 산업 관심 낮음 · exceptional 사업/전략 직무만 조건부 검토"
 },
 {
  "rank": 12,
  "company": "롯데칠성음료",
  "stage": "1A 지금 핵심",
  "path": "제조·유통·브랜드",
  "score": 87.1,
  "absolute": "A+",
  "industry": "S",
  "role": "사업관리 · 영업기획 · 해외사업 · 상품·브랜드 사업 · SCM·수요기획",
  "url": "https://company.lottechilsung.co.kr/",
  "override": ""
 },
 {
  "rank": 13,
  "company": "다이닝브랜즈그룹(bhc·아웃백 등)",
  "stage": "1A 지금 핵심",
  "path": "프랜차이즈·멀티브랜드",
  "score": 87.1,
  "absolute": "B+",
  "industry": "A+",
  "role": "사업기획·사업관리 · 신규브랜드 도입 · 글로벌사업 · 가맹기획 · 점포개발",
  "url": "https://www.bhc.co.kr/",
  "override": ""
 },
 {
  "rank": 14,
  "company": "신세계푸드 외식사업",
  "stage": "1A 지금 핵심",
  "path": "프랜차이즈·멀티브랜드",
  "score": 86.8,
  "absolute": "B+",
  "industry": "A",
  "role": "사업기획·사업관리 · 신규브랜드 도입 · 글로벌사업 · 가맹기획 · 점포개발",
  "url": "https://www.shinsegaefood.com/",
  "override": ""
 },
 {
  "rank": 15,
  "company": "BKR(버거킹·팀홀튼)",
  "stage": "1A 지금 핵심",
  "path": "프랜차이즈·멀티브랜드",
  "score": 86.8,
  "absolute": "B",
  "industry": "A+",
  "role": "사업기획·사업관리 · 신규브랜드 도입 · 글로벌사업 · 가맹기획 · 점포개발",
  "url": "https://www.burgerking.co.kr/",
  "override": ""
 },
 {
  "rank": 16,
  "company": "제너시스BBQ",
  "stage": "1A 지금 핵심",
  "path": "프랜차이즈·멀티브랜드",
  "score": 86.7,
  "absolute": "B",
  "industry": "A+",
  "role": "사업기획·사업관리 · 신규브랜드 도입 · 글로벌사업 · 가맹기획 · 점포개발",
  "url": "https://www.genesiskorea.co.kr/",
  "override": ""
 },
 {
  "rank": 17,
  "company": "한솥",
  "stage": "1A 지금 핵심",
  "path": "프랜차이즈·멀티브랜드",
  "score": 86.5,
  "absolute": "C",
  "industry": "A",
  "role": "사업기획·사업관리 · 신규브랜드 도입 · 글로벌사업 · 가맹기획 · 점포개발",
  "url": "https://www.hsd.co.kr/",
  "override": ""
 },
 {
  "rank": 18,
  "company": "FG코리아(파이브가이즈)",
  "stage": "1A 지금 핵심",
  "path": "프랜차이즈·멀티브랜드",
  "score": 86.1,
  "absolute": "C",
  "industry": "B+",
  "role": "사업기획·사업관리 · 신규브랜드 도입 · 글로벌사업 · 가맹기획 · 점포개발",
  "url": "https://www.fiveguys.co.kr/",
  "override": ""
 },
 {
  "rank": 19,
  "company": "본아이에프",
  "stage": "1A 지금 핵심",
  "path": "프랜차이즈·멀티브랜드",
  "score": 85.4,
  "absolute": "B",
  "industry": "A",
  "role": "사업기획·사업관리 · 신규브랜드 도입 · 글로벌사업 · 가맹기획 · 점포개발",
  "url": "https://www.bonif.co.kr/",
  "override": ""
 },
 {
  "rank": 20,
  "company": "삼성웰스토리",
  "stage": "1A 지금 핵심",
  "path": "리테일·식자재·카테고리",
  "score": 85.2,
  "absolute": "A+",
  "industry": "S",
  "role": "MD·카테고리 · 상품기획 · 사업관리 · 매입·마진 · PB",
  "url": "https://www.samsungwelstory.com/eng/main.do",
  "override": ""
 },
 {
  "rank": 21,
  "company": "롯데웰푸드",
  "stage": "1A 지금 핵심",
  "path": "제조·유통·브랜드",
  "score": 85.2,
  "absolute": "A+",
  "industry": "A+",
  "role": "사업관리 · 영업기획 · 해외사업 · 상품·브랜드 사업 · SCM·수요기획",
  "url": "https://www.lottewellfood.com/",
  "override": ""
 },
 {
  "rank": 22,
  "company": "IICOMBINED(젠틀몬스터·탬버린즈·누데이크)",
  "stage": "1B 지금 도전",
  "path": "글로벌 소비재 브랜드",
  "score": 84.7,
  "absolute": "B+",
  "industry": "S",
  "role": "글로벌사업 · 브랜드 사업관리 · 해외영업 · SCM · D2C·이커머스",
  "url": "https://www.gentlemonster.com/",
  "override": ""
 },
 {
  "rank": 23,
  "company": "페르노리카코리아",
  "stage": "1B 지금 도전",
  "path": "글로벌 주류·브랜드",
  "score": 83.9,
  "absolute": "B+",
  "industry": "B",
  "role": "Commercial · Trade Marketing · Brand Business · 해외사업 · 채널전략",
  "url": "https://www.pernod-ricard.com/en/pernod-ricard-list-affiliates",
  "override": ""
 },
 {
  "rank": 24,
  "company": "현대그린푸드",
  "stage": "1A 지금 핵심",
  "path": "리테일·식자재·카테고리",
  "score": 83.7,
  "absolute": "A",
  "industry": "A+",
  "role": "MD·카테고리 · 상품기획 · 사업관리 · 매입·마진 · PB",
  "url": "https://hyundaigreenfood.com/en/INDEX.hgc",
  "override": ""
 },
 {
  "rank": 25,
  "company": "CJ프레시웨이",
  "stage": "1A 지금 핵심",
  "path": "리테일·식자재·카테고리",
  "score": 83.6,
  "absolute": "A",
  "industry": "S",
  "role": "MD·카테고리 · 상품기획 · 사업관리 · 매입·마진 · PB",
  "url": "https://www.cjfreshway.com/",
  "override": ""
 },
 {
  "rank": 26,
  "company": "롯데호텔앤리조트",
  "stage": "1B 지금 도전",
  "path": "여행·호스피탈리티",
  "score": 83.5,
  "absolute": "A",
  "industry": "S",
  "role": "사업개발 · 제휴 · Revenue·Commercial · F&B 사업 · 글로벌운영",
  "url": "https://www.lottehotel.com/global/en/aboutlottehotel/careers.html",
  "override": ""
 },
 {
  "rank": 27,
  "company": "디아지오코리아",
  "stage": "1B 지금 도전",
  "path": "글로벌 주류·브랜드",
  "score": 83.5,
  "absolute": "B+",
  "industry": "B",
  "role": "Commercial · Trade Marketing · Brand Business · 해외사업 · 채널전략",
  "url": "https://www.diageo.com/en/our-business/where-we-operate/asia-pacific/diageo-korea",
  "override": ""
 },
 {
  "rank": 28,
  "company": "호텔신라",
  "stage": "1B 지금 도전",
  "path": "여행·호스피탈리티",
  "score": 83.4,
  "absolute": "A+",
  "industry": "S",
  "role": "사업개발 · 제휴 · Revenue·Commercial · F&B 사업 · 글로벌운영",
  "url": "https://www.hotelshilla.net/",
  "override": ""
 },
 {
  "rank": 29,
  "company": "SCK컴퍼니(스타벅스코리아)",
  "stage": "1B 지금 도전",
  "path": "프랜차이즈·멀티브랜드",
  "score": 83.3,
  "absolute": "B+",
  "industry": "B",
  "role": "사업기획·사업관리 · 신규브랜드 도입 · 글로벌사업 · 가맹기획 · 점포개발",
  "url": "https://www.starbucks.co.kr/",
  "override": "현재 보정: F&B 특별 우선추적에서 제외"
 },
 {
  "rank": 30,
  "company": "롯데백화점",
  "stage": "1A 지금 핵심",
  "path": "리테일·식자재·카테고리",
  "score": 83,
  "absolute": "A+",
  "industry": "S",
  "role": "MD·카테고리 · 상품기획 · 사업관리 · 매입·마진 · PB",
  "url": "https://www.lotteshopping.com/",
  "override": "현재 보정: BEN · 추천/상위 레이더 제외"
 },
 {
  "rank": 31,
  "company": "마이리얼트립",
  "stage": "1B 지금 도전",
  "path": "여행·호스피탈리티",
  "score": 82.9,
  "absolute": "B",
  "industry": "A+",
  "role": "사업개발 · 제휴 · Revenue·Commercial · F&B 사업 · 글로벌운영",
  "url": "https://www.myrealtrip.com/career",
  "override": ""
 },
 {
  "rank": 32,
  "company": "모엣헤네시코리아",
  "stage": "1B 지금 도전",
  "path": "글로벌 주류·브랜드",
  "score": 82.6,
  "absolute": "B+",
  "industry": "B",
  "role": "Commercial · Trade Marketing · Brand Business · 해외사업 · 채널전략",
  "url": "https://www.lvmh.com/en/our-maisons/wines-spirits",
  "override": ""
 },
 {
  "rank": 33,
  "company": "무신사",
  "stage": "1A 지금 핵심",
  "path": "플랫폼·커머스",
  "score": 82.2,
  "absolute": "A+",
  "industry": "S",
  "role": "Category · MD · Seller Growth · Business Operations · Marketplace BD",
  "url": "https://career.musinsa.com/",
  "override": ""
 },
 {
  "rank": 34,
  "company": "이마트",
  "stage": "1A 지금 핵심",
  "path": "리테일·식자재·카테고리",
  "score": 82.1,
  "absolute": "A+",
  "industry": "S",
  "role": "MD·카테고리 · 상품기획 · 사업관리 · 매입·마진 · PB",
  "url": "https://company.emart.com/",
  "override": ""
 },
 {
  "rank": 35,
  "company": "앤하우스(메가MGC커피)",
  "stage": "확장 타깃",
  "path": "프랜차이즈·멀티브랜드",
  "score": 82.1,
  "absolute": "B",
  "industry": "S",
  "role": "사업기획·사업관리 · 신규브랜드 도입 · 글로벌사업 · 가맹기획 · 점포개발",
  "url": "https://www.mega-mgccoffee.com/",
  "override": ""
 },
 {
  "rank": 36,
  "company": "컴포즈커피",
  "stage": "확장 타깃",
  "path": "프랜차이즈·멀티브랜드",
  "score": 81.8,
  "absolute": "B",
  "industry": "S",
  "role": "사업기획·사업관리 · 신규브랜드 도입 · 글로벌사업 · 가맹기획 · 점포개발",
  "url": "https://composecoffee.com/",
  "override": ""
 },
 {
  "rank": 37,
  "company": "쿠팡 리테일",
  "stage": "1A 지금 핵심",
  "path": "플랫폼·커머스",
  "score": 81.5,
  "absolute": "S",
  "industry": "S",
  "role": "Category · MD · Seller Growth · Business Operations · Marketplace BD",
  "url": "https://www.coupang.jobs/en/teams/sales-account-management/",
  "override": ""
 },
 {
  "rank": 38,
  "company": "롯데마트·롯데슈퍼",
  "stage": "1A 지금 핵심",
  "path": "리테일·식자재·카테고리",
  "score": 81.1,
  "absolute": "A",
  "industry": "A+",
  "role": "MD·카테고리 · 상품기획 · 사업관리 · 매입·마진 · PB",
  "url": "https://www.lotte.co.kr/global/en/business/compDetail.do?compCd=L202",
  "override": ""
 },
 {
  "rank": 39,
  "company": "우아한형제들(배달의민족)",
  "stage": "1A 지금 핵심",
  "path": "플랫폼·커머스",
  "score": 80.7,
  "absolute": "A+",
  "industry": "S",
  "role": "Category · MD · Seller Growth · Business Operations · Marketplace BD",
  "url": "https://career.woowahan.com/",
  "override": ""
 },
 {
  "rank": 40,
  "company": "APR",
  "stage": "1B 지금 도전",
  "path": "글로벌 소비재 브랜드",
  "score": 80.5,
  "absolute": "B",
  "industry": "B+",
  "role": "글로벌사업 · 브랜드 사업관리 · 해외영업 · SCM · D2C·이커머스",
  "url": "https://www.apr-in.com/recruit",
  "override": "현재 보정: BEN · 추천/상위 레이더 제외"
 },
 {
  "rank": 41,
  "company": "LG생활건강",
  "stage": "1B 지금 도전",
  "path": "글로벌 소비재 브랜드",
  "score": 80.5,
  "absolute": "B",
  "industry": "B+",
  "role": "글로벌사업 · 브랜드 사업관리 · 해외영업 · SCM · D2C·이커머스",
  "url": "https://www.lgcareers.com/",
  "override": ""
 },
 {
  "rank": 42,
  "company": "구다이글로벌",
  "stage": "1B 지금 도전",
  "path": "글로벌 소비재 브랜드",
  "score": 80.5,
  "absolute": "B",
  "industry": "B+",
  "role": "글로벌사업 · 브랜드 사업관리 · 해외영업 · SCM · D2C·이커머스",
  "url": "https://www.goodai-global.com/ko",
  "override": ""
 },
 {
  "rank": 43,
  "company": "로레알코리아",
  "stage": "1B 지금 도전",
  "path": "글로벌 소비재 브랜드",
  "score": 80.5,
  "absolute": "B",
  "industry": "B+",
  "role": "글로벌사업 · 브랜드 사업관리 · 해외영업 · SCM · D2C·이커머스",
  "url": "https://careers.loreal.com/",
  "override": ""
 },
 {
  "rank": 44,
  "company": "아모레퍼시픽",
  "stage": "1B 지금 도전",
  "path": "글로벌 소비재 브랜드",
  "score": 80.5,
  "absolute": "B",
  "industry": "B+",
  "role": "글로벌사업 · 브랜드 사업관리 · 해외영업 · SCM · D2C·이커머스",
  "url": "https://careers.apgroup.com/",
  "override": ""
 },
 {
  "rank": 45,
  "company": "롯데아사히주류",
  "stage": "확장 타깃",
  "path": "글로벌 주류·브랜드",
  "score": 80.4,
  "absolute": "A",
  "industry": "B",
  "role": "Commercial · Trade Marketing · Brand Business · 해외사업 · 채널전략",
  "url": "https://www.lotteasahi.co.kr/",
  "override": ""
 },
 {
  "rank": 46,
  "company": "롯데칠성 와인사업",
  "stage": "확장 타깃",
  "path": "글로벌 주류·브랜드",
  "score": 80.4,
  "absolute": "A",
  "industry": "B",
  "role": "Commercial · Trade Marketing · Brand Business · 해외사업 · 채널전략",
  "url": "https://company.lottechilsung.co.kr/",
  "override": ""
 },
 {
  "rank": 47,
  "company": "B마트",
  "stage": "1A 지금 핵심",
  "path": "플랫폼·커머스",
  "score": 80,
  "absolute": "A",
  "industry": "S",
  "role": "Category · MD · Seller Growth · Business Operations · Marketplace BD",
  "url": "https://career.woowahan.com/",
  "override": ""
 },
 {
  "rank": 48,
  "company": "농심",
  "stage": "1B 지금 도전",
  "path": "제조·유통·브랜드",
  "score": 80,
  "absolute": "B+",
  "industry": "B",
  "role": "사업관리 · 영업기획 · 해외사업 · 상품·브랜드 사업 · SCM·수요기획",
  "url": "https://www.nongshim.com/",
  "override": ""
 },
 {
  "rank": 49,
  "company": "대상",
  "stage": "1B 지금 도전",
  "path": "제조·유통·브랜드",
  "score": 80,
  "absolute": "B+",
  "industry": "B",
  "role": "사업관리 · 영업기획 · 해외사업 · 상품·브랜드 사업 · SCM·수요기획",
  "url": "https://www.daesang.com/",
  "override": ""
 },
 {
  "rank": 50,
  "company": "동원F&B",
  "stage": "1B 지금 도전",
  "path": "제조·유통·브랜드",
  "score": 80,
  "absolute": "B+",
  "industry": "B",
  "role": "사업관리 · 영업기획 · 해외사업 · 상품·브랜드 사업 · SCM·수요기획",
  "url": "https://www.dongwonfnb.com/",
  "override": ""
 },
 {
  "rank": 51,
  "company": "매일유업",
  "stage": "1B 지금 도전",
  "path": "제조·유통·브랜드",
  "score": 80,
  "absolute": "B+",
  "industry": "B",
  "role": "사업관리 · 영업기획 · 해외사업 · 상품·브랜드 사업 · SCM·수요기획",
  "url": "https://www.maeil.com/",
  "override": ""
 },
 {
  "rank": 52,
  "company": "오뚜기",
  "stage": "1B 지금 도전",
  "path": "제조·유통·브랜드",
  "score": 80,
  "absolute": "B+",
  "industry": "B",
  "role": "사업관리 · 영업기획 · 해외사업 · 상품·브랜드 사업 · SCM·수요기획",
  "url": "https://www.ottogi.co.kr/",
  "override": ""
 },
 {
  "rank": 53,
  "company": "오리온",
  "stage": "1B 지금 도전",
  "path": "제조·유통·브랜드",
  "score": 80,
  "absolute": "B+",
  "industry": "B",
  "role": "사업관리 · 영업기획 · 해외사업 · 상품·브랜드 사업 · SCM·수요기획",
  "url": "https://www.orionworld.com/",
  "override": ""
 },
 {
  "rank": 54,
  "company": "풀무원",
  "stage": "1B 지금 도전",
  "path": "제조·유통·브랜드",
  "score": 80,
  "absolute": "B+",
  "industry": "B",
  "role": "사업관리 · 영업기획 · 해외사업 · 상품·브랜드 사업 · SCM·수요기획",
  "url": "https://www.pulmuone.co.kr/",
  "override": ""
 },
 {
  "rank": 55,
  "company": "롯데면세점",
  "stage": "1B 지금 도전",
  "path": "리테일·식자재·카테고리",
  "score": 79.8,
  "absolute": "A",
  "industry": "S",
  "role": "MD·카테고리 · 상품기획 · 사업관리 · 매입·마진 · PB",
  "url": "https://www.lottedfs.com/",
  "override": ""
 },
 {
  "rank": 56,
  "company": "블루보틀커피코리아",
  "stage": "확장 타깃",
  "path": "프랜차이즈·멀티브랜드",
  "score": 79.8,
  "absolute": "C",
  "industry": "A",
  "role": "사업기획·사업관리 · 신규브랜드 도입 · 글로벌사업 · 가맹기획 · 점포개발",
  "url": "https://bluebottlecoffee.com/kr",
  "override": ""
 },
 {
  "rank": 57,
  "company": "신라면세점",
  "stage": "1B 지금 도전",
  "path": "리테일·식자재·카테고리",
  "score": 79.7,
  "absolute": "A+",
  "industry": "S",
  "role": "MD·카테고리 · 상품기획 · 사업관리 · 매입·마진 · PB",
  "url": "https://www.shilladfs.com/",
  "override": ""
 },
 {
  "rank": 58,
  "company": "화요",
  "stage": "확장 타깃",
  "path": "글로벌 주류·브랜드",
  "score": 79.7,
  "absolute": "C",
  "industry": "A",
  "role": "Commercial · Trade Marketing · Brand Business · 해외사업 · 채널전략",
  "url": "https://www.hwayo.com/",
  "override": ""
 },
 {
  "rank": 59,
  "company": "골든블루",
  "stage": "확장 타깃",
  "path": "글로벌 주류·브랜드",
  "score": 79.5,
  "absolute": "B",
  "industry": "B",
  "role": "Commercial · Trade Marketing · Brand Business · 해외사업 · 채널전략",
  "url": "https://www.goldenblue.co.kr/",
  "override": ""
 },
 {
  "rank": 60,
  "company": "금복주",
  "stage": "확장 타깃",
  "path": "글로벌 주류·브랜드",
  "score": 79.5,
  "absolute": "B",
  "industry": "B",
  "role": "Commercial · Trade Marketing · Brand Business · 해외사업 · 채널전략",
  "url": "https://www.kumbokju.co.kr/",
  "override": ""
 }
];

/* 현재 취준 보정 규칙 (2026-09 기준)
 * match: 기업명 부분일치 / roleMatch: 추천직무·경로 부분일치(선택)
 * kind: 'BEN'  → 추천/상위 레이더에서 제외
 *       'ROUTE'→ 진입 경로 문제로 제외
 *       'LOW'  → 자동 상위추천 금지(수동 검토만)
 */
const OVERRIDE_RULES = [
  { match: 'APR',            kind: 'BEN',   text: 'BEN · 추천/상위 레이더 제외' },
  { match: '롯데백화점',       kind: 'BEN',   text: 'BEN · 추천/상위 레이더 제외' },
  { match: '롯데캐피탈',       kind: 'BEN',   text: 'BEN · 추천/상위 레이더 제외' },
  { match: 'GS리테일', roleMatch: 'OFC', kind: 'ROUTE', text: '점포/점장 루트 문제로 제외 (OFC 경로)' },
  { match: 'HD현대오일뱅크', roleMatch: '국내영업', kind: 'ROUTE', text: '국내영업 경로 제외' },
  { match: 'POSCO', roleMatch: '철강',  kind: 'ROUTE', text: '철강 마케팅 경로 제외' },
  { match: '포스코', roleMatch: '철강',  kind: 'ROUTE', text: '철강 마케팅 경로 제외' },
  { match: 'CJ올리브영',      kind: 'LOW',   text: '회사/커리어 자산은 우수하나 뷰티 관심 낮음 · 자동 상위추천 금지' },
  { match: 'SCK컴퍼니',       kind: 'LOW',   text: 'F&B 특별 우선추적에서 제외' }
];

/* 커리어 평가축 — 산업 관심도 하나로 순위를 정하지 않기 위해 축을 분리한다.
 * 사용자가 0~5로 직접 채점하며, 점수는 로컬/클라우드에 동기화된다.
 */
const AXES = [
  { key: 'job',    label: '직무 매력도/성장성',   w: 1.2 },
  { key: 'brand',  label: '커리어 브랜드/꼬리표', w: 1.1 },
  { key: 'people', label: '동료·상사·업무 시스템', w: 1.0 },
  { key: 'founder',label: '사업가 역량 축적',     w: 1.2 },
  { key: 'option', label: '커리어 옵션가치',      w: 1.1 },
  { key: 'own',    label: 'Ownership',           w: 1.0 },
  { key: 'pay',    label: '연봉/보상',           w: 0.8 },
  { key: 'fit',    label: '경험 Fit/합격 현실성', w: 1.0 },
  { key: 'ind',    label: '산업 관심도',          w: 0.6 }
];


/* ============================================================
   v4 — 전형 단계(STAGES) / 지원 상태(STATUSES) / 파이프라인
   색(hue)은 "전형 단계"에만 쓴다. 중요도(Tier)는 무채색 명도로만 표현해
   한 화면에서 색이 두 가지 의미를 겸하지 않게 한다.
   ============================================================ */
const STAGES = [
  { key: 'open',      label: '공고 오픈',        short: '오픈',   cls: 'st-open' },
  { key: 'info',      label: '설명회·시험',      short: '설명회', cls: 'st-info' },
  { key: 'apply',     label: '서류 마감',        short: '서류',   cls: 'st-apply' },
  { key: 'result',    label: '서류 발표',        short: '발표',   cls: 'st-result' },
  { key: 'test',      label: '인적성·역량검사',   short: '검사',   cls: 'st-test' },
  { key: 'interview', label: '면접',            short: '면접',   cls: 'st-interview' },
  { key: 'final',     label: '최종 발표',        short: '최종',   cls: 'st-final' },
  { key: 'cert',      label: '자격·어학',        short: '자격',   cls: 'st-cert' },
  { key: 'plan',      label: '할 일',            short: '할 일',   cls: 'st-info' }
];
/* 자격·어학은 '지원 건'이 아니다 — 퍼널/지원관리/레이더에서 빼고 캘린더에만 남긴다 */
const CERT_STAGE = 'cert';
const STAGE_ORDER = STAGES.filter(s => !['cert','plan'].includes(s.key)).map(s => s.key);

/* 지원 건 단위 상태. 하나의 지원 건(회사+직무)에 붙은 모든 일정이 이 상태를 공유한다. */
const STATUSES = ['자격','지원예정','작성중','지원완료','서류합격','검사·면접','최종합격','불합격','검증필요','WATCH'];

/* 오늘의 현황 퍼널 — 각 칸은 지원 건 수 */
const PIPELINE = [
  { key: '준비중',   match: ['지원예정'],          hint: '아직 제출 전' },
  { key: '지원완료', match: ['지원완료'],          hint: '제출하고 서류 결과 대기' },
  { key: '서류합격', match: ['서류합격'],          hint: '서류 통과, 다음 전형 대기' },
  { key: '검사·면접', match: ['검사·면접'],         hint: '인적성/면접 진행 중' },
  { key: '보류',     match: ['보류'],             hint: '지원 여부 판단 전' },
  { key: '종료',     match: ['최종합격','불합격'],  hint: '합격 또는 탈락' }
];

/* 지원 후 이 일수를 넘도록 결과가 없으면 '대기 N일' 표시 */
const STALE_DAYS = 14;

/* 시드가 늘어나면 올린다. 기존 항목은 건드리지 않고 새 항목만 합친다. */
const SEED_VERSION = 2;

/* ============================================================
   외부 레이더(GPT 등) → 앱 가져오기
   - GPT_PROMPT: GPT에 그대로 붙여넣는 지시문. 마지막에 JSON만 뱉게 한다.
   - STAGE_ALIAS: GPT가 한글로 써도 알아듣게 하는 매핑
   ============================================================ */
const STAGE_ALIAS = {
  'open':'open','공고오픈':'open','공고 오픈':'open','오픈':'open','채용예정':'open',
  'info':'info','설명회':'info','채용설명회':'info','시험':'info','설명회·시험':'info','기타':'info',
  'apply':'apply','서류':'apply','서류마감':'apply','서류 마감':'apply','접수마감':'apply','마감':'apply','지원마감':'apply',
  'result':'result','발표':'result','서류발표':'result','서류 발표':'result','서류결과':'result',
  'test':'test','검사':'test','인적성':'test','인적성검사':'test','역량검사':'test','인적성·역량검사':'test','필기':'test',
  'interview':'interview','면접':'interview','1차면접':'interview','2차면접':'interview','실무면접':'interview','임원면접':'interview',
  'final':'final','최종':'final','최종발표':'final','최종 발표':'final','합격발표':'final',
  'cert':'cert','자격':'cert','어학':'cert','자격·어학':'cert'
};
const TIER_ALIAS = { 'S+':'S+','S':'S','A+':'A+','A':'A','B':'A','WATCH':'WATCH','관망':'WATCH','워치':'WATCH' };

const GPT_PROMPT = `너는 내 "취준 레이더"다. 아래 기준으로 채용 공고를 찾아 정리하고, 마지막에 JSON 배열만 출력한다.

[내 프로필]
- 2026 하반기 신입 취준 (1998년생, 건국대 졸업)
- 지원 직무: 사업기획 · 전략기획 · 사업개발 · 영업기획 · 상품기획 · 마케팅전략 · 영업관리
- 경험: 전통주 창업(사업총괄·영업, 2024.06~2026.02), 리커머스 오퍼레이션 인턴, 사업개발·영업지원 인턴, 학부 학생회장

[커리어 평가 원칙]
산업 관심도 하나만으로 순위를 정하지 않는다. 아래 축을 분리해서 판단한다.
직무 매력도/성장성 · 커리어 브랜드 · 좋은 동료와 업무 시스템 · 사업가 역량 축적 ·
커리어 옵션가치 · Ownership · 연봉/보상 · 내 경험 Fit과 합격 현실성 · 산업 관심도

[제외 규칙 — 반드시 지킬 것]
- 아예 제외: APR, 롯데백화점, 롯데캐피탈
- 경로 때문에 제외: GS리테일 OFC(점포/점장 루트), HD현대오일뱅크 국내영업, POSCO 철강 마케팅
- 자동 상위추천 금지: CJ올리브영 (회사는 좋지만 뷰티 관심이 낮음, 예외적으로 좋은 사업/전략 직무만)
- 자동차·모빌리티 산업 자체 관심도는 낮다. 다만 직무·브랜드·옵션가치가 좋으면 지원한다(현대차·기아·LG전자 VS).

[Tier 기준]
S+ 최우선 지원 / S 핵심 / A+ 적극 검토 / A 검토 / WATCH 관망

[출력 규칙 — 매우 중요]
- 설명, 인사말, 코드블록 없이 JSON 배열 하나만 출력한다.
- 나는 이걸 그대로 앱에 붙여넣어 "검토함"에서 하나씩 보고 넣을지 뺄지 판단한다.
  그러니 판단에 필요한 정보(주요업무·자격요건·전형일정)를 반드시 채워라.
- 날짜는 공고에 명시된 것만 넣는다. 추측한 날짜는 절대 넣지 마라. 모르면 schedule에서 뺀다.
- 이미 지난 마감은 넣지 마라.
- url은 실제 채용 페이지 주소. 모르면 "" 로 둔다.

[스키마]
[
  {
    "company": "회사명",
    "role": "직무명",
    "tier": "S+ | S | A+ | A | WATCH",
    "jd": "주요 업무. 항목은 · 로 구분해서 2~4개",
    "require": "지원 자격 / 우대사항 한두 줄",
    "english": "어학·자격 요건 (없으면 \"\")",
    "note": "왜 나한테 유효한지 평가축 근거 한 줄",
    "url": "채용 페이지 주소",
    "schedule": [
      { "stage": "apply", "date": "2026-09-29", "time": "11:00" },
      { "stage": "test",  "date": "2026-10-10", "time": "" }
    ]
  }
]

stage 값: open=공고오픈, info=설명회·시험, apply=서류마감, result=서류발표, test=인적성·역량검사, interview=면접, final=최종발표

오늘 기준으로 새로 뜬 공고와 마감이 임박한 공고를 위 형식으로만 출력해줘.`;

/* ============================================================
   v5 — 전형 결과(result) 기반 자동 상태
   사람이 손으로 넣는 건 "각 전형의 결과" 하나뿐이고,
   지원 건의 상태와 진행률은 그 결과에서 자동으로 계산된다.
   ============================================================ */
const RESULTS = {
  ''         : { label: '아직',      chip: '' },
  'submitted': { label: '제출 완료',  chip: '제출' },   // 서류 단계 전용
  'pass'     : { label: '통과',      chip: '✓' },
  'fail'     : { label: '탈락',      chip: '✕' },
  'done'     : { label: '참석/완료',  chip: '✓' }       // 설명회·시험처럼 합불이 없는 것
};

/** 단계별로 고를 수 있는 결과 */
function resultOptions(stage) {
  if (stage === 'apply') return ['', 'submitted', 'pass', 'fail'];
  if (stage === 'result') return ['', 'pass', 'fail'];   // 서류발표는 합·불을 직접 입력한다
  if (['info', 'open', 'cert', 'plan'].includes(stage)) return ['', 'done'];
  return ['', 'pass', 'fail'];                          // test / interview / final
}

/** 파생 상태별 진행률 — 회사가 달라도 같은 잣대로 비교된다 */
const STATUS_PROGRESS = {
  '지원예정': 0, '지원완료': 30, '서류합격': 55, '검사·면접': 80,
  '최종합격': 100, '불합격': 0, '보류': 0
};

/* ============================================================
   v7 — 퍼스널 온보딩
   앱은 빈 상태로 시작하고, 설문으로 그 사람만의 기준을 만든다.
   결과는 state.profile 에 저장되고 GPT 프롬프트까지 자동 생성된다.
   ============================================================ */

/** 지원 직무 후보 (복수 선택 + 직접 입력) */
const JOB_OPTIONS = [
  '사업기획','전략기획','사업개발','영업기획','영업관리','상품기획',
  'MD·구매','마케팅','브랜드마케팅','퍼포먼스마케팅','서비스기획','PM·PO',
  'HR','재무·회계','데이터분석','SCM·물류','해외영업','컨설팅',
  'R&D·연구개발','SW개발','HW·회로설계','생산·공정기술','품질','디자인','법무'
];

/** 커리어 가치축 — 중요한 순서대로 고르면 가중치가 자동 계산된다 */
const VALUE_AXES = [
  { key:'job',    label:'직무 매력도·성장성', desc:'그 일 자체가 재미있고 늘어나는가' },
  { key:'brand',  label:'커리어 브랜드',      desc:'이력서에 남는 회사 이름값' },
  { key:'people', label:'동료·상사·업무 시스템', desc:'배울 사람과 제대로 된 프로세스' },
  { key:'founder',label:'사업가 역량 축적',   desc:'나중에 내 사업에 쓸 근육' },
  { key:'option', label:'커리어 옵션가치',    desc:'다음 이직·진학의 문이 넓어지는가' },
  { key:'own',    label:'Ownership',         desc:'내가 주도해서 굴릴 수 있는 범위' },
  { key:'pay',    label:'연봉·보상',          desc:'당장 받는 돈' },
  { key:'fit',    label:'경험 Fit·합격 현실성', desc:'내 경험으로 붙을 수 있는가' },
  { key:'ind',    label:'산업 관심도',        desc:'그 업계 자체에 끌리는가' }
];

/** 기업 조건 — 0~5 점수. 회사를 볼 때 무엇을 얼마나 따지는가 */
const COMPANY_CRITERIA = [
  { key:'fame',      label:'기업 인지도',   desc:'주변에서 아는 회사인가' },
  { key:'salary',    label:'연봉 수준',     desc:'업계 평균 대비' },
  { key:'welfare',   label:'복지·근무환경', desc:'휴가·근무지·유연근무' },
  { key:'growth',    label:'회사 성장성',   desc:'매출·사업이 커지는 중인가' },
  { key:'stability', label:'안정성',        desc:'망하지 않고 오래 갈 회사' },
  { key:'wlb',       label:'워라밸',        desc:'퇴근 시간과 업무 강도' },
  { key:'global',    label:'글로벌 기회',   desc:'해외 근무·해외 사업 경험' },
  { key:'culture',   label:'조직문화',      desc:'수평적인지, 보수적인지' }
];

/** 서술형 */
const OPEN_QUESTIONS = [
  { key:'strength', label:'내가 내세울 경험과 강점',
    ph:'예: 전통주 브랜드를 직접 만들어 유통까지 해봤고, 리커머스 회사에서 공정을 개선해 처리량을 2배로 늘렸습니다.' },
  { key:'want',     label:'어떤 커리어로 가고 싶은지',
    ph:'예: F&B 브랜드 사업기획 → 프랜차이즈 → 제조·유통까지 넓히고 싶습니다.' },
  { key:'avoid',    label:'피하고 싶은 것 (직무·산업·근무형태)',
    ph:'예: 점포 근무가 긴 영업관리, 지방 순환 근무, 뷰티 산업.' }
];

/** 순위 → 가중치. 1위 1.5배부터 꼴찌 0.5배까지 선형 배분 */
function weightsFromOrder(order) {
  const n = order.length || 1;
  const w = {};
  order.forEach((k, i) => { w[k] = Math.round((1.5 - (i / Math.max(1, n - 1)) * 1.0) * 100) / 100; });
  VALUE_AXES.forEach(a => { if (!(a.key in w)) w[a.key] = 0.5; });
  return w;
}

/** 설문 결과 → GPT 레이더 프롬프트 */
function buildPrompt(pf) {
  const order = (pf.axisOrder || []).map(k => (VALUE_AXES.find(a => a.key === k) || {}).label).filter(Boolean);
  const crit = COMPANY_CRITERIA
    .map(c => ({ ...c, v: (pf.criteria || {})[c.key] ?? 0 }))
    .sort((a, b) => b.v - a.v)
    .filter(c => c.v > 0)
    .map(c => `${c.label} ${c.v}/5`);
  const exC = (pf.excludeCompanies || []).filter(Boolean);
  const exR = (pf.excludeRoles || []).filter(Boolean);

  return `너는 내 "취준 레이더"다. 아래 기준으로 채용 공고를 찾아 정리하고, 마지막에 JSON 배열만 출력한다.

[내 프로필]
${pf.name ? `- 이름: ${pf.name}` : ''}
${pf.grad ? `- 졸업(예정): ${pf.grad}` : ''}${pf.major ? ` · 전공: ${pf.major}` : ''}
- 지원 직무: ${(pf.jobs || []).join(' · ') || '(미지정)'}
${pf.strength ? `- 내 경험·강점: ${pf.strength}` : ''}
${pf.want ? `- 가고 싶은 커리어: ${pf.want}` : ''}
${pf.avoid ? `- 피하고 싶은 것: ${pf.avoid}` : ''}

[커리어 가치축 — 중요한 순서]
${order.map((l, i) => `${i + 1}. ${l}`).join('\\n') || '(미지정)'}
이 순서가 곧 가중치다. 아래 순위 하나만으로 판단하지 말고 축을 분리해서 보되,
위쪽 축을 더 무겁게 반영해라.

[기업 조건 — 내가 따지는 정도]
${crit.join(' · ') || '(미지정)'}

[제외 규칙 — 예외 없이 지킬 것]
${exC.length ? `- 아예 제외할 회사: ${exC.join(', ')}` : '- 제외 회사 없음'}
${exR.length ? `- 아예 제외할 직무·근무형태: ${exR.join(', ')}` : '- 제외 직무 없음'}

[탐색 범위 — 한두 회사만 보고 멈추지 말 것]
1. 지원 직무 각각의 정확한 명칭뿐 아니라 인접 명칭까지 검색한다.
2. 대기업·중견기업·성장기업을 합쳐 최소 30개 서로 다른 기업의 현재 채용 페이지를 확인한다.
3. 공식 채용 페이지를 우선하고, 채용 플랫폼 검색으로 누락을 한 번 더 확인한다.
4. 조건에 맞는 진행 중 공고는 임의로 1~2개만 추리지 말고 모두 items 에 넣는다.
5. 유효한 공고가 8건보다 적어도 숫자를 채우려고 만들지 말고, 확인된 공고만 출력한다.
6. 같은 회사라도 서로 다른 지원 직무의 공고라면 각각 검토한다.

[반드시 확인할 것 — 추천 전에 스스로 검증]
1. 지원 자격에 내 전공/졸업연도가 포함되는지 (지정 전공이면 대상인지 확인)
2. 어학·자격 요건을 마감일까지 충족 가능한지
3. 마감일이 공고에 명시돼 있는지. 추측한 날짜는 절대 넣지 마라
4. 이미 지난 마감은 넣지 마라
5. **공식 채용 페이지를 직접 열어 확인하고 그 URL을 url 에 넣어라.**
   확인 못 했으면 url 을 "" 로 두고 note 앞에 "[미검증]" 을 붙여라

[출력 규칙]
설명·인사말·코드블록 없이 JSON 배열 하나만 출력한다.

[스키마]
[
  {
    "company": "회사명",
    "role": "직무명",
    "tier": "S+ | S | A+ | A | WATCH",
    "jd": "주요 업무. 항목은 · 로 구분해서 2~4개",
    "require": "지원 자격 / 우대사항 한두 줄",
    "english": "어학·자격 요건 (없으면 \\"\\")",
    "note": "왜 나한테 유효한지 위 가치축 기준으로 한 줄",
    "url": "공식 채용 페이지 주소",
    "schedule": [
      { "stage": "apply", "date": "YYYY-MM-DD", "time": "HH:MM" }
    ]
  }
]

stage 값: open=공고오픈, info=설명회·시험, apply=서류마감, result=서류발표, test=인적성·역량검사, interview=면접, final=최종발표
tier 기준: S+ 최우선 / S 핵심 / A+ 적극 검토 / A 검토 / WATCH 관망

오늘 기준으로 새로 뜬 공고와 마감이 임박한 공고를 위 형식으로만 출력해줘.`
  .replace(/\\n{3,}/g, '\\n\\n').replace(/^\\s*\\n/gm, '');
}

/* 기존 사용자(v6까지 쓰던 사람)의 하드코딩 기준 — 온보딩 기본값으로만 쓰인다 */
const LEGACY_EXCLUDE_COMPANIES = ['APR','롯데백화점','롯데캐피탈'];
const LEGACY_EXCLUDE_ROLES     = ['OFC','국내영업','철강'];
