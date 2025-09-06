# GitHub 업로드 명령어

## 1단계: GitHub Repository 생성 후

아래 명령어를 터미널에 복사해서 실행하세요.
**중요: YOUR_USERNAME을 본인 GitHub 아이디로 변경하세요!**

```bash
# GitHub 저장소 연결 (YOUR_USERNAME을 변경!)
git remote add origin https://github.com/YOUR_USERNAME/naver-shopping-analyzer.git

# 메인 브랜치로 설정
git branch -M main

# 코드 푸시
git push -u origin main
```

## 2단계: GitHub 인증

푸시할 때 인증 정보를 물어볼 수 있습니다:

### 방법 1: 사용자명/비밀번호
- Username: GitHub 아이디
- Password: GitHub 비밀번호 또는 Personal Access Token

### 방법 2: Personal Access Token (권장)
1. GitHub → Settings → Developer settings → Personal access tokens
2. Generate new token (classic)
3. repo 체크박스 선택
4. Generate token
5. 생성된 토큰을 비밀번호 대신 사용

## 3단계: 확인
GitHub에서 본인 Repository 페이지로 가서 코드가 업로드되었는지 확인!

## 문제 해결

### "remote origin already exists" 에러가 날 때:
```bash
git remote remove origin
git remote add origin https://github.com/YOUR_USERNAME/naver-shopping-analyzer.git
```

### "src refspec main does not match any" 에러가 날 때:
```bash
git branch -M main
git push -u origin main
```

### Permission denied 에러가 날 때:
Personal Access Token을 생성해서 비밀번호 대신 사용하세요.