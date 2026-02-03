#!/bin/bash

# Proof Server Startup Script for Midnight DEX Contract
# Starts proof server using Docker

# Check if proof-server is already running on port 6300
if lsof -Pi :6300 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "✅ Proof server is already running on port 6300"
    exit 0
fi

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed!"
    echo "Please install Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

echo "Starting proof server using Docker..."

# Create logs directory if it doesn't exist
mkdir -p logs

# Stop and remove existing container if it exists
docker stop midnight-proof-server 2>/dev/null || true
docker rm midnight-proof-server 2>/dev/null || true

# Start proof server container
docker run -d \
  --name midnight-proof-server \
  -p 6300:6300 \
  midnightnetwork/proof-server:6.1.0-alpha.6 \
  -- midnight-proof-server --network preview \
  > logs/proof-server-docker.log 2>&1

# Give it 3 seconds to start
sleep 3

# Check if it started successfully
if lsof -Pi :6300 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "✅ Proof server started successfully on port 6300 (Docker)"
    echo "📝 View logs: docker logs midnight-proof-server"
    echo "🛑 To stop: docker stop midnight-proof-server"
    exit 0
else
    echo "❌ Failed to start proof server"
    echo "📝 Check: docker logs midnight-proof-server"
    docker logs midnight-proof-server 2>&1 | tail -20
    exit 1
fi
