# 네이버 쇼핑 카테고리 분석기

네이버 쇼핑에서 검색어별 우선 노출 카테고리를 분석하고, 효과적인 상품명을 생성하는 도구입니다.

## 주요 기능

### 1. 단일 검색 분석
- 특정 검색어의 카테고리 분포 분석
- 상위 노출 카테고리 식별
- 카테고리별 상품 상세 보기

### 2. 다중 키워드 분석
- 최대 100개 키워드 동시 분석
- 실시간 진행률 표시
- 키워드-카테고리 매트릭스 뷰
- CSV 다운로드 기능

### 3. 상품명 생성
- **기본 모드**: 입력 키워드로 상품명 생성
- **고급 모드**: 연관검색어 활용한 상품명 생성
- 20-50자 최적화
- 카테고리별 키워드 조합

## 기술 스택

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript
- **Styling**: Tailwind CSS
- **API**: 네이버 쇼핑 검색 API
- **Deployment**: Vercel

## 설치 및 실행

### 환경 설정
`.env.local` 파일 생성:
```
NAVER_CLIENT_ID=your_naver_client_id
NAVER_CLIENT_SECRET=your_naver_client_secret
```

### 개발 서버 실행
```bash
npm install
npm run dev
```

### 프로덕션 빌드
```bash
npm run build
npm start
```

## 사용 방법

1. **단일 검색**: 메인 페이지에서 검색어 입력
2. **다중 검색**: /batch 페이지에서 여러 키워드 입력
3. **상품명 생성**: 
   - 분석 완료 후 "상품명 생성" 클릭
   - 고급 모드는 연관검색어까지 활용

## 배포

Vercel을 통한 자동 배포 지원

## 라이선스

Private
