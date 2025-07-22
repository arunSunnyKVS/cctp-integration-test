import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { BridgingKit } from "./target/types/bridging_kit";
import { PublicKey, Keypair, Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, createMint, createAccount, mintTo, getAccount, getAssociatedTokenAddress, createAssociatedTokenAccount } from "@solana/spl-token";

async function testDepositForBurn() {
  console.log("🚀 Starting CCTP Deposit for Burn Test...");

  // Configure the client to use the local cluster
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.BridgingKit as Program<BridgingKit>;
  const connection = anchor.getProvider().connection;
  
    // Test connection with retry
  console.log("🔗 Testing connection to Solana devnet...");
  const rpcEndpoints = [
    "https://api.devnet.solana.com",
    "https://devnet.solana.com",
    "https://solana-devnet.g.alchemy.com/v2/demo"
  ];
  
  let workingConnection = null;
  for (const endpoint of rpcEndpoints) {
    try {
      console.log(`🔗 Trying ${endpoint}...`);
      const testConnection = new anchor.web3.Connection(endpoint, "confirmed");
      await testConnection.getLatestBlockhash();
      console.log(`✅ Connection successful with ${endpoint}`);
      workingConnection = testConnection;
      break;
    } catch (error) {
      console.log(`❌ Failed with ${endpoint}`);
    }
  }
  
  if (!workingConnection) {
    console.error("❌ All RPC endpoints failed");
    console.error("Please check your internet connection or try again later");
    process.exit(1);
  }
  
  // Update the provider with the working connection
  const wallet = anchor.getProvider().wallet;
  if (wallet) {
    anchor.setProvider(new anchor.AnchorProvider(workingConnection, wallet, {}));
  }

  try {
    // Use existing wallet from environment
    const user = anchor.web3.Keypair.fromSecretKey(
      Buffer.from(JSON.parse(require('fs').readFileSync(process.env.ANCHOR_WALLET || '~/.config/solana/id.json', 'utf-8')))
    );
    console.log("👤 Using existing wallet:", user.publicKey.toString());
    console.log("💰 Current SOL balance:", await connection.getBalance(user.publicKey) / LAMPORTS_PER_SOL, "SOL");

    // Use existing USDC mint on devnet
    const usdcMint = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
    console.log("🪙 Using existing USDC mint:", usdcMint.toString());

    // Use existing USDC token account
    console.log("🏦 Getting user's USDC account...");
    const userUsdcAccount = new PublicKey("aF59Fxd45x2iy7R6m9dpnURQqW7aXYMYofPK6iNztz6");
    console.log("✅ Using existing USDC account:", userUsdcAccount.toString());

    // Check current USDC balance
    try {
      const userAccount = await getAccount(connection, userUsdcAccount);
      console.log("💰 Current USDC balance:", Number(userAccount.amount) / 1000000, "USDC");
    } catch (error) {
      console.log("💰 No USDC balance found - you'll need to get some USDC from a faucet");
    }

    // CCTP Token Messenger Minter program ID
    const tokenMessengerMinter = new PublicKey("CCTPiPYPc6AsJuwueEnWgSgucamXDZwBd53dQ11YiKX3");
    console.log("🔗 CCTP Token Messenger Minter:", tokenMessengerMinter.toString());

    // Prepare deposit for burn parameters
    const params = {
      amount: new anchor.BN(2000000), // 2 USDC
      destinationDomain: 0, // Sepolia devnet
      recipient: Array.from(Buffer.from("DFEA825Af7A181dc49Fd306bA43D96216CB2AF34", "hex")), // Specific recipient address
    };

    console.log("📋 Deposit parameters:");
    console.log("  - Amount:", params.amount.toString(), "lamports");
    console.log("  - Destination Domain:", params.destinationDomain);
    console.log("  - Recipient:", Buffer.from(params.recipient).toString('hex'));

    // Check if user has enough USDC
    try {
      const userAccount = await getAccount(connection, userUsdcAccount);
      const requiredAmount = 2000000; // 2 USDC in lamports
      if (Number(userAccount.amount) < requiredAmount) {
        console.log("❌ Insufficient USDC balance");
        console.log("   Required: 2 USDC");
        console.log("   Available:", Number(userAccount.amount) / 1000000, "USDC");
        console.log("💡 Please get some USDC from a devnet faucet first");
        return;
      }
      console.log("✅ Sufficient USDC balance for deposit");
    } catch (error) {
      console.log("❌ No USDC account found");
      console.log("💡 Please get some USDC from a devnet faucet first");
      return;
    }

    // Call the deposit for burn function
    console.log("🔥 Calling deposit for burn...");
    console.log("⚠️  Note: This will likely fail because the Rust program needs more CCTP accounts");
    console.log("   The CCTP deposit_for_burn instruction requires ~15 accounts, but the program only provides 2");
    
    try {
      const tx = await program.methods
        .callDepositForBurn(params)
        .accounts({
          user: user.publicKey,
          tokenMessengerMinter: tokenMessengerMinter,
        })
        .signers([user])
        .rpc();
      
      console.log("✅ Deposit for burn transaction successful!");
      console.log("📝 Transaction signature:", tx);
      console.log("🔍 View transaction: https://explorer.solana.com/tx/" + tx + "?cluster=devnet");
    } catch (error: any) {
      if (error.error?.errorCode?.code === 'InstructionDidNotDeserialize') {
        console.log("❌ Expected error: InstructionDidNotDeserialize");
        console.log("💡 This is because the Rust program needs to be updated with proper CCTP account structure");
        console.log("📋 Required CCTP accounts for deposit_for_burn:");
        console.log("   - owner (signer)");
        console.log("   - event_rent_payer");
        console.log("   - sender_authority_pda");
        console.log("   - burn_token_account");
        console.log("   - denylist_account");
        console.log("   - message_transmitter");
        console.log("   - token_messenger");
        console.log("   - remote_token_messenger");
        console.log("   - token_minter");
        console.log("   - local_token");
        console.log("   - burn_token_mint");
        console.log("   - message_sent_event_data");
        console.log("   - message_transmitter_program");
        console.log("   - token_messenger_minter_program");
        console.log("   - token_program");
        console.log("   - system_program");
        console.log("   - event_authority");
        console.log("   - rent");
      } else {
        throw error;
      }
    }

  } catch (error: any) {
    console.error("❌ Error during deposit for burn test:");
    console.error(error);
    
    // Provide helpful error information
    if (error.message) {
      console.log("\n💡 Error details:", error.message);
    }
    
    // Common issues and solutions
    console.log("\n🔧 Common issues and solutions:");
    console.log("1. Make sure you're connected to the right network (devnet/testnet)");
    console.log("2. Ensure the CCTP programs are deployed on your target network");
    console.log("3. Check that you have sufficient SOL for transaction fees");
    console.log("4. Verify the CCTP Token Messenger Minter program ID is correct");
  }
}

// Run the test
testDepositForBurn()
  .then(() => {
    console.log("\n🎉 Test completed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Test failed with unhandled error:", error);
    process.exit(1);
  });
