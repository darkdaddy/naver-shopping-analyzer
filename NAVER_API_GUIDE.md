# 네이버 API 키 설정 가이드

## 1. 네이버 개발자 센터에서 키 받기
1. https://developers.naver.com 접속
2. 네이버 아이디로 로그인
3. Application → 애플리케이션 등록
4. 이름: 아무거나 (예: 네이버 쇼핑 분석기)
5. 사용 API: "검색 - 쇼핑" 체크
6. WEB 설정에 `http://localhost:3000` 입력
7. 등록하기 클릭

## 2. 받은 키를 .env.local 파일에 입력
```
NAVER_CLIENT_ID=여기에_Client_ID_붙여넣기
NAVER_CLIENT_SECRET=여기에_Client_Secret_붙여넣기
```

## 3. 주의사항
- Client ID와 Secret은 절대 공개하면 안됨
- GitHub에 올릴 때 .env.local 파일은 자동으로 제외됨
- 키는 안전하게 보관하세요

## 4. 테스트
- 키를 입력한 후 서버를 재시작해야 적용됨
- Ctrl+C로 서버 중지 → npm run dev로 다시 시작