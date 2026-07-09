# 초블8기 미션 웹사이트

초강스블로그 8기 미션 제출/관리용 웹앱입니다.

## 주요 기능

- 주1회반/주2회반 명단 선택 후 이름과 핸드폰 번호로 접속
- 주1회반은 1~5주차, 주2회반은 1~9회차별 미션1, 미션2 제출
- 미션1: 블로그 주소 제출
- 미션2: 체류1분이상, 좋아요, 서이추, 비밀댓글 체크
- 시험기간 긴급 블로그글: 주1회반/주2회반 공통 블로그 주소 제출
- 같은 회차 같은 미션 중복 제출 방지
- 마스터 대시보드에서 전체 제출, 성공 횟수, 지각 제출 확인
- 로그인한 반의 블로그 방문 링크만 볼 수 있는 페이지 제공
- 마스터 초기화 버튼으로 새 기수/새 주기 시작

## 로컬 실행

```bash
npm start
```

기본 주소는 `http://localhost:3000`입니다.

이 PC에서 기본 `node` 권한 문제가 나면 PowerShell에서 아래처럼 실행합니다.

```powershell
.\start.ps1
```

기본 주소는 `http://localhost:3001`입니다. 다른 포트로 켜려면 `.\start.ps1 -Port 3002`처럼 입력합니다.

## 마스터 코드

로컬 기본값은 `cho7-master`입니다.

배포할 때는 반드시 환경변수로 바꾸세요.

```bash
MASTER_CODE=원하는코드 npm start
```

## Render 배포

이 저장소에는 Render Blueprint용 `render.yaml`이 포함되어 있습니다.

Render에서 Blueprint로 연결하면 다음 값이 사용됩니다.

- Runtime: Node
- Build Command: `npm install`
- Start Command: `npm start`
- Health Check: `/api/health`
- 데이터 저장 경로: `/opt/render/project/src/data`

`MASTER_CODE`는 Render Dashboard에서 직접 입력하도록 `sync: false`로 설정했습니다.

현재 `render.yaml`은 Free Web Service 기준입니다. 제출 데이터는 파일로 저장되므로 무료 플랜에서는 재시작/재배포 때 데이터가 사라질 수 있습니다. 장기 운영에서 데이터 보존이 중요하면 유료 Web Service와 Persistent Disk 설정으로 전환하세요.

## 외부 임시 접속

Cloudflare 임시 터널로 공유하려면 PowerShell에서 실행합니다.

```powershell
.\start-public.ps1
```

임시 공개 주소는 PC와 터널 프로그램이 켜져 있는 동안만 유지됩니다.

## 저장 데이터

제출 데이터는 `data/db.json`에 저장됩니다. GitHub에는 실제 제출 데이터, 마스터 코드, 임시 공개 URL, 터널 실행 파일이 올라가지 않도록 `.gitignore`에 제외했습니다.
