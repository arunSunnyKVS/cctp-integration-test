#!/bin/bash

# Set up environment variables for Anchor
export ANCHOR_PROVIDER_URL="https://api.devnet.solana.com"
export ANCHOR_WALLET="$HOME/.config/solana/id.json"

# Test RPC connection first
echo "🔗 Testing RPC connection..."
if curl -s --max-time 10 "https://api.devnet.solana.com" > /dev/null; then
    echo "✅ RPC connection successful"
else
    echo "❌ RPC connection failed, trying alternative endpoint..."
    export ANCHOR_PROVIDER_URL="https://devnet.solana.com"
    if curl -s --max-time 10 "https://devnet.solana.com" > /dev/null; then
        echo "✅ Alternative RPC connection successful"
    else
        echo "❌ All RPC endpoints failed"
        echo "💡 Please check your internet connection"
        exit 1
    fi
fi

echo "🚀 Setting up environment for CCTP test..."
echo "📡 Using Solana Devnet: $ANCHOR_PROVIDER_URL"
echo "👛 Using wallet: $ANCHOR_WALLET"

# Check if wallet exists
if [ ! -f "$HOME/.config/solana/id.json" ]; then
    echo "❌ Wallet not found at $HOME/.config/solana/id.json"
    echo "💡 Please create a wallet first:"
    echo "   solana-keygen new"
    exit 1
fi

# Check wallet balance
echo "💰 Checking wallet balance..."
BALANCE=$(solana balance)
echo "✅ Wallet balance: $BALANCE"

echo "✅ Wallet found, running test..."

# Run the test script
npx ts-node testDeposit.ts 