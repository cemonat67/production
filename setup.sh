#!/usr/bin/env bash
set -e

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}>>> Zero@Ecosystem Setup Script <<<${NC}"

# 1. Check Docker
echo -n "Checking Docker... "
if ! docker info > /dev/null 2>&1; then
  echo -e "${RED}FAILED${NC}"
  echo "Error: Docker Desktop is not running."
  echo "Please start Docker Desktop and try again."
  exit 1
fi
echo -e "${GREEN}OK${NC}"

# 2. Start Supabase
echo -e "\n${GREEN}>>> Starting Supabase...${NC}"
supabase start || true

# 3. Reset Database (Apply Migration)
echo -e "\n${GREEN}>>> Resetting Database & Applying Schema...${NC}"
supabase db reset --no-confirmation

# 4. Import Data
echo -e "\n${GREEN}>>> Importing Seed Data...${NC}"

# Ensure requests is installed
if ! python3 -c "import requests" 2>/dev/null; then
    echo "Installing python requests library..."
    pip3 install requests
fi

export SUPABASE_URL="http://127.0.0.1:54321"
# Retrieve Service Key from supabase status
KEY=$(supabase status --output json | grep -o '"service_role_key": "[^"]*' | grep -o '[^"]*$')
if [ -z "$KEY" ]; then
    # Fallback if json output fails or format changes
    echo "Could not auto-detect Service Key. Using placeholder."
    KEY="YOUR_LOCAL_SERVICE_ROLE_KEY"
fi
export SUPABASE_SERVICE_ROLE_KEY="$KEY"

python3 tools/import_yarns.py

echo -e "\n${GREEN}>>> Setup Complete!${NC}"
echo "1. n8n Workflows are ready to import from ops/n8n/workflows/"
echo "2. Frontend is ready at http://localhost:8087 (run ./start.sh)"
