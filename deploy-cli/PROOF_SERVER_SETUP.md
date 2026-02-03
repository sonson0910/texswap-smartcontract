# Proof Server Setup Guide

## Problem
The wallet sync requires a local proof server running on `http://127.0.0.1:6300`  but it's not currently running.

## Solution Options

### Option 1: Install via compact-cli (Recommended)

The proof server is typically included with the Compact toolchain:

```bash
# If you haven't installed Compact yet:
curl -fsSL https://install.midnight.network | sh

# Add to PATH (if not already done)
export PATH="$HOME/.compact/bin:$PATH"

# Start proof server
proof-server --port 6300 &
```

### Option 2: Use Docker

```bash
# Pull and run proof server in Docker
docker run -d -p 6300:6300 --name midnight-proof-server \
  ghcr.io/midnight-ntwrk/proof-server:latest
```

### Option 3: Use Midnight's hosted proof server (Not recommended for production)

Change the proof server URL in `src/config.ts`:

```typescript
// In PreviewConfig class, change:
proofServer = 'https://prover.preview.midnight.network';
```

**Note**: Using a remote proof server will be slower than running locally.

## Verify Proof Server is Running

After starting the proof server, test the connection:

```bash
cd /media/son/Projects1/venera/midnight/tutorial/learn_build/exp2/midnight-dex-contract/deploy-cli
npx tsx src/test-connection.ts
```

You should see:
```
✅ Proof Server (Health)
✅ Proof Server (Check)
```

## Start Proof Server Automatically

Create a helper script to start the proof server:

**File**: `/media/son/Projects1/venera/midnight/tutorial/learn_build/exp2/midnight-dex-contract/deploy-cli/start-proof-server.sh`

```bash
#!/bin/bash

# Check if proof-server is already running
if lsof -Pi :6300 -sTCP:LISTEN -t >/dev/null ; then
    echo "✅ Proof server is already running on port 6300"
    exit 0
fi

# Try to start proof-server
if command -v proof-server &> /dev/null; then
    echo "Starting proof server on port 6300..."
    nohup proof-server --port 6300 > logs/proof-server.log 2>&1 &
    sleep 2
    
    if lsof -Pi :6300 -sTCP:LISTEN -t >/dev/null ; then
        echo "✅ Proof server started successfully"
    else
        echo "❌ Failed to start proof server. Check logs/proof-server.log"
        exit 1
    fi
else
    echo "❌ proof-server command not found!"
    echo "Please install Compact toolchain: curl -fsSL https://install.midnight.network | sh"
    exit 1
fi
```

Make it executable:
```bash
chmod +x start-proof-server.sh
```

## Next Steps

1. Install/start the proof server using one of the options above
2. Run `npx tsx src/test-connection.ts` to verify all connections
3. Try running your contract interactions again:
   ```bash
   npx tsx src/interact.ts status
   npx tsx src/interact.ts add 100000 100000 100000
   ```

## Troubleshooting

If the proof server fails to start:

1. **Check if port 6300 is already in use:**
   ```bash
   lsof -i :6300
   ```

2. **Check proof server logs:**
   ```bash
   cat logs/proof-server.log
   ```

3. **Try a different port:**
   Edit `src/config.ts` and change port 6300 to another port (e.g., 6301)
