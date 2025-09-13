#!/bin/bash

# Wave Function Collapse Development Server Script
# Handles server lifecycle more robustly

echo "🎮 Wave Function Collapse Development Server"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if port is in use
check_port() {
    if lsof -Pi :8000 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${RED}❌ Port 8000 is already in use${NC}"
        return 1
    else
        echo -e "${GREEN}✅ Port 8000 is available${NC}"
        return 0
    fi
}

# Function to kill existing processes
kill_processes() {
    echo -e "${YELLOW}🔧 Killing existing processes...${NC}"

    # Kill Python HTTP server
    pkill -f "python3 -m http.server" 2>/dev/null && echo "Killed Python HTTP server"

    # Kill any npm dev processes
    pkill -f "npm.*dev" 2>/dev/null && echo "Killed npm dev processes"

    # Kill any node dev processes
    pkill -f "node.*dev" 2>/dev/null && echo "Killed node dev processes"

    # Force kill anything on port 8000
    local pid=$(lsof -ti:8000 2>/dev/null)
    if [ ! -z "$pid" ]; then
        echo "Force killing process $pid on port 8000"
        kill -9 $pid 2>/dev/null
    fi

    sleep 3
    echo -e "${GREEN}✅ Cleanup complete${NC}"
}

# Function to build the project
build_project() {
    echo -e "${BLUE}🔨 Building project...${NC}"
    if npm run build; then
        echo -e "${GREEN}✅ Build successful${NC}"
        return 0
    else
        echo -e "${RED}❌ Build failed${NC}"
        return 1
    fi
}

# Function to start server
start_server() {
    echo -e "${BLUE}🚀 Starting development server...${NC}"
    echo -e "${YELLOW}Server will be available at: http://localhost:8000${NC}"
    echo -e "${YELLOW}Press Ctrl+C to stop the server${NC}"
    echo ""

    cd public && python3 -m http.server 8000
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  start     - Start the development server (default)"
    echo "  build     - Build the project only"
    echo "  clean     - Clean up processes and ports"
    echo "  status    - Check server status"
    echo "  reset     - Full reset (clean + build)"
    echo ""
    echo "Examples:"
    echo "  $0 start    # Start server"
    echo "  $0 clean    # Clean processes"
    echo "  $0 status   # Check status"
}

# Main logic
case "${1:-start}" in
    "start")
        echo -e "${BLUE}🎯 Starting Wave Function Collapse Development Server${NC}"
        echo ""

        # Check port availability
        if ! check_port; then
            echo "Port 8000 is in use. Cleaning up..."
            kill_processes

            # Check again
            if ! check_port; then
                echo -e "${RED}❌ Unable to free port 8000. Please try:${NC}"
                echo "  1. Close other applications using port 8000"
                echo "  2. Run: $0 clean"
                echo "  3. Try a different port: npm run dev:3000"
                exit 1
            fi
        fi

        # Build project
        if ! build_project; then
            exit 1
        fi

        echo ""
        # Start server
        start_server
        ;;

    "build")
        build_project
        ;;

    "clean")
        kill_processes
        check_port
        ;;

    "status")
        if check_port; then
            echo -e "${RED}❌ Server is not running${NC}"
            echo "Run '$0 start' to start the server"
        else
            echo -e "${GREEN}✅ Server is running on port 8000${NC}"
            echo "Visit: http://localhost:8000"
        fi
        ;;

    "reset")
        echo -e "${BLUE}🔄 Full system reset${NC}"
        kill_processes
        build_project
        echo -e "${GREEN}✅ Reset complete. Run '$0 start' to start the server.${NC}"
        ;;

    *)
        show_usage
        exit 1
        ;;
esac
