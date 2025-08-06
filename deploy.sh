#!/bin/bash

echo "Starting deployment process..."

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Check environment variables
if [ -z "$MONGODB_URI" ]; then
    echo "Warning: MONGODB_URI not set"
fi

if [ -z "$PORT" ]; then
    echo "Warning: PORT not set, using default 3000"
    export PORT=3000
fi

# Start the server
echo "Starting server on port $PORT..."
node server.js 