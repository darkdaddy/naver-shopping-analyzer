#!/bin/bash

echo "🚀 네이버 쇼핑 분석기 Vercel 배포 시작"
echo "=================================="

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. 빌드 테스트
echo -e "${YELLOW}📦 빌드 테스트 중...${NC}"
npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ 빌드 실패! 오류를 수정하세요.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ 빌드 성공${NC}"

# 2. 환경변수 확인
echo -e "${YELLOW}🔐 환경변수 설정 확인${NC}"
if [ ! -f .env.local ]; then
    echo -e "${RED}❌ .env.local 파일이 없습니다!${NC}"
    echo "다음 내용으로 .env.local 파일을 생성하세요:"
    echo "NAVER_CLIENT_ID=your_client_id"
    echo "NAVER_CLIENT_SECRET=your_client_secret"
    exit 1
fi

# 3. Vercel 배포
echo -e "${YELLOW}🎯 Vercel 배포 시작${NC}"
echo "처음 배포하는 경우 프로젝트 설정이 필요합니다."
echo ""

# Vercel 배포 실행
vercel --prod

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 배포 완료!${NC}"
    echo ""
    echo "🎉 배포가 성공적으로 완료되었습니다!"
    echo "=================================="
    echo "다음 단계:"
    echo "1. Vercel 대시보드에서 환경변수 설정"
    echo "   - NAVER_CLIENT_ID"
    echo "   - NAVER_CLIENT_SECRET"
    echo "2. 배포된 URL 확인"
else
    echo -e "${RED}❌ 배포 실패${NC}"
    exit 1
fi