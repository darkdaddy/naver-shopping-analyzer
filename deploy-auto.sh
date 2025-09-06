#!/bin/bash

echo "🚀 Vercel 자동 배포 스크립트"
echo "=================================="

# 색상 정의
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# 프로젝트 이름 설정
PROJECT_NAME="naver-shopping-analyzer"

# 1. 빌드 체크
echo -e "${YELLOW}📦 빌드 테스트...${NC}"
npm run build > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ 빌드 실패!${NC}"
    npm run build
    exit 1
fi
echo -e "${GREEN}✅ 빌드 성공${NC}"

# 2. 환경변수 파일 생성 (Vercel용)
echo -e "${YELLOW}🔐 환경변수 설정...${NC}"
if [ -f .env.local ]; then
    # .env.local에서 환경변수 읽기
    source .env.local
    
    # Vercel 환경변수 설정 파일 생성
    cat > .vercel.env << EOF
NAVER_CLIENT_ID=${NAVER_CLIENT_ID}
NAVER_CLIENT_SECRET=${NAVER_CLIENT_SECRET}
EOF
    echo -e "${GREEN}✅ 환경변수 준비 완료${NC}"
else
    echo -e "${RED}⚠️  .env.local 파일이 없습니다. 배포 후 Vercel 대시보드에서 설정하세요.${NC}"
fi

# 3. Vercel 배포 (무인 모드)
echo -e "${YELLOW}🚀 Vercel 배포 중...${NC}"

# 프로젝트가 이미 연결되어 있는지 확인
if [ -d ".vercel" ]; then
    # 이미 연결된 경우 바로 배포
    echo "기존 프로젝트에 배포합니다..."
    vercel --prod --yes
else
    # 새 프로젝트 생성 및 배포
    echo "새 프로젝트를 생성합니다..."
    vercel --prod --yes --name $PROJECT_NAME
fi

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✨ 배포 완료!${NC}"
    echo "=================================="
    
    # 배포 URL 가져오기
    DEPLOY_URL=$(vercel ls --json 2>/dev/null | grep -o '"url":"[^"]*' | head -1 | cut -d'"' -f4)
    
    if [ ! -z "$DEPLOY_URL" ]; then
        echo -e "🌐 배포 URL: ${GREEN}https://${DEPLOY_URL}${NC}"
    else
        echo "🌐 Vercel 대시보드에서 URL을 확인하세요"
    fi
    
    echo ""
    echo "📝 다음 단계:"
    echo "1. https://vercel.com 접속"
    echo "2. 프로젝트 설정에서 환경변수 확인"
    echo "3. 도메인 설정 (선택사항)"
    
    # 임시 환경변수 파일 삭제
    rm -f .vercel.env
else
    echo -e "${RED}❌ 배포 실패${NC}"
    rm -f .vercel.env
    exit 1
fi