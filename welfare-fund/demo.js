/* demo.js — 예시 데이터.
 * 금액과 거래 구조는 실제 결산 사례를 그대로 따르되, 법인 정보와 인명은 모두 가명이다.
 * 「기금 정보 · 이월」 화면의 "예시 데이터 불러오기"로 적재된다. */
(function (g) { g.WFDemo = {
 "year": 2025,
 "info": {
  "name": "○○산업 사내근로복지기금",
  "license": "000-00-0000",
  "regDate": "1992. 10. 29.",
  "tel": "000-000-0000",
  "addr": "○○광역시 ○○구 ○○대로 000",
  "ceo": "홍 길 동",
  "industry": "제조업",
  "workers": 320,
  "partnerWorkers": 60,
  "capitalPaid": 154500,
  "basicAssetPrev": 701963,
  "basicAssetIncOwner": 0,
  "basicAssetIncProfit": 0,
  "basicAssetIncOther": 0,
  "basicAssetIncMerge": 0,
  "basicAssetUse": 0,
  "basicAssetSplit": 0
 },
 "opening": {
  "bank": 15352579,
  "loan": 662950000,
  "reserve": 78302579,
  "capital": 600000000,
  "retained": 0,
  "prepaidTax": 0
 },
 "entries": [
  {
   "id": "d0",
   "m": 1,
   "d": 10,
   "desc": "박준서 외 대출원금 상환",
   "amount": 3670000,
   "kind": "LOAN_PRINCIPAL_IN",
   "org": "우성",
   "persons": [],
   "beneficiaries": 0,
   "grouped": true
  },
  {
   "id": "d1",
   "m": 1,
   "d": 10,
   "desc": "박준서 외 대출이자 상환",
   "amount": 331490,
   "kind": "LOAN_INTEREST_IN",
   "org": "우성",
   "persons": [],
   "beneficiaries": 0,
   "grouped": true
  },
  {
   "id": "d2",
   "m": 1,
   "d": 10,
   "desc": "오미르 외 대출원금 상환",
   "amount": 15590000,
   "kind": "LOAN_PRINCIPAL_IN",
   "org": "우성사료",
   "persons": [],
   "beneficiaries": 0,
   "grouped": true
  },
  {
   "id": "d3",
   "m": 1,
   "d": 10,
   "desc": "오미르 외 대출이자 상환",
   "amount": 1357700,
   "kind": "LOAN_INTEREST_IN",
   "org": "우성사료",
   "persons": [],
   "beneficiaries": 0,
   "grouped": true
  },
  {
   "id": "d4",
   "m": 1,
   "d": 13,
   "desc": "대출 (차동현)",
   "amount": 30000000,
   "kind": "LOAN_OUT",
   "org": "",
   "persons": [
    "차동현"
   ],
   "beneficiaries": 1,
   "grouped": false
  },
  {
   "id": "d5",
   "m": 1,
   "d": 13,
   "desc": "사무보조비 (1월)",
   "amount": 50000,
   "kind": "ADMIN_EXPENSE",
   "org": "",
   "persons": [],
   "beneficiaries": 0,
   "grouped": false
  },
  {
   "id": "d6",
   "m": 2,
   "d": 10,
   "desc": "박준서 외 대출원금 상환",
   "amount": 3670000,
   "kind": "LOAN_PRINCIPAL_IN",
   "org": "우성",
   "persons": [],
   "beneficiaries": 0,
   "grouped": true
  },
  {
   "id": "d7",
   "m": 2,
   "d": 10,
   "desc": "박준서 외 대출이자 상환",
   "amount": 322130,
   "kind": "LOAN_INTEREST_IN",
   "org": "우성",
   "persons": [],
   "beneficiaries": 0,
   "grouped": true
  },
  {
   "id": "d8",
   "m": 2,
   "d": 10,
   "desc": "오미르 외 대출원금 상환",
   "amount": 16210000,
   "kind": "LOAN_PRINCIPAL_IN",
   "org": "우성사료",
   "persons": [],
   "beneficiaries": 0,
   "grouped": true
  },
  {
   "id": "d9",
   "m": 2,
   "d": 10,
   "desc": "오미르 외 대출이자 상환",
   "amount": 1389450,
   "kind": "LOAN_INTEREST_IN",
   "org": "우성사료",
   "persons": [],
   "beneficiaries": 0,
   "grouped": true
  },
  {
   "id": "d10",
   "m": 2,
   "d": 11,
   "desc": "대출 (이미르)",
   "amount": 20000000,
   "kind": "LOAN_OUT",
   "org": "",
   "persons": [
    "이미르"
   ],
   "beneficiaries": 1,
   "grouped": false
  },
  {
   "id": "d11",
   "m": 2,
   "d": 11,
   "desc": "복지기금 회의비",
   "amount": 2100000,
   "kind": "WELFARE_EVENT",
   "org": "",
   "persons": [],
   "beneficiaries": 8,
   "grouped": false
  },
  {
   "id": "d12",
   "m": 2,
   "d": 11,
   "desc": "공인인증서수수료",
   "amount": 4400,
   "kind": "ADMIN_EXPENSE",
   "org": "",
   "persons": [],
   "beneficiaries": 0,
   "grouped": false
  },
  {
   "id": "d13",
   "m": 2,
   "d": 11,
   "desc": "사무보조비 (2월)",
   "amount": 50000,
   "kind": "ADMIN_EXPENSE",
   "org": "",
   "persons": [],
   "beneficiaries": 0,
   "grouped": false
  },
  {
   "id": "d14",
   "m": 2,
   "d": 12,
   "desc": "복지기금 미상환액(오예준)",
   "amount": 507640,
   "kind": "ADJ_REFUND",
   "org": "",
   "persons": [
    "오예준"
   ],
   "beneficiaries": 1,
   "grouped": false,
   "adjOrg": "우성",
   "refundPrincipal": 500000,
   "refundInterest": 7640
  },
  {
   "id": "d15",
   "m": 3,
   "d": 10,
   "desc": "이미르 전액상환",
   "amount": 19580000,
   "kind": "LOAN_PRINCIPAL_IN",
   "org": "",
   "persons": [
    "이미르"
   ],
   "beneficiaries": 1,
   "grouped": false
  },
  {
   "id": "d16",
   "m": 3,
   "d": 10,
   "desc": "이미르 대출이자",
   "amount": 0,
   "kind": "LOAN_INTEREST_IN",
   "org": "",
   "persons": [
    "이미르"
   ],
   "beneficiaries": 1,
   "grouped": false
  },
  {
   "id": "d17",
   "m": 3,
   "d": 10,
   "desc": "안동현 외 대출원금 상환",
   "amount": 16630000,
   "kind": "LOAN_PRINCIPAL_IN",
   "org": "우성사료",
   "persons": [],
   "beneficiaries": 0,
   "grouped": true
  },
  {
   "id": "d18",
   "m": 3,
   "d": 10,
   "desc": "안동현 외 대출이자 상환",
   "amount": 1256230,
   "kind": "LOAN_INTEREST_IN",
   "org": "우성사료",
   "persons": [],
   "beneficiaries": 0,
   "grouped": true
  },
  {
   "id": "d19",
   "m": 3,
   "d": 11,
   "desc": "대출 (임예준)",
   "amount": 30000000,
   "kind": "LOAN_OUT",
   "org": "",
   "persons": [
    "임예준"
   ],
   "beneficiaries": 1,
   "grouped": false
  },
  {
   "id": "d20",
   "m": 3,
   "d": 11,
   "desc": "안마의자 구입비",
   "amount": 9000000,
   "kind": "WELFARE_FACILITY",
   "org": "",
   "persons": [],
   "beneficiaries": 35,
   "grouped": false
  },
  {
   "id": "d21",
   "m": 3,
   "d": 11,
   "desc": "사무보조비 (3월)",
   "amount": 50000,
   "kind": "ADMIN_EXPENSE",
   "org": "",
   "persons": [],
   "beneficiaries": 0,
   "grouped": false
  },
  {
   "id": "d22",
   "m": 3,
   "d": 14,
   "desc": "박준서 외 대출원금 상환",
   "amount": 3170000,
   "kind": "LOAN_PRINCIPAL_IN",
   "org": "우성",
   "persons": [],
   "beneficiaries": 0,
   "grouped": true
  },
  {
   "id": "d23",
   "m": 3,
   "d": 14,
   "desc": "박준서 외 대출이자 상환",
   "amount": 276770,
   "kind": "LOAN_INTEREST_IN",
   "org": "우성",
   "persons": [],
   "beneficiaries": 0,
   "grouped": true
  },
  {
   "id": "d24",
   "m": 3,
   "d": 15,
   "desc": "결산이자",
   "amount": 2245,
   "kind": "BANK_INTEREST",
   "org": "",
   "persons": [],
   "beneficiaries": 0,
   "grouped": false
  },
  {
   "id": "d25",
   "m": 3,
   "d": 27,
   "desc": "퇴직위로금품 (윤미르)",
   "amount": 1000000,
   "kind": "WELFARE_ETC",
   "org": "",
   "persons": [
    "윤미르"
   ],
   "beneficiaries": 1,
   "grouped": false
  },
  {
   "id": "d26",
   "m": 4,
   "d": 10,
   "desc": "박준서 외 대출원금 상환",
   "amount": 3170000,
   "kind": "LOAN_PRINCIPAL_IN",
   "org": "우성",
   "persons": [],
   "beneficiaries": 0,
   "grouped": true
  },
  {
   "id": "d27",
   "m": 4,
   "d": 10,
   "desc": "박준서 외 대출이자 상환",
   "amount": 298330,
   "kind": "LOAN_INTEREST_IN",
   "org": "우성",
   "persons": [],
   "beneficiaries": 0,
   "grouped": true
  },
  {
   "id": "d28",
   "m": 4,
   "d": 10,
   "desc": "안동현 외 대출원금 상환",
   "amount": 16710000,
   "kind": "LOAN_PRINCIPAL_IN",
   "org": "우성사료",
   "persons": [],
   "beneficiaries": 0,
   "grouped": true
  },
  {
   "id": "d29",
   "m": 4,
   "d": 10,
   "desc": "안동현 외 대출이자 상환",
   "amount": 1374230,
   "kind": "LOAN_INTEREST_IN",
   "org": "우성사료",
   "persons": [],
   "beneficiaries": 0,
   "grouped": true
  },
  {
   "id": "d30",
   "m": 4,
   "d": 11,
   "desc": "대출 (강미르)",
   "amount": 20000000,
   "kind": "LOAN_OUT",
   "org": "",
   "persons": [
    "강미르"
   ],
   "beneficiaries": 1,
   "grouped": false
  },
  {
   "id": "d31",
   "m": 4,
   "d": 11,
   "desc": "사무보조비 (4월)",
   "amount": 50000,
   "kind": "ADMIN_EXPENSE",
   "org": "",
   "persons": [],
   "beneficiaries": 0,
   "grouped": false
  },
  {
   "id": "d32",
   "m": 4,
   "d": 11,
   "desc": "세무조정수수료",
   "amount": 100000,
   "kind": "ADMIN_EXPENSE",
   "org": "",
   "persons": [],
   "beneficiaries": 0,
   "grouped": false
  },
  {
   "id": "d33",
   "m": 5,
   "d": 9,
   "desc": "박준서 외 대출원금 상환",
   "amount": 3730000,
   "kind": "LOAN_PRINCIPAL_IN",
   "org": "우성",
   "persons": [],
   "beneficiaries": 0,
   "grouped": true
  },
  {
   "id": "d34",
   "m": 5,
   "d": 9,
   "desc": "박준서 외 대출이자 상환",
   "amount": 319200,
   "kind": "LOAN_INTEREST_IN",
   "org": "우성",
   "persons": [],
   "beneficiaries": 0,
   "grouped": true
  },
  {
   "id": "d35",
   "m": 5,
   "d": 9,
   "desc": "안동현 외 대출원금 상환",
   "amount": 16040000,
   "kind": "LOAN_PRINCIPAL_IN",
   "org": "우성사료",
   "persons": [],
   "beneficiaries": 0,
   "grouped": true
  },
  {
   "id": "d36",
   "m": 5,
   "d": 9,
   "desc": "안동현 외 대출이자 상환",
   "amount": 1206280,
   "kind": "LOAN_INTEREST_IN",
   "org": "우성사료",
   "persons": [],
   "beneficiaries": 0,
   "grouped": true
  },
  {
   "id": "d37",
   "m": 5,
   "d": 12,
   "desc": "대출 (홍예린)",
   "amount": 20000000,
   "kind": "LOAN_OUT",
   "org": "",
   "persons": [
    "홍예린"
   ],
   "beneficiaries": 1,
   "grouped": false
  },
  {
   "id": "d38",
   "m": 5,
   "d": 12,
   "desc": "아산노조 설립 40주년 행사비",
   "amount": 2431260,
   "kind": "WELFARE_EVENT",
   "org": "아산",
   "persons": [],
   "beneficiaries": 8,
   "grouped": false
  },
  {
   "id": "d39",
   "m": 5,
   "d": 12,
   "desc": "사무보조비 (5월)",
   "amount": 50000,
   "kind": "ADMIN_EXPENSE",
   "org": "",
   "persons": [],
   "beneficiaries": 0,
   "grouped": false
  },
  {
   "id": "d40",
   "m": 6,
   "d": 10,
   "desc": "박준서 외 대출원금 상환",
   "amount": 3730000,
   "kind": "LOAN_PRINCIPAL_IN",
   "org": "우성",
   "persons": [],
   "beneficiaries": 0,
   "grouped": true
  },
  {
   "id": "d41",
   "m": 6,
   "d": 10,
   "desc": "박준서 외 대출이자 상환",
   "amount": 342420,
   "kind": "LOAN_INTEREST_IN",
   "org": "우성",
   "persons": [],
   "beneficiaries": 0,
   "grouped": true
  },
  {
   "id": "d42",
   "m": 6,
   "d": 10,
   "desc": "안동현 외 대출원금 상환",
   "amount": 16460000,
   "kind": "LOAN_PRINCIPAL_IN",
   "org": "우성사료",
   "persons": [],
   "beneficiaries": 0,
   "grouped": true
  },
  {
   "id": "d43",
   "m": 6,
   "d": 10,
   "desc": "안동현 외 대출이자 상환",
   "amount": 1338190,
   "kind": "LOAN_INTEREST_IN",
   "org": "우성사료",
   "persons": [],
   "beneficiaries": 0,
   "grouped": true
  },
  {
   "id": "d44",
   "m": 6,
   "d": 17,
   "desc": "퇴직위로금품 (장민준,임예린)",
   "amount": 2000000,
   "kind": "WELFARE_ETC",
   "org": "",
   "persons": [
    "장민준",
    "임예린"
   ],
   "beneficiaries": 2,
   "grouped": false
  },
  {
   "id": "d45",
   "m": 6,
   "d": 21,
   "desc": "결산이자",
   "amount": 2670,
   "kind": "BANK_INTEREST",
   "org": "",
   "persons": [],
   "beneficiaries": 0,
   "grouped": false
  },
  {
   "id": "d46",
   "m": 7,
   "d": 10,
   "desc": "박준서 외 대출원금 상환",
   "amount": 3730000,
   "kind": "LOAN_PRINCIPAL_IN",
   "org": "우성",
   "persons": [],
   "beneficiaries": 0,
   "grouped": true
  },
  {
   "id": "d47",
   "m": 7,
   "d": 10,
   "desc": "박준서 외 대출이자 상환",
   "amount": 311820,
   "kind": "LOAN_INTEREST_IN",
   "org": "우성",
   "persons": [],
   "beneficiaries": 0,
   "grouped": true
  },
  {
   "id": "d48",
   "m": 7,
   "d": 10,
   "desc": "안동현 외 대출원금 상환",
   "amount": 16540000,
   "kind": "LOAN_PRINCIPAL_IN",
   "org": "우성사료",
   "persons": [],
   "beneficiaries": 0,
   "grouped": true
  },
  {
   "id": "d49",
   "m": 7,
   "d": 10,
   "desc": "안동현 외 대출이자 상환",
   "amount": 1281820,
   "kind": "LOAN_INTEREST_IN",
   "org": "우성사료",
   "persons": [],
   "beneficiaries": 0,
   "grouped": true
  },
  {
   "id": "d50",
   "m": 7,
   "d": 16,
   "desc": "대출 (주미르)",
   "amount": 30000000,
   "kind": "LOAN_OUT",
   "org": "",
   "persons": [
    "주미르"
   ],
   "beneficiaries": 1,
   "grouped": false
  },
  {
   "id": "d51",
   "m": 7,
   "d": 16,
   "desc": "사무보조비 (6월, 7월)",
   "amount": 100000,
   "kind": "ADMIN_EXPENSE",
   "org": "",
   "persons": [],
   "beneficiaries": 0,
   "grouped": false
  },
  {
   "id": "d52",
   "m": 7,
   "d": 22,
   "desc": "한준서 전액상환",
   "amount": 16550000,
   "kind": "LOAN_PRINCIPAL_IN",
   "org": "",
   "persons": [
    "한준서"
   ],
   "beneficiaries": 1,
   "grouped": false
  },
  {
   "id": "d53",
   "m": 7,
   "d": 22,
   "desc": "한준서 대출이자",
   "amount": 140110,
   "kind": "LOAN_INTEREST_IN",
   "org": "",
   "persons": [
    "한준서"
   ],
   "beneficiaries": 1,
   "grouped": false
  },
  {
   "id": "d54",
   "m": 7,
   "d": 22,
   "desc": "안마의자 구입비",
   "amount": 10206000,
   "kind": "WELFARE_FACILITY",
   "org": "",
   "persons": [],
   "beneficiaries": 35,
   "grouped": false
  },
  {
   "id": "d55",
   "m": 7,
   "d": 25,
   "desc": "대출 (김민준)",
   "amount": 20000000,
   "kind": "LOAN_OUT",
   "org": "",
   "persons": [
    "김민준"
   ],
   "beneficiaries": 1,
   "grouped": false
  },
  {
   "id": "d56",
   "m": 8,
   "d": 8,
   "desc": "박준서 외 대출원금 상환",
   "amount": 4150000,
   "kind": "LOAN_PRINCIPAL_IN",
   "org": "우성",
   "persons": [],
   "beneficiaries": 0,
   "grouped": true
  },
  {
   "id": "d57",
   "m": 8,
   "d": 8,
   "desc": "박준서 외 대출이자 상환",
   "amount": 317200,
   "kind": "LOAN_INTEREST_IN",
   "org": "우성",
   "persons": [],
   "beneficiaries": 0,
   "grouped": true
  },
  {
   "id": "d58",
   "m": 8,
   "d": 8,
   "desc": "안동현 외 대출원금 상환",
   "amount": 16540000,
   "kind": "LOAN_PRINCIPAL_IN",
   "org": "우성사료",
   "persons": [],
   "beneficiaries": 0,
   "grouped": true
  },
  {
   "id": "d59",
   "m": 8,
   "d": 8,
   "desc": "안동현 외 대출이자 상환",
   "amount": 1177840,
   "kind": "LOAN_INTEREST_IN",
   "org": "우성사료",
   "persons": [],
   "beneficiaries": 0,
   "grouped": true
  },
  {
   "id": "d60",
   "m": 8,
   "d": 19,
   "desc": "대출 (신예린)",
   "amount": 20000000,
   "kind": "LOAN_OUT",
   "org": "",
   "persons": [
    "신예린"
   ],
   "beneficiaries": 1,
   "grouped": false
  },
  {
   "id": "d61",
   "m": 8,
   "d": 19,
   "desc": "퇴직위로금품 (박민준)",
   "amount": 1000000,
   "kind": "WELFARE_ETC",
   "org": "",
   "persons": [
    "박민준"
   ],
   "beneficiaries": 1,
   "grouped": false
  },
  {
   "id": "d62",
   "m": 8,
   "d": 19,
   "desc": "주민세",
   "amount": 93750,
   "kind": "ADMIN_EXPENSE",
   "org": "",
   "persons": [],
   "beneficiaries": 0,
   "grouped": false
  },
  {
   "id": "d63",
   "m": 8,
   "d": 19,
   "desc": "사무보조비 (8월)",
   "amount": 50000,
   "kind": "ADMIN_EXPENSE",
   "org": "",
   "persons": [],
   "beneficiaries": 0,
   "grouped": false
  },
  {
   "id": "d64",
   "m": 8,
   "d": 28,
   "desc": "박민준 전액상환",
   "amount": 18000000,
   "kind": "LOAN_PRINCIPAL_IN",
   "org": "",
   "persons": [
    "박민준"
   ],
   "beneficiaries": 1,
   "grouped": false
  },
  {
   "id": "d65",
   "m": 8,
   "d": 28,
   "desc": "박민준 대출이자",
   "amount": 29590,
   "kind": "LOAN_INTEREST_IN",
   "org": "",
   "persons": [
    "박민준"
   ],
   "beneficiaries": 1,
   "grouped": false
  },
  {
   "id": "d66",
   "m": 9,
   "d": 8,
   "desc": "퇴직위로금품 (최예린)",
   "amount": 1000000,
   "kind": "WELFARE_ETC",
   "org": "",
   "persons": [
    "최예린"
   ],
   "beneficiaries": 1,
   "grouped": false
  },
  {
   "id": "d67",
   "m": 9,
   "d": 10,
   "desc": "박준서 외 대출원금 상환",
   "amount": 3650000,
   "kind": "LOAN_PRINCIPAL_IN",
   "org": "우성",
   "persons": [],
   "beneficiaries": 0,
   "grouped": true
  },
  {
   "id": "d68",
   "m": 9,
   "d": 10,
   "desc": "박준서 외 대출이자 상환",
   "amount": 327060,
   "kind": "LOAN_INTEREST_IN",
   "org": "우성",
   "persons": [],
   "beneficiaries": 0,
   "grouped": true
  },
  {
   "id": "d69",
   "m": 9,
   "d": 10,
   "desc": "안동현 외 대출원금 상환",
   "amount": 16460000,
   "kind": "LOAN_PRINCIPAL_IN",
   "org": "우성사료",
   "persons": [],
   "beneficiaries": 0,
   "grouped": true
  },
  {
   "id": "d70",
   "m": 9,
   "d": 10,
   "desc": "안동현 외 대출이자 상환",
   "amount": 1347280,
   "kind": "LOAN_INTEREST_IN",
   "org": "우성사료",
   "persons": [],
   "beneficiaries": 0,
   "grouped": true
  },
  {
   "id": "d71",
   "m": 9,
   "d": 12,
   "desc": "정준서 전액상환",
   "amount": 6080000,
   "kind": "LOAN_PRINCIPAL_IN",
   "org": "",
   "persons": [
    "정준서"
   ],
   "beneficiaries": 1,
   "grouped": false
  },
  {
   "id": "d72",
   "m": 9,
   "d": 12,
   "desc": "정준서 대출이자",
   "amount": 0,
   "kind": "LOAN_INTEREST_IN",
   "org": "",
   "persons": [
    "정준서"
   ],
   "beneficiaries": 1,
   "grouped": false
  },
  {
   "id": "d73",
   "m": 9,
   "d": 20,
   "desc": "결산이자",
   "amount": 5922,
   "kind": "BANK_INTEREST",
   "org": "",
   "persons": [],
   "beneficiaries": 0,
   "grouped": false
  },
  {
   "id": "d74",
   "m": 9,
   "d": 25,
   "desc": "전민준 전액상환",
   "amount": 7500000,
   "kind": "LOAN_PRINCIPAL_IN",
   "org": "",
   "persons": [
    "전민준"
   ],
   "beneficiaries": 1,
   "grouped": false
  },
  {
   "id": "d75",
   "m": 9,
   "d": 25,
   "desc": "전민준 대출이자",
   "amount": 9860,
   "kind": "LOAN_INTEREST_IN",
   "org": "",
   "persons": [
    "전민준"
   ],
   "beneficiaries": 1,
   "grouped": false
  },
  {
   "id": "d76",
   "m": 9,
   "d": 29,
   "desc": "대출 (전민준)",
   "amount": 30000000,
   "kind": "LOAN_OUT",
   "org": "",
   "persons": [
    "전민준"
   ],
   "beneficiaries": 1,
   "grouped": false
  },
  {
   "id": "d77",
   "m": 10,
   "d": 10,
   "desc": "박준서 외 대출원금 상환",
   "amount": 3650000,
   "kind": "LOAN_PRINCIPAL_IN",
   "org": "우성",
   "persons": [],
   "beneficiaries": 0,
   "grouped": true
  },
  {
   "id": "d78",
   "m": 10,
   "d": 10,
   "desc": "박준서 외 대출이자 상환",
   "amount": 288310,
   "kind": "LOAN_INTEREST_IN",
   "org": "우성",
   "persons": [],
   "beneficiaries": 0,
   "grouped": true
  },
  {
   "id": "d79",
   "m": 10,
   "d": 10,
   "desc": "안동현 외 대출원금 상환",
   "amount": 16180000,
   "kind": "LOAN_PRINCIPAL_IN",
   "org": "우성사료",
   "persons": [],
   "beneficiaries": 0,
   "grouped": true
  },
  {
   "id": "d80",
   "m": 10,
   "d": 10,
   "desc": "안동현 외 대출이자 상환",
   "amount": 1195240,
   "kind": "LOAN_INTEREST_IN",
   "org": "우성사료",
   "persons": [],
   "beneficiaries": 0,
   "grouped": true
  },
  {
   "id": "d81",
   "m": 10,
   "d": 16,
   "desc": "대출 (윤예린)",
   "amount": 30000000,
   "kind": "LOAN_OUT",
   "org": "",
   "persons": [
    "윤예린"
   ],
   "beneficiaries": 1,
   "grouped": false
  },
  {
   "id": "d82",
   "m": 10,
   "d": 17,
   "desc": "사무보조비 (9월, 10월)",
   "amount": 100000,
   "kind": "ADMIN_EXPENSE",
   "org": "",
   "persons": [],
   "beneficiaries": 0,
   "grouped": false
  },
  {
   "id": "d83",
   "m": 10,
   "d": 27,
   "desc": "강예준 전액상환",
   "amount": 9000000,
   "kind": "LOAN_PRINCIPAL_IN",
   "org": "",
   "persons": [
    "강예준"
   ],
   "beneficiaries": 1,
   "grouped": false
  },
  {
   "id": "d84",
   "m": 10,
   "d": 27,
   "desc": "강예준 대출이자",
   "amount": 12580,
   "kind": "LOAN_INTEREST_IN",
   "org": "",
   "persons": [
    "강예준"
   ],
   "beneficiaries": 1,
   "grouped": false
  },
  {
   "id": "d85",
   "m": 10,
   "d": 28,
   "desc": "조동현 전액상환",
   "amount": 760000,
   "kind": "LOAN_PRINCIPAL_IN",
   "org": "",
   "persons": [
    "조동현"
   ],
   "beneficiaries": 1,
   "grouped": false
  },
  {
   "id": "d86",
   "m": 10,
   "d": 28,
   "desc": "조동현 대출이자",
   "amount": 1120,
   "kind": "LOAN_INTEREST_IN",
   "org": "",
   "persons": [
    "조동현"
   ],
   "beneficiaries": 1,
   "grouped": false
  },
  {
   "id": "d87",
   "m": 11,
   "d": 10,
   "desc": "박준서 외 대출원금 상환",
   "amount": 4270000,
   "kind": "LOAN_PRINCIPAL_IN",
   "org": "우성",
   "persons": [],
   "beneficiaries": 0,
   "grouped": true
  },
  {
   "id": "d88",
   "m": 11,
   "d": 10,
   "desc": "박준서 외 대출이자 상환",
   "amount": 352740,
   "kind": "LOAN_INTEREST_IN",
   "org": "우성",
   "persons": [],
   "beneficiaries": 0,
   "grouped": true
  },
  {
   "id": "d89",
   "m": 11,
   "d": 10,
   "desc": "안동현 외 대출원금 상환",
   "amount": 15400000,
   "kind": "LOAN_PRINCIPAL_IN",
   "org": "우성사료",
   "persons": [],
   "beneficiaries": 0,
   "grouped": true
  },
  {
   "id": "d90",
   "m": 11,
   "d": 10,
   "desc": "안동현 외 대출이자 상환",
   "amount": 1214860,
   "kind": "LOAN_INTEREST_IN",
   "org": "우성사료",
   "persons": [],
   "beneficiaries": 0,
   "grouped": true
  },
  {
   "id": "d91",
   "m": 11,
   "d": 12,
   "desc": "대출 (허예준)",
   "amount": 30000000,
   "kind": "LOAN_OUT",
   "org": "",
   "persons": [
    "허예준"
   ],
   "beneficiaries": 1,
   "grouped": false
  },
  {
   "id": "d92",
   "m": 11,
   "d": 12,
   "desc": "사무보조비 (11월)",
   "amount": 50000,
   "kind": "ADMIN_EXPENSE",
   "org": "",
   "persons": [],
   "beneficiaries": 0,
   "grouped": false
  },
  {
   "id": "d93",
   "m": 12,
   "d": 10,
   "desc": "박준서 외 대출원금 상환",
   "amount": 4270000,
   "kind": "LOAN_PRINCIPAL_IN",
   "org": "우성",
   "persons": [],
   "beneficiaries": 0,
   "grouped": true
  },
  {
   "id": "d94",
   "m": 12,
   "d": 10,
   "desc": "박준서 외 대출이자 상환",
   "amount": 342760,
   "kind": "LOAN_INTEREST_IN",
   "org": "우성",
   "persons": [],
   "beneficiaries": 0,
   "grouped": true
  },
  {
   "id": "d95",
   "m": 12,
   "d": 10,
   "desc": "안동현 외 대출원금 상환",
   "amount": 16230000,
   "kind": "LOAN_PRINCIPAL_IN",
   "org": "우성사료",
   "persons": [],
   "beneficiaries": 0,
   "grouped": true
  },
  {
   "id": "d96",
   "m": 12,
   "d": 10,
   "desc": "안동현 외 대출이자 상환",
   "amount": 1209200,
   "kind": "LOAN_INTEREST_IN",
   "org": "우성사료",
   "persons": [],
   "beneficiaries": 0,
   "grouped": true
  },
  {
   "id": "d97",
   "m": 12,
   "d": 12,
   "desc": "대출 (오미르)",
   "amount": 30000000,
   "kind": "LOAN_OUT",
   "org": "",
   "persons": [
    "오미르"
   ],
   "beneficiaries": 1,
   "grouped": false
  },
  {
   "id": "d98",
   "m": 12,
   "d": 12,
   "desc": "15대 노조집행부 이임식 행사지원비",
   "amount": 1100000,
   "kind": "WELFARE_EVENT",
   "org": "",
   "persons": [],
   "beneficiaries": 4,
   "grouped": false
  },
  {
   "id": "d99",
   "m": 12,
   "d": 12,
   "desc": "사무보조비 (12월)",
   "amount": 50000,
   "kind": "ADMIN_EXPENSE",
   "org": "",
   "persons": [],
   "beneficiaries": 0,
   "grouped": false
  },
  {
   "id": "d100",
   "m": 12,
   "d": 20,
   "desc": "결산이자",
   "amount": 6926,
   "kind": "BANK_INTEREST",
   "org": "",
   "persons": [],
   "beneficiaries": 0,
   "grouped": false
  },
  {
   "id": "d101",
   "m": 12,
   "d": 23,
   "desc": "오미르 전액상환",
   "amount": 5500000,
   "kind": "LOAN_PRINCIPAL_IN",
   "org": "",
   "persons": [
    "오미르"
   ],
   "beneficiaries": 1,
   "grouped": false
  },
  {
   "id": "d102",
   "m": 12,
   "d": 23,
   "desc": "오미르 대출이자",
   "amount": 5880,
   "kind": "LOAN_INTEREST_IN",
   "org": "",
   "persons": [
    "오미르"
   ],
   "beneficiaries": 1,
   "grouped": false
  },
  {
   "id": "d103",
   "m": 12,
   "d": 24,
   "desc": "박준서 전액상환",
   "amount": 18560000,
   "kind": "LOAN_PRINCIPAL_IN",
   "org": "",
   "persons": [
    "박준서"
   ],
   "beneficiaries": 1,
   "grouped": false
  },
  {
   "id": "d104",
   "m": 12,
   "d": 24,
   "desc": "박준서 대출이자",
   "amount": 22000,
   "kind": "LOAN_INTEREST_IN",
   "org": "",
   "persons": [
    "박준서"
   ],
   "beneficiaries": 1,
   "grouped": false
  },
  {
   "id": "d105",
   "m": 12,
   "d": 26,
   "desc": "대출(박준서)",
   "amount": 30000000,
   "kind": "LOAN_OUT",
   "org": "",
   "persons": [
    "박준서"
   ],
   "beneficiaries": 1,
   "grouped": false
  }
 ],
 "loans": [
  {
   "id": "l0",
   "org": "우성",
   "name": "김민준",
   "principal": 20000000,
   "balance": 17900000,
   "note": ""
  },
  {
   "id": "l1",
   "org": "우성",
   "name": "이예린",
   "principal": 23000000,
   "balance": 15500000,
   "note": ""
  },
  {
   "id": "l2",
   "org": "우성",
   "name": "박준서",
   "principal": 30000000,
   "balance": 30000000,
   "note": ""
  },
  {
   "id": "l3",
   "org": "우성",
   "name": "최예준",
   "principal": 30000000,
   "balance": 21500000,
   "note": ""
  },
  {
   "id": "l4",
   "org": "우성",
   "name": "정동현",
   "principal": 30000000,
   "balance": 2000000,
   "note": ""
  },
  {
   "id": "l5",
   "org": "우성",
   "name": "강미르",
   "principal": 20000000,
   "balance": 15520000,
   "note": ""
  },
  {
   "id": "l6",
   "org": "우성",
   "name": "조민준",
   "principal": 30000000,
   "balance": 15000000,
   "note": ""
  },
  {
   "id": "l7",
   "org": "우성",
   "name": "윤예린",
   "principal": 30000000,
   "balance": 28760000,
   "note": ""
  },
  {
   "id": "l8",
   "org": "본사",
   "name": "장준서",
   "principal": 30000000,
   "balance": 20000000,
   "note": ""
  },
  {
   "id": "l9",
   "org": "본사",
   "name": "임예준",
   "principal": 30000000,
   "balance": 25500000,
   "note": ""
  },
  {
   "id": "l10",
   "org": "본사",
   "name": "한동현",
   "principal": 30000000,
   "balance": 3500000,
   "note": ""
  },
  {
   "id": "l11",
   "org": "본사",
   "name": "오미르",
   "principal": 30000000,
   "balance": 30000000,
   "note": ""
  },
  {
   "id": "l12",
   "org": "본사",
   "name": "서민준",
   "principal": 30000000,
   "balance": 13500000,
   "note": ""
  },
  {
   "id": "l13",
   "org": "본사",
   "name": "신예린",
   "principal": 20000000,
   "balance": 18320000,
   "note": ""
  },
  {
   "id": "l14",
   "org": "논산1본부",
   "name": "권준서",
   "principal": 30000000,
   "balance": 12500000,
   "note": ""
  },
  {
   "id": "l15",
   "org": "논산1본부",
   "name": "황예준A",
   "principal": 20000000,
   "balance": 2360000,
   "note": ""
  },
  {
   "id": "l16",
   "org": "논산1본부",
   "name": "안동현",
   "principal": 30000000,
   "balance": 24000000,
   "note": ""
  },
  {
   "id": "l17",
   "org": "논산1본부",
   "name": "송미르",
   "principal": 20000000,
   "balance": 4460000,
   "note": ""
  },
  {
   "id": "l18",
   "org": "논산1본부",
   "name": "전민준",
   "principal": 30000000,
   "balance": 28500000,
   "note": ""
  },
  {
   "id": "l19",
   "org": "논산1본부",
   "name": "홍예린",
   "principal": 20000000,
   "balance": 17060000,
   "note": ""
  },
  {
   "id": "l20",
   "org": "논산1본부",
   "name": "유준서",
   "principal": 10000000,
   "balance": 1600000,
   "note": ""
  },
  {
   "id": "l21",
   "org": "논산1본부",
   "name": "고예준",
   "principal": 30000000,
   "balance": 11500000,
   "note": ""
  },
  {
   "id": "l22",
   "org": "논산1본부",
   "name": "문동현",
   "principal": 20000000,
   "balance": 1100000,
   "note": ""
  },
  {
   "id": "l23",
   "org": "경산2본부",
   "name": "손미르",
   "principal": 30000000,
   "balance": 13000000,
   "note": ""
  },
  {
   "id": "l24",
   "org": "경산2본부",
   "name": "양민준",
   "principal": 20000000,
   "balance": 12160000,
   "note": ""
  },
  {
   "id": "l25",
   "org": "경산2본부",
   "name": "배예린",
   "principal": 30000000,
   "balance": 6500000,
   "note": ""
  },
  {
   "id": "l26",
   "org": "경산2본부",
   "name": "백준서",
   "principal": 30000000,
   "balance": 1000000,
   "note": ""
  },
  {
   "id": "l27",
   "org": "경산2본부",
   "name": "허예준",
   "principal": 30000000,
   "balance": 29170000,
   "note": ""
  },
  {
   "id": "l28",
   "org": "경산2본부",
   "name": "남동현",
   "principal": 20000000,
   "balance": 16220000,
   "note": "휴직(일시정지)"
  },
  {
   "id": "l29",
   "org": "아산3본부",
   "name": "심미르",
   "principal": 24000000,
   "balance": 16500000,
   "note": ""
  },
  {
   "id": "l30",
   "org": "아산3본부",
   "name": "노민준",
   "principal": 30000000,
   "balance": 19500000,
   "note": ""
  },
  {
   "id": "l31",
   "org": "아산3본부",
   "name": "하예린",
   "principal": 30000000,
   "balance": 19500000,
   "note": ""
  },
  {
   "id": "l32",
   "org": "아산3본부",
   "name": "곽준서B",
   "principal": 30000000,
   "balance": 18000000,
   "note": ""
  },
  {
   "id": "l33",
   "org": "아산3본부",
   "name": "성예준",
   "principal": 30000000,
   "balance": 12500000,
   "note": ""
  },
  {
   "id": "l34",
   "org": "아산3본부",
   "name": "차동현",
   "principal": 30000000,
   "balance": 23180000,
   "note": ""
  },
  {
   "id": "l35",
   "org": "아산3본부",
   "name": "주미르",
   "principal": 30000000,
   "balance": 27500000,
   "note": ""
  },
  {
   "id": "l36",
   "org": "아산3본부",
   "name": "우민준",
   "principal": 30000000,
   "balance": 7500000,
   "note": ""
  },
  {
   "id": "l37",
   "org": "아산3본부",
   "name": "구예린C",
   "principal": 20000000,
   "balance": 14960000,
   "note": ""
  },
  {
   "id": "l38",
   "org": "아산3본부",
   "name": "민준서",
   "principal": 30000000,
   "balance": 16500000,
   "note": ""
  },
  {
   "id": "l39",
   "org": "아산3본부",
   "name": "류예준",
   "principal": 20000000,
   "balance": 5300000,
   "note": ""
  },
  {
   "id": "l40",
   "org": "아산3본부",
   "name": "송미르",
   "principal": 30000000,
   "balance": 22000000,
   "note": ""
  },
  {
   "id": "l41",
   "org": "아산3본부",
   "name": "김동현",
   "principal": 30000000,
   "balance": 21000000,
   "note": ""
  }
 ]
}; })(typeof window !== 'undefined' ? window : globalThis);
