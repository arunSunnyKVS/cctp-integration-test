import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { BridgingKit } from "./target/types/bridging_kit";
import { PublicKey, Keypair, Connection, LAMPORTS_PER_SOL, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, createMint, createAccount, mintTo, getAccount, getAssociatedTokenAddress, createAssociatedTokenAccount } from "@solana/spl-token";

async function testCctpInvoke() {
  console.log("🚀 Starting CCTP Invoke Token Messenger Test...");

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

    // Create additional signers for CCTP
    const eventRentPayer = Keypair.generate();
    const messageSentEventData = Keypair.generate();
    
    console.log("👤 Event Rent Payer:", eventRentPayer.publicKey.toString());
    console.log("👤 Message Sent Event Data:", messageSentEventData.publicKey.toString());

    // Airdrop SOL to additional signers
    console.log("💰 Airdropping SOL to additional signers...");
    const eventRentPayerSignature = await connection.requestAirdrop(eventRentPayer.publicKey, LAMPORTS_PER_SOL);
    await connection.confirmTransaction(eventRentPayerSignature);
    
    const messageSentEventDataSignature = await connection.requestAirdrop(messageSentEventData.publicKey, LAMPORTS_PER_SOL);
    await connection.confirmTransaction(messageSentEventDataSignature);

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

    // CCTP Program IDs (Devnet)
    const tokenMessengerMinter = new PublicKey("CCTPiPYPc6AsJuwueEnWgSgucamXDZwBd53dQ11YiKX3");
    const messageTransmitter = new PublicKey("CCTPmbSD7gX1bxKPAmg77w8oFzNFpaQiQUWD43TKaecd");
    const tokenProgram = TOKEN_PROGRAM_ID;
    const systemProgram = SystemProgram.programId;

    console.log("🔗 CCTP Token Messenger Minter:", tokenMessengerMinter.toString());
    console.log("🔗 CCTP Message Transmitter:", messageTransmitter.toString());

    // Derive CCTP PDAs
    console.log("🔐 Deriving CCTP PDAs...");
    const [tokenMessengerPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("token_messenger")],
      tokenMessengerMinter
    );

    const [tokenMinterPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("token_minter")],
      tokenMessengerMinter
    );

    const [localTokenPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("local_token"), usdcMint.toBuffer()],
      tokenMessengerMinter
    );

    const [remoteTokenMessengerPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("remote_token_messenger"), new anchor.BN(0).toArrayLike(Buffer, 'le', 4)],
      tokenMessengerMinter
    );

    const [messageTransmitterPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("message_transmitter")],
      messageTransmitter
    );

    const [senderAuthorityPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("sender_authority")],
      tokenMessengerMinter
    );

    const [denylistAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("denylist_account"), user.publicKey.toBuffer()],
      tokenMessengerMinter
    );

    const [eventAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from("__event_authority")],
      tokenMessengerMinter
    );

    console.log("✅ Token Messenger PDA:", tokenMessengerPda.toString());
    console.log("✅ Token Minter PDA:", tokenMinterPda.toString());
    console.log("✅ Local Token PDA:", localTokenPda.toString());
    console.log("✅ Remote Token Messenger PDA:", remoteTokenMessengerPda.toString());
    console.log("✅ Message Transmitter PDA:", messageTransmitterPda.toString());
    console.log("✅ Sender Authority PDA:", senderAuthorityPda.toString());
    console.log("✅ Denylist Account:", denylistAccount.toString());
    console.log("✅ Event Authority:", eventAuthority.toString());

    // Prepare CCTP invoke parameters
    const params = {
      amount: new anchor.BN(2000000), // 2 USDC
      destinationDomain: 0, // Sepolia devnet
      mintRecipient: new PublicKey("11111111111111111111111111111111"), // Mock recipient
      destinationCaller: new PublicKey("11111111111111111111111111111111"), // Mock caller
      maxFee: new anchor.BN(1000000), // 1 USDC max fee
      minFinalityThreshold: new anchor.BN(1), // Minimum finality threshold
    };

    console.log("📋 CCTP Invoke parameters:");
    console.log("  - Amount:", params.amount.toString(), "lamports");
    console.log("  - Destination Domain:", params.destinationDomain);
    console.log("  - Mint Recipient:", params.mintRecipient.toString());
    console.log("  - Destination Caller:", params.destinationCaller.toString());
    console.log("  - Max Fee:", params.maxFee.toString(), "lamports");
    console.log("  - Min Finality Threshold:", params.minFinalityThreshold.toString());

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

    // Call the invoke_cctp_token_messenger function
    console.log("🔥 Calling invoke_cctp_token_messenger...");
    console.log("⚠️  Note: This will attempt to call the CCTP deposit_for_burn instruction");
    console.log("   with all required accounts and proper parameter structure");
    
    try {
      const tx = await program.methods
        .invokeCctpTokenMessenger(params)
        .accounts({
          user: user.publicKey,
          userUsdc: userUsdcAccount,
          tokenMessengerMinter: tokenMessengerMinter,
          eventRentPayer: eventRentPayer.publicKey,
          senderAuthorityPda: senderAuthorityPda,
          denylistAccount: denylistAccount,
          messageTransmitter: messageTransmitterPda,
          tokenMessenger: tokenMessengerPda,
          remoteTokenMessenger: remoteTokenMessengerPda,
          tokenMinter: tokenMinterPda,
          localToken: localTokenPda,
          burnTokenMint: usdcMint,
          messageSentEventData: messageSentEventData.publicKey,
          messageTransmitterProgram: messageTransmitter,
          tokenMessengerMinterProgram: tokenMessengerMinter,
          tokenProgram: tokenProgram,
          systemProgram: systemProgram,
          eventAuthority: eventAuthority,
          program: tokenMessengerMinter,
        })
        .signers([user, eventRentPayer, messageSentEventData])
        .rpc();
      
      console.log("✅ CCTP invoke transaction successful!");
      console.log("📝 Transaction signature:", tx);
      console.log("🔍 View transaction: https://explorer.solana.com/tx/" + tx + "?cluster=devnet");
    } catch (error: any) {
      console.log("❌ CCTP invoke transaction failed:");
      console.log("💡 Error details:", error.message || error);
      
      // Provide helpful error information
      if (error.error?.errorCode?.code) {
        console.log("🔍 Error code:", error.error.errorCode.code);
      }
      
      // Common issues and solutions
      console.log("\n🔧 Common issues and solutions:");
      console.log("1. Make sure you're connected to the right network (devnet/testnet)");
      console.log("2. Ensure the CCTP programs are deployed on your target network");
      console.log("3. Check that you have sufficient SOL for transaction fees");
      console.log("4. Verify all CCTP PDAs are derived correctly");
      console.log("5. Ensure all required signers are provided");
      console.log("6. Check that the USDC mint and accounts are valid");
    }

  } catch (error: any) {
    console.error("❌ Error during CCTP invoke test:");
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
    console.log("5. Ensure all required signers are available and funded");
  }
}

// Run the test
testCctpInvoke()
  .then(() => {
    console.log("\n🎉 Test completed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Test failed with unhandled error:", error);
    process.exit(1);
  });
