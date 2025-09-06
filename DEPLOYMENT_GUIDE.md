# 🚀 Vercel 배포 가이드 (초보자용)

## 준비사항
1. GitHub 계정 (없으면 github.com에서 무료로 생성)
2. Vercel 계정 (없으면 vercel.com에서 무료로 생성)

## Step 1: GitHub에 코드 업로드

### 1-1. GitHub 저장소 생성
1. https://github.com 로그인
2. 우측 상단 **+** 버튼 클릭 → **New repository**
3. Repository 이름: `naver-shopping-analyzer`
4. Public 선택 (무료)
5. **Create repository** 클릭

### 1-2. 코드 업로드
터미널에서 아래 명령어를 순서대로 실행:

```bash
# 1. Git 초기화 (이미 완료됨)
git init

# 2. 모든 파일 추가
git add .

# 3. 첫 커밋
git commit -m "Initial commit: 네이버 쇼핑 카테고리 분석기"

# 4. GitHub 저장소 연결 (YOUR_GITHUB_USERNAME을 본인 것으로 변경!)
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/naver-shopping-analyzer.git

# 5. 코드 푸시
git branch -M main
git push -u origin main
```

GitHub 사용자명과 비밀번호를 입력하라고 나오면 입력하세요.

## Step 2: Vercel 배포

### 2-1. Vercel 계정 생성
1. https://vercel.com 접속
2. **Sign Up** 클릭
3. **Continue with GitHub** 선택 (GitHub 계정으로 로그인)

### 2-2. 프로젝트 배포
1. Vercel 대시보드에서 **Add New...** → **Project** 클릭
2. **Import Git Repository** 섹션에서 방금 만든 `naver-shopping-analyzer` 선택
3. **Import** 클릭

### 2-3. 환경변수 설정 (중요!)
Configure Project 화면에서:

1. **Environment Variables** 섹션 찾기
2. 아래 변수들 추가:
   - Name: `NAVER_CLIENT_ID`
   - Value: `Imy1MU3qrOLNpSsPbOH4` (본인 API 키)
   - **Add** 클릭
   
3. 또 하나 추가:
   - Name: `NAVER_CLIENT_SECRET`
   - Value: `xqKMlkoegb` (본인 API Secret)
   - **Add** 클릭

### 2-4. 배포 시작
1. **Deploy** 버튼 클릭
2. 2-3분 기다리면 배포 완료!

## Step 3: 배포 확인

### 3-1. 사이트 접속
배포 완료되면:
1. **Visit** 버튼 클릭
2. 또는 `https://naver-shopping-analyzer.vercel.app` 형태의 URL로 접속

### 3-2. 기능 테스트
1. 검색어 입력 (예: "접착제")
2. 분석하기 클릭
3. 결과 확인

## 🔧 문제 해결

### API 키 오류가 날 때
1. Vercel 대시보드 → Settings → Environment Variables
2. API 키가 제대로 입력되었는지 확인
3. **Redeploy** 클릭

### 빌드 에러가 날 때
1. Vercel 대시보드에서 에러 로그 확인
2. 보통 TypeScript 에러나 import 에러
3. 로컬에서 `npm run build` 실행해서 테스트

## 📝 추가 설정 (선택사항)

### 커스텀 도메인 연결
1. Vercel 대시보드 → Settings → Domains
2. 본인 도메인 입력
3. DNS 설정 안내 따라하기

### 자동 배포 설정
GitHub에 코드 푸시하면 자동으로 재배포됨!
```bash
git add .
git commit -m "Update: 새 기능 추가"
git push
```

## 🎉 완료!
이제 당신의 웹사이트가 전 세계에서 접속 가능합니다!
무료 플랜으로도 충분히 사용 가능합니다.

URL 공유: `https://[your-project-name].vercel.app`