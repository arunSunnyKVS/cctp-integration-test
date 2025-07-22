import axios from 'axios';

interface AttestationResponse {
  attestation: string;
  status: string;
  messageHash?: string;
}

interface AttestationStatus {
  status: 'pending' | 'complete' | 'error';
  attestation?: string;
  messageHash?: string;
}

async function getAttestation(transactionHash: string): Promise<void> {
  console.log("🔍 Fetching CCTP attestation for transaction...");
  console.log("📝 Transaction Hash:", transactionHash);
  console.log("🌐 Network: Sepolia Testnet (Sandbox)");
  
  // CCTP Attestation API endpoint (sandbox only)
  const attestationUrl = `https://iris-api-sandbox.circle.com/attestations/${transactionHash}`;

  try {
    console.log(`🔗 Fetching from: ${attestationUrl}`);
    
    const response = await axios.get<AttestationResponse>(attestationUrl, {
      timeout: 10000,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'CCTP-Attestation-Script/1.0'
      }
    });

    if (response.data) {
      console.log("✅ Attestation retrieved successfully!");
      console.log("📊 Response data:");
      console.log("   Status:", response.data.status);
      
      if (response.data.attestation) {
        console.log("🔐 Attestation:", response.data.attestation);
        console.log("📏 Attestation length:", response.data.attestation.length, "characters");
      }
      
      if (response.data.messageHash) {
        console.log("💬 Message Hash:", response.data.messageHash);
      }
      
      return;
    }
  } catch (error: any) {
    if (error.response) {
      console.log(`❌ HTTP Error ${error.response.status}: ${error.response.statusText}`);
      if (error.response.status === 404) {
        console.log("💡 Transaction not found or attestation not ready yet");
      }
    } else if (error.code === 'ECONNABORTED') {
      console.log("⏰ Request timeout");
    } else {
      console.log(`❌ Network error: ${error.message}`);
    }
  }

  // If all endpoints fail, try polling approach
  console.log("\n🔄 Trying polling approach for attestation...");
  await pollForAttestation(transactionHash);
}

async function pollForAttestation(transactionHash: string, maxAttempts: number = 30): Promise<void> {
  const pollUrl = `https://iris-api-sandbox.circle.com/attestations/${transactionHash}`;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`🔄 Polling attempt ${attempt}/${maxAttempts}...`);
      
      const response = await axios.get<AttestationStatus>(pollUrl, {
        timeout: 5000
      });

      if (response.data.status === 'complete' && response.data.attestation) {
        console.log("✅ Attestation is ready!");
        console.log("🔐 Attestation:", response.data.attestation);
        console.log("📏 Attestation length:", response.data.attestation.length, "characters");
        if (response.data.messageHash) {
          console.log("💬 Message Hash:", response.data.messageHash);
        }
        return;
      } else if (response.data.status === 'pending') {
        console.log("⏳ Attestation is still pending...");
        if (attempt < maxAttempts) {
          console.log("⏰ Waiting 10 seconds before next attempt...");
          await new Promise(resolve => setTimeout(resolve, 10000));
        }
      } else {
        console.log("❌ Unexpected status:", response.data.status);
        break;
      }
    } catch (error: any) {
      if (error.response?.status === 404) {
        console.log("⏳ Transaction not found yet, waiting...");
        if (attempt < maxAttempts) {
          console.log("⏰ Waiting 10 seconds before next attempt...");
          await new Promise(resolve => setTimeout(resolve, 10000));
        }
      } else {
        console.log(`❌ Error on attempt ${attempt}:`, error.message);
        break;
      }
    }
  }
  
  console.log("❌ Failed to get attestation after all attempts");
  console.log("💡 The transaction might still be processing or the hash might be incorrect");
}

async function verifyTransactionOnSepolia(transactionHash: string): Promise<void> {
  console.log("\n🔍 Verifying transaction on Sepolia...");
  
  try {
    // Use Etherscan API to verify the transaction exists
    const etherscanUrl = `https://api-sepolia.etherscan.io/api?module=proxy&action=eth_getTransactionByHash&txhash=${transactionHash}&apikey=YourApiKeyToken`;
    
    // For demo purposes, we'll just show the URL structure
    console.log("🔗 Etherscan URL (replace with your API key):");
    console.log(`   ${etherscanUrl.replace('YourApiKeyToken', 'YOUR_API_KEY')}`);
    
    console.log("💡 To verify the transaction manually:");
    console.log(`   https://sepolia.etherscan.io/tx/${transactionHash}`);
    
  } catch (error) {
    console.log("❌ Error verifying transaction:", error);
  }
}

// Main execution
async function main() {
  const transactionHash = "0x99f19d5c73527bb4482dabba5c807cbe466ed8f1c40e0d31af09f6c9f8b174bf";
  
  console.log("🚀 CCTP Attestation Fetcher");
  console.log("================================");
  
  // Verify the transaction first
  await verifyTransactionOnSepolia(transactionHash);
  
  // Get the attestation
  await getAttestation(transactionHash);
  
  console.log("\n🎉 Script completed!");
}

// Run the script
main()
  .then(() => {
    console.log("\n✅ Successfully completed attestation fetch");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Script failed:", error);
    process.exit(1);
  });
