export interface KoPersonEntry {
  name: string;
  biography: string;
  relationToHyegyong?: string;
}

export interface KoEventEntry {
  title: string;
  summary: string;
}

export interface KoPlaceEntry {
  name: string;
  summary: string;
  modern?: string;
}

export interface KoGlossaryEntry {
  term: string;
  aliases: string[];
  category: string;
  definition: string;
}

export const KO_GROUP_LABELS: Record<string, string> = {
  'Hong Family': '홍씨 가문',
  'Yi Royal Family': '이씨 왕실',
  'Editorial Additions': '편집 추가 인물',
  'Editorial Splits': '편집 분리 후보',
};

export const KO_EVENT_TYPE_LABELS: Record<string, string> = {
  personal: '개인사',
  dynastic: '왕실·왕위 계승',
  court: '궁중',
  'dynastic-crisis': '왕실 위기',
  'memorial-statecraft': '추숭·기억 정치',
  'political-persecution': '정치적 박해',
  textual: '문헌·집필',
  factional: '붕당·파벌',
  'factional-punishment': '파벌 숙청·유배',
  regency: '수렴청정',
};

export const KO_RELATION_TYPE_LABELS: Record<string, string> = {
  spouse: '부부',
  'mother-son': '모자',
  'grandmother-grandson': '조모-손자',
  'daughter-father': '딸-아버지',
  'daughter-mother': '딸-어머니',
  'son-father': '아들-아버지',
  'son-mother': '아들-어머니',
  'grandson-grandfather': '손자-조부',
  consort: '군주-후궁',
  regency: '수렴청정',
  siblings: '형제자매',
  'adoptive-mother-son': '양모-양자',
  'father-son': '부자',
  'political-rivals': '정적',
  protector: '보호자',
  confidant: '최측근',
  'political-collaborators': '정치 협력자',
};

export const KO_OFFICE_TITLE_LABELS: Record<string, string> = {
  'Palace power broker': '궁중 권력 중개자',
  'Minister of the Right': '우의정',
  'Minister of the Left': '좌의정',
  'Royal confidant': '국왕 측근',
  'Senior Court Official': '원로 조정 대신',
  'Kyŏngju Kim faction leader': '경주 김씨 세력 핵심',
  'Crown Prince': '왕세자',
  Regent: '대리청정',
  'King of Joseon': '조선 국왕',
  'Crown Princess Consort': '세자빈',
  'Royal secondary consort': '왕실 후궁',
  'Heir Apparent (Crown Prince)': '왕세자(세자)',
  'Prince-Regent': '세자 대리청정',
  'Queen Consort': '왕비',
  'Dowager Regent': '수렴청정 대비',
};

export const KO_SOURCE_LABELS: Record<string, string> = {
  src_principal_people: '주요 인물',
  src_year_index: '연도 색인',
  src_memoir_flow: '회고록 흐름 가이드',
  src_1795: '1795년 회고록',
  src_1801: '1801년 회고록',
  src_1802: '1802년 회고록',
  src_1805: '1805년 회고록',
};

export const KO_WORK_TITLE = '혜경궁 홍씨 회고록';
export const KO_WORK_CONTRIBUTOR = '번역: 자현 김 하부시(JaHyun Kim Haboush)';

export const KO_PERSON: Record<string, KoPersonEntry> = {
  'person-001': {
    name: '정후겸',
    biography:
      '화완옹주의 양아들. 1766년에 과거에 급제했고 영조 재위기에 권세를 행사했다. 1776년 정조 즉위 후 불충 혐의로 처형되었다.',
  },
  'person-002': {
    name: '정휘량',
    biography:
      '정치달의 숙부. 좌의정을 지내는 등 관직 경력이 성공적이었고, 사도세자의 평양 행차 때 평안감사였다.',
  },
  'person-003': {
    name: '한유',
    biography:
      '재야 유학자. 홍봉한을 맹렬히 탄핵하는 상소를 올려 홍봉한 실각의 계기를 만들었고, 이후 처형되었다.',
  },
  'person-004': {
    name: '홍현보',
    biography:
      '혜경궁 홍씨의 친조부. 선조의 딸 정명공주의 후손이며, 예조판서를 지내는 등 관료 경력을 쌓았다.',
    relationToHyegyong: '친조부',
  },
  'person-005': {
    name: '홍인한',
    biography:
      '홍봉한의 아우. 1753년 과거 급제 후 요직을 거쳐 1774년 우의정, 1775년 좌의정을 지냈다. 1775년 정조의 대리청정을 반대했으며, 1776년 정조 즉위 직후 불충 혐의로 처형되었다.',
  },
  'person-006': {
    name: '홍국영',
    biography:
      '정조 즉위 초기의 핵심 측근. 홍씨의 다른 분파 출신으로 홍인한과는 적대했다. 정조의 권력 기반을 다지는 데 기여했지만 지나치게 권세를 키웠고, 왕실과 혼인으로 연결되려는 시도도 실패해 유배지에서 생을 마쳤다.',
  },
  'person-007': {
    name: '홍낙임',
    biography:
      '홍봉한의 셋째 아들로 혜경궁에게는 셋째 오라버니. 1769년 과거 급제 후 곧 은거했고, 1801년 천주교 연루 혐의로 처형되었다.',
  },
  'person-008': {
    name: '홍낙인',
    biography: '홍봉한의 장남이자 혜경궁의 맏오라버니. 관직 생활이 순탄했다.',
    relationToHyegyong: '오라버니',
  },
  'person-009': {
    name: '홍낙윤',
    biography: '홍봉한의 넷째이자 막내아들. 혜경궁 회고록에서 넷째 오라버니로 지칭되며 관직에 나아가지 않았다.',
  },
  'person-010': {
    name: '홍낙신',
    biography: '홍봉한의 둘째 아들. 1766년 과거 급제 후 1770년에 낙향해 관직에서 물러났다.',
  },
  'person-011': {
    name: '홍봉한',
    biography:
      '혜경궁 홍씨의 부친. 1744년 딸의 세자빈 간택 및 혼인, 그리고 같은 해 과거 급제를 계기로 약 30년간 관직에 있었다. 사도세자 사후에는 정조를 보호하는 인물로 부상했으나, 말년까지 임오년 사건의 책임을 둘러싼 공격을 반복적으로 받았다.',
    relationToHyegyong: '부친',
  },
  'person-012': {
    name: '홍수영',
    biography: '홍낙인의 장남으로 홍가의 종손. 1795년 회고록의 수신인이다.',
  },
  'person-013': {
    name: '김종수',
    biography:
      '외가 쪽으로 홍가와 연관이 있었으나 관계는 좋지 않았다. 홍국영과 협력했다가 홍국영 실각 뒤에는 그를 돌아서며 관직 기반을 유지했고, 끝내 우의정·좌의정에 올랐다.',
  },
  'person-014': {
    name: '김한기',
    biography: '김한구의 형제이며 정치적 동맹 관계였다.',
  },
  'person-015': {
    name: '김한구',
    biography:
      '정순왕후의 부친으로 영조의 장인. 오흥군 작호를 받았다. 경주 김씨 가문은 홍씨 가문과 오랜 경쟁 관계였다.',
  },
  'person-016': {
    name: '김관주',
    biography:
      '김귀주의 사촌이자 정치적 협력자. 정조 즉위 후 유배되었고, 정순왕후 수렴청정기(1800-1804)에 우의정까지 올랐으나 이후 다시 유배되었다.',
  },
  'person-017': {
    name: '김귀주',
    biography:
      '정순왕후의 오빠. 홍가와 경쟁한 경주 김씨 세력의 핵심 정치 인물이다. 1776년 정조 즉위 후 흑산도로 유배되었고, 1784년 나주 정착이 허락된 뒤 병사했다.',
  },
  'person-018': {
    name: '김시묵',
    biography: '효의왕후의 부친이자 정조의 장인. 청원군 작호를 받았고 여러 관직을 역임했다.',
  },
  'person-019': {
    name: '정조',
    biography:
      '1752년 혜경궁이 낳은 사도세자의 아들. 1762년 부친 사후 세자로 책봉되었고, 1775년 대리청정을 거쳐 1776년 영조 승하 뒤 즉위했다. 1800년 승하했다.',
  },
  'person-020': {
    name: '순조',
    biography:
      '1790년 가순궁(수빈 박씨) 소생으로 태어난 정조의 아들이자 혜경궁의 손자. 혜경궁의 1801년·1802년·1805년 회고록은 모두 순조를 향한 증언의 성격을 지닌다.',
    relationToHyegyong: '손자(가순궁 소생 정조의 아들, 1790년생)',
  },
  'person-021': {
    name: '영조',
    biography:
      '1694년 숙종과 최숙빈 사이에서 태어났다. 1721년 세자로 책봉되고 1724년 즉위했다. 탁월하지만 격정적인 군주로 그려지며, 사도세자의 부친이다.',
  },
  'person-022': {
    name: '혜경궁 홍씨',
    biography:
      '회고록의 저자. 홍봉한의 딸로 1744년 사도세자와 혼인했고, 정조와 청연옹주·청선옹주를 낳았다.',
  },
  'person-023': {
    name: '가순궁(수빈 박씨)',
    biography:
      '정조의 후궁이자 순조의 생모. 일반적 후궁과 달리 고위 관료 가문 출신이며, 부친 박준원이 형조판서를 지냈다. 1787년 정식 절차로 간택되어 입궁했다.',
  },
  'person-024': {
    name: '문씨 후궁',
    biography:
      '영조의 후궁. 1753년과 1754년에 환영옹주·화길옹주를 낳았다. 세손(정조) 제거를 꾀했다는 의심을 받았고, 1776년 정조 즉위 후 처형되었다.',
  },
  'person-025': {
    name: '선희궁(영빈 이씨)',
    biography:
      '영조의 후궁으로 사도세자와 여러 공주를 낳았다. 사도가 극도로 난폭해졌을 때 영조에게 사도 처단을 권했다는 전승이 있다.',
  },
  'person-026': {
    name: '흥은군 정재화',
    biography:
      '청선옹주의 남편이자 정조의 매부. 정조가 즉위 전 젊은 시절 방탕한 기류에 흔들리게 했다는 일화로 알려져 있으며, 이 일은 홍봉한과 손자 정조 사이 갈등의 한 원인으로 회고된다.',
  },
  'person-027': {
    name: '일성위 정치달',
    biography: '화완옹주의 남편.',
  },
  'person-028': {
    name: '홍씨 부인',
    biography:
      '혜경궁의 여동생. 1759년 이복길과 혼인했으나 시부가 역모 사건에 연루되면서 고단한 삶을 살았다.',
    relationToHyegyong: '여동생',
  },
  'person-029': {
    name: '민씨 부인',
    biography: '홍낙인의 부인. 명문 여흥 민씨 가문 출신으로 1745년 홍낙인과 혼인했다.',
  },
  'person-030': {
    name: '이씨 부인',
    biography:
      '홍봉한의 부인이자 혜경궁의 모친. 부친 이집은 딸 혼인 당시 황해도 관찰사를 지냈다.',
    relationToHyegyong: '모친',
  },
  'person-031': {
    name: '빙애(경빈 박씨)',
    biography:
      '사도세자의 후궁(박씨)으로 경빈 칭호를 받았다. 인원왕후의 시녀 출신이라 세자가 들이는 데 금기가 있었지만 사도는 부왕의 엄한 반대에도 총애했다. 은전군과 청근옹주를 낳았고, 1761년 사도의 광증 속에 맞아 죽었다.',
  },
  'person-032': {
    name: '효장세자',
    biography: '영조의 첫 세자로 책봉되었으나 열 살에 요절했다.',
  },
  'person-033': {
    name: '사도세자',
    biography:
      '영조와 선희궁 소생. 1744년 혜경궁과 혼인했다. 1736년 세자, 1749년 세자 대리청정에 임했으나 점차 광증과 폭력성이 심화되었다. 1762년 영조의 명으로 뒤주에 갇혀 8일 만에 사망했다.',
  },
  'person-034': {
    name: '은언군',
    biography:
      '사도세자의 아들(임숙빈 소생)로 이름은 인. 천주교 연루 혐의로 박해 과정에서 처형되었다.',
  },
  'person-035': {
    name: '은신군',
    biography:
      '사도세자의 아들(임숙빈 소생)로 이름은 진, 은언군의 동생. 역모 연루 혐의로 1771년 도서 지역에 유배되어 곧 사망했다.',
  },
  'person-036': {
    name: '청선옹주',
    biography: '사도세자와 혜경궁의 둘째 딸. 1766년 흥은군 정재화와 혼인했다.',
    relationToHyegyong: '차녀',
  },
  'person-037': {
    name: '청연옹주',
    biography: '사도세자와 혜경궁의 첫째 딸. 1764년 김기성과 혼인했다.',
    relationToHyegyong: '장녀',
  },
  'person-038': {
    name: '화협옹주',
    biography: '영조의 일곱째 딸(선희궁 소생). 홍역으로 사망했다.',
  },
  'person-039': {
    name: '화평옹주',
    biography: '영조의 셋째 딸(선희궁 소생). 영조의 총애를 받았으나 난산으로 사망했다.',
  },
  'person-040': {
    name: '화순옹주',
    biography: '영조의 둘째 딸(이정빈 소생). 남편 사후 스스로 단식해 생을 마쳤다.',
  },
  'person-041': {
    name: '화완옹주',
    biography:
      '영조가 총애한 딸. 정치달과 혼인했으나 일찍 과부가 되었고, 영조 생전 궁중에서 큰 영향력을 행사했다. 정조 즉위 후 출궁했으며, 1778년 작호와 특권을 박탈당하고 강화도로 유배되었다. 1782년에는 도성 인근으로 이주가 허용되었다.',
  },
  'person-042': {
    name: '정성왕후',
    biography: '영조의 첫 왕비로 서종제의 딸. 남편과 소원했고 자녀가 없었다.',
  },
  'person-043': {
    name: '정순왕후',
    biography:
      '김한구의 딸이자 영조의 계비. 1759년 가례가 거행되었다. 1800-1804년에는 어린 순조를 대신해 수렴청정을 했고, 이 시기 혜경궁 가문은 큰 피해를 입었다. 정순왕후의 가문은 홍가와 첨예하게 대립했다.',
    relationToHyegyong: '수렴청정기 혜경궁 가문 탄압과 직결된 인물',
  },
  'person-044': {
    name: '인원왕후',
    biography: '숙종의 세 번째 왕비로 김주신의 딸. 영조가 이 계모에게 각별히 효성했다는 전승이 있다.',
  },
  'person-045': {
    name: '효순왕후',
    biography:
      '효장세자의 빈이자 조문명의 딸. 양자 정조가 1776년 즉위하면서 사후 왕후로 추존되었다.',
  },
  'person-046': {
    name: '효의왕후',
    biography: '1762년 정조와 혼인했으며 김시묵의 딸이다.',
  },
};

export const KO_EVENT: Record<string, KoEventEntry> = {
  'evt-1735-birth-hyegyong': {
    title: '혜경궁 홍씨의 탄생',
    summary: '혜경궁은 회고록에서 개평동 출생을 밝히며 자신의 생애 연대기를 시작한다.',
  },
  'evt-1744-marriage': {
    title: '혜경궁의 간택과 입궁',
    summary: '혜경궁이 사도세자의 빈으로 간택되어 궁중 생활에 들어간다.',
  },
  'evt-1752-birth-jeongjo': {
    title: '정조의 탄생',
    summary: '사도세자와 혜경궁 사이에서 아들이 태어나 훗날 정조로 즉위한다.',
  },
  'evt-1757-double-loss': {
    title: '정성왕후와 인원왕후의 연이은 승하',
    summary: '궁중의 핵심 원로 여성 두 인물이 잇달아 세상을 떠나 조정의 불안정성이 심화된다.',
  },
  'evt-1761-pingae-killed': {
    title: '사도의 폭력 국면에서 빙애 피살',
    summary: '사도가 총애하던 후궁 빙애가 궁중 혼란이 격화되는 과정에서 살해된다.',
  },
  'evt-1762-imo-tragedy': {
    title: '임오년 비극(사도세자 사망)',
    summary: '사도가 뒤주에 갇혀 사망하고, 회고록 전체를 관통하는 왕실의 단절이 발생한다.',
  },
  'evt-1776-jeongjo-accession': {
    title: '정조 즉위',
    summary: '영조 승하 뒤 정조가 즉위하며 파벌 구도와 권력 균형이 재편된다.',
  },
  'evt-1789-reinterment': {
    title: '사도세자의 현륭원 이장',
    summary: '정조가 사도세자의 묘를 옮기며 대규모 효 정치 프로젝트를 시작한다.',
  },
  'evt-1795-hwaseong-visit': {
    title: '1795년 화성 행차와 공적 효 의례',
    summary: '정조가 혜경궁을 모시고 현륭원을 참배하며 대규모 추숭 의례를 거행한다.',
  },
  'evt-1800-jeongjo-death': {
    title: '정조 승하와 순조 즉위',
    summary: '정조의 갑작스런 죽음으로 수렴청정 국면이 열리고 후기 회고록의 위기 서사가 강화된다.',
  },
  'evt-1801-execution-hong-nagim': {
    title: '홍낙임 처형',
    summary: '혜경궁의 셋째 오라버니가 처형되며 1802년 회고록의 비탄적 정조가 강화된다.',
  },
  'evt-1802-memoir': {
    title: '1802년 회고록 집필',
    summary: '혜경궁이 순조와 후대를 위해 자신의 증언을 기록해 보전하고자 한다.',
  },
  'evt-1805-memoir': {
    title: '1805년 회고록 완성',
    summary: '혜경궁의 마지막 회고록이 완성되어 1762년 사건의 총체적 서술이 제시된다.',
  },
  'evt-1759-queen-chongsun-marriage': {
    title: '정순왕후 가례',
    summary: '영조와 정순왕후의 혼인이 후기 궁중 친족 권력 구도 재편의 계기가 된다.',
  },
  'evt-1775-regency-opposition': {
    title: '정조 대리청정 반대',
    summary: '홍인한의 반대는 즉위 직전 권력 이행기의 고위험 충돌을 보여준다.',
  },
  'evt-1778-hwawan-banishment': {
    title: '화완옹주 작호 박탈 및 유배',
    summary: '정조가 화완옹주의 작호를 박탈하고 강화도로 유배 보낸다.',
  },
  'evt-1781-hong-kugyeong-fall': {
    title: '홍국영 실각',
    summary: '정조 초반 권력을 장악했던 홍국영이 몰락해 유배로 생을 마감한다.',
  },
  'evt-1784-kim-kwiju-relocation': {
    title: '김귀주의 나주 이주 허용',
    summary: '유배 중이던 김귀주가 나주 정착을 허락받고 그곳에서 병사한다.',
  },
  'evt-1800-1804-dowager-regency': {
    title: '정순왕후 수렴청정(1800-1804)',
    summary: '순조의 미성년기 동안 정순왕후가 정국을 주도하며 후기 회고록의 피해 서사가 심화된다.',
  },
  'evt-1801-catholic-persecutions': {
    title: '1801년 천주교 박해 관련 처형',
    summary: '홍낙임과 은언군 등이 겹치는 박해 국면에서 처형된다.',
  },
};

export const KO_RELATION_SUMMARY: Record<string, string> = {
  'rel-person-022-person-033-spouse': '이 혼인은 홍씨 가문과 왕실 직계 혈통을 결속한 핵심 왕실 연계였다.',
  'rel-person-022-person-019-mother-son': '혜경궁의 아들 정조는 그녀의 정치적·개인적 생존의 중심축이었다.',
  'rel-person-022-person-020-grandmother-grandson': '후기 회고록은 순조에게 보내는 왕실 증언의 형식을 분명히 띤다.',
  'rel-person-022-person-011-daughter-father': '혜경궁은 자신의 삶을 부친과의 효 윤리 관계 속에서 반복적으로 서술한다.',
  'rel-person-022-person-030-daughter-mother': '모친의 죽음은 혜경궁 서사에서 감정적·구조적 전환점이 된다.',
  'rel-person-033-person-021-son-father': '부자 간 단절은 임오년 비극을 추동한 핵심 축이다.',
  'rel-person-033-person-025-son-mother': '선희궁은 사도 시기 궁중 사건에서 중요한 모친이자 궁중 인물로 기능한다.',
  'rel-person-019-person-021-grandson-grandfather': '정조의 계승은 조부 영조의 궁중 판단과 인사 구조에 크게 규정되었다.',
  'rel-person-019-person-046-spouse': '정조의 왕비인 효의왕후는 계승과 궁중 질서의 맥락에서 등장한다.',
  'rel-person-019-person-023-consort': '가순궁은 순조를 낳아 후기 왕통의 연속성을 이루는 핵심 인물이 된다.',
  'rel-person-020-person-023-son-mother': '순조의 외척·모계 라인은 미성년 통치기 권력 배분에서 중요해진다.',
  'rel-person-020-person-043-regency': '정순왕후는 순조의 어린 시기 대비 수렴청정으로 정국을 주도했다.',
  'rel-person-043-person-017-siblings': '김귀주의 정치 활동은 정순왕후 친족 네트워크와 직결되어 있었다.',
  'rel-person-041-person-001-adoptive-mother-son': '정후겸의 권력 상승은 화완옹주의 궁중 위상에 힘입은 측면이 컸다.',
  'rel-person-011-person-007-father-son': '홍낙임은 혜경궁의 셋째 오라버니로 후기 회고록 정치에서 핵심 인물이다.',
  'rel-person-022-person-007-siblings': '1801년 홍낙임의 처형은 후기 회고록의 핵심 상흔으로 남는다.',
  'rel-person-022-person-043-political-rivals': '혜경궁은 수렴청정기를 가문 탄압이 심화된 시기로 프레이밍한다.',
  'rel-person-011-person-019-protector': '홍봉한은 1762년 이후 정조를 보호하는 인물로 제시된다.',
  'rel-person-006-person-019-confidant': '홍국영은 정조 즉위 초기 왕권 강화를 돕다가 결국 실각했다.',
  'rel-person-013-person-006-political-collaborators': '김종수는 홍국영과 협력했다가 실각 국면에서 그를 이탈했다.',
  'rel-person-017-person-011-political-rivals': '김-홍 대립은 회고록 전체를 관통하는 반복적 정치 축이다.',
};

export const KO_PLACE: Record<string, KoPlaceEntry> = {
  'pl-changdeok': {
    name: '창덕궁',
    summary: '회고록의 다수 내명부 사건이 전개되는 조선 궁중의 핵심 무대.',
    modern: '서울',
  },
  'pl-changgyeong': {
    name: '창경궁',
    summary: '왕실 생활공간·상례 공간·정치적 긴장이 중첩되는 빈번한 배경.',
    modern: '서울',
  },
  'pl-choseung-pavilion': {
    name: '저승전(처승전)',
    summary: '사도세자의 초기 거처로, 1805년 회고록에서 형성기 공간으로 제시된다.',
    modern: '궁궐 권역(역사 지점)',
  },
  'pl-hyeollyung': {
    name: '현륭원',
    summary: '사도세자 이장지로 정조의 효·추숭 정치의 핵심 거점.',
    modern: '수원',
  },
  'pl-hwaseong': {
    name: '화성',
    summary: '정조가 조성한 기념도시이자 사도세자 추숭 정치와 결합한 공간 프로젝트.',
    modern: '수원',
  },
  'pl-kopyeong': {
    name: '개평동',
    summary: '1795년 회고록 서두에서 제시되는 혜경궁의 출생지.',
    modern: '서울(옛 지명 권역)',
  },
  'pl-kanghwa': {
    name: '강화도',
    summary: '18세기 후반 왕실·조정 처벌 정치에서 반복적으로 쓰인 유배지.',
    modern: '인천권',
  },
  'pl-naju': {
    name: '나주',
    summary: '유배 후 통제된 정착 처분에 활용된 남서부 지역 거점.',
    modern: '전라남도',
  },
  'pl-huksan': {
    name: '흑산도',
    summary: '중죄 정치범에게 적용된 원격 도서 유배지.',
    modern: '서남해안 권역',
  },
};

export const KO_GLOSSARY: Record<string, KoGlossaryEntry> = {
  'imo-year': {
    term: '임오년(1762)',
    aliases: ['임오년', '임오화변'],
    category: '정치',
    definition:
      '사도세자가 죽은 전환의 해. 혜경궁 회고록에서 이후 모든 증언의 배경을 규정하는 왕실 단절의 원점으로 기능한다.',
  },
  'rice-chest': {
    term: '뒤주',
    aliases: ['뒤주', '쌀뒤주'],
    category: '정치',
    definition:
      '1762년 사도세자가 갇힌 용기. 후기 회고록 논쟁에서 물리적 사물인 동시에 정치적 기호로 작동한다.',
  },
  'crown-prince': {
    term: '왕세자',
    aliases: ['세자'],
    category: '궁중',
    definition:
      '공식적 왕위 계승자. 이 자료군에서는 세자 지위가 파벌 정렬, 감시, 내전 갈등을 좌우하는 핵심 요인이다.',
  },
  'prince-regent': {
    term: '세자 대리청정',
    aliases: ['대리청정'],
    category: '궁중',
    definition:
      '즉위 전 세자가 국정을 대행하는 체제. 사도세자가 1762년 비극 이전 이 역할을 수행했다.',
  },
  'dowager-regency': {
    term: '대비 수렴청정',
    aliases: ['수렴청정'],
    category: '정치',
    definition:
      '어린 임금 재위기에 대비가 정국을 주도하는 통치 형태. 1800-1804년 정순왕후 수렴청정은 후기 회고록 원한 서사의 중심이다.',
  },
  'inner-court': {
    term: '내명부/궁중 내부',
    aliases: ['내전', '궁중 내부'],
    category: '궁중',
    definition:
      '궁중의 가사·젠더 공간. 이곳의 친족 질서와 접근성은 공식 관료제 못지않게 정치 결과를 좌우했다.',
  },
  'secondary-consort': {
    term: '후궁',
    aliases: ['빈', '궁주'],
    category: '궁중',
    definition:
      '왕비 아래 위계의 왕실 배우자. 계승 문제에 큰 영향을 미치며 회고록 핵심 인물 다수가 여기에 속한다.',
  },
  'filial-piety': {
    term: '효(孝)',
    aliases: ['효', '효성'],
    category: '사회',
    definition: '부모·선조에 대한 유교적 의무. 혜경궁의 서사 윤리와 정조의 추숭 정치 모두를 관통하는 핵심 가치다.',
  },
  'posthumous-honor': {
    term: '추존/사후 존호',
    aliases: ['추존', '사후 시호'],
    category: '의례',
    definition:
      '사후에 부여되는 칭호와 예우. 회고록에서는 기억 정치와 정통성 경쟁을 조정하는 핵심 도구로 나타난다.',
  },
  'civil-examination': {
    term: '과거(문과)',
    aliases: ['과거', '문과'],
    category: '정치',
    definition: '관료 진출의 제도적 통로. 가문의 상승, 파벌 편입, 신분 정당화가 과거 합격과 긴밀히 연결된다.',
  },
  'state-council': {
    term: '의정부',
    aliases: ['의정부', '삼정승 체제'],
    category: '정치',
    definition: '조선 최고 행정기구. 이 영역의 임면은 고위 파벌 권력 이동을 가장 선명하게 보여준다.',
  },
  memorial: {
    term: '상소/계문',
    aliases: ['상소', '계문'],
    category: '문헌',
    definition:
      '국왕에게 올리는 공식 문서. 회고록 맥락에서는 고발·변론·사후 정당화의 정치적 무기로 기능한다.',
  },
  yangban: {
    term: '양반',
    aliases: ['양반'],
    category: '사회',
    definition: '조선의 세습 지배 신분층. 혜경궁 친정 가문의 정체성과 의무는 양반 질서를 통해 규정된다.',
  },
  hwaseong: {
    term: '화성',
    aliases: ['화성', '수원화성'],
    category: '공간',
    definition: '정조 시기 조성된 성곽도시. 사도세자 추숭과 효 정치의 공간적 실험이 집약된 상징이다.',
  },
  hyeollyung: {
    term: '현륭원',
    aliases: ['현륭원'],
    category: '공간',
    definition: '사도세자 이장지. 회고록에서 왕실 추모와 의례 국가정치의 결절점으로 반복된다.',
  },
  joseon: {
    term: '조선 왕조',
    aliases: ['조선'],
    category: '정치',
    definition:
      '1392-1897년의 한국 왕조 국가. 혜경궁 회고록은 조선 후기 왕위 계승 위기와 붕당 정치의 격랑 속에 위치한다.',
  },
};

export const KO_PREDICATE_LABELS: Record<string, string> = {
  biography: '인물 서술',
  'office-term': '관직/직함',
  'event-summary': '사건 요약',
  spouse: '부부 관계',
  'mother-son': '모자 관계',
  'grandmother-grandson': '조모-손자 관계',
  'daughter-father': '부녀 관계',
  'daughter-mother': '모녀 관계',
  'son-father': '부자 관계',
  'son-mother': '모자 관계',
  'grandson-grandfather': '손자-조부 관계',
  consort: '군주-후궁 관계',
  regency: '수렴청정 관계',
  siblings: '형제자매 관계',
  'adoptive-mother-son': '양모-양자 관계',
  'father-son': '부자 관계',
  'political-rivals': '정적 관계',
  protector: '보호자 관계',
  confidant: '최측근 관계',
  'political-collaborators': '정치 협력 관계',
};
