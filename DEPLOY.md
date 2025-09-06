# 배포 가이드

## Vercel 배포 방법

### 1. GitHub 저장소 생성
1. GitHub에서 새 저장소 생성
2. 저장소 이름: `naver-shopping-analyzer`

### 2. 코드 푸시
```bash
git remote add origin https://github.com/YOUR_USERNAME/naver-shopping-analyzer.git
git branch -M main
git push -u origin main
```

### 3. Vercel 배포
1. [Vercel](https://vercel.com) 접속
2. "New Project" 클릭
3. GitHub 저장소 연결
4. 환경변수 설정:
   - `NAVER_CLIENT_ID`: 네이버 API 클라이언트 ID
   - `NAVER_CLIENT_SECRET`: 네이버 API 시크릿
   - `NEXT_PUBLIC_APP_URL`: 배포된 앱 URL

### 4. 배포 확인
- 자동으로 빌드 및 배포 진행
- 배포 URL 확인: `https://your-app.vercel.app`

## 환경변수 설정

Vercel 대시보드에서 Settings > Environment Variables:

```
NAVER_CLIENT_ID=your_naver_client_id
NAVER_CLIENT_SECRET=your_naver_client_secret
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

## 도메인 설정

1. Vercel 대시보드 > Settings > Domains
2. 커스텀 도메인 추가 가능

## 배포 후 테스트

1. 단일 검색 기능 확인
2. 다중 검색 기능 확인
3. 상품명 생성 기능 확인
4. API 연동 확인