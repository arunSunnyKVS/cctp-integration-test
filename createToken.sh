#!/bin/bash
# 2. Create USDC token
USDC_MINT=$(spl-token create-token --decimals 6 | grep -oE 'Creating token [^ ]+' | awk '{print $3}')
echo "USDC Mint: $USDC_MINT"

# 3. Create token account for wallet
spl-token create-account $USDC_MINT

# 4. Mint tokens (1,000,000 USDC)
spl-token mint $USDC_MINT 1000000000000 # 1,000,000 USDC with 6 decimals
