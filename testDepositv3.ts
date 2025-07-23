import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { BridgingKit } from "./target/types/bridging_kit";
import { PublicKey, Keypair, Connection, LAMPORTS_PER_SOL, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAccount, getAssociatedTokenAddress } from "@solana/spl-token";

async function testCctpTokenMessengerMinter() {
  console.log("🚀 Starting CCTP Token Messenger Minter Test...");

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
    const eventRentPayer = user; // Use main wallet instead of generating new keypair
    const messageSentEventData = Keypair.generate();
    
    console.log("👤 Event Rent Payer:", eventRentPayer.publicKey.toString(), "(using main wallet)");
    console.log("👤 Message Sent Event Data:", messageSentEventData.publicKey.toString());



    // Use existing USDC mint on devnet
    const usdcMint = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
    console.log("🪙 Using existing USDC mint:", usdcMint.toString());

    // Find user's associated token account for USDC
    console.log("🏦 Finding user's USDC token account...");
    const userUsdcAccount = await getAssociatedTokenAddress(usdcMint, user.publicKey);
    console.log("✅ User USDC account:", userUsdcAccount.toString());

    // Check current USDC balance
    try {
      const userAccount = await getAccount(connection, userUsdcAccount);
      console.log("💰 Current USDC balance:", Number(userAccount.amount) / 1000000, "USDC");
      
      // Check if user has enough USDC
      const requiredAmount = 1000000; // 1 USDC in lamports
      if (Number(userAccount.amount) < requiredAmount) {
        console.log("❌ Insufficient USDC balance");
        console.log("   Required: 1 USDC");
        console.log("   Available:", Number(userAccount.amount) / 1000000, "USDC");
        console.log("💡 Please get some USDC from a devnet faucet first");
        return;
      }
      console.log("✅ Sufficient USDC balance for deposit");
    } catch (error) {
      console.log("❌ No USDC token account found or insufficient balance");
      console.log("💡 Please get some USDC from a devnet faucet first and ensure you have an associated token account");
      return;
    }

    // CCTP Program IDs (Devnet)
    const tokenMessengerMinter = new PublicKey("CCTPV2vPZJS2u2BBsUoscuikbYjnpFmbFsvVuJdgUMQe");
    const messageTransmitter = new PublicKey("CCTPV2Sm4AdWt5296sk4P66VBZ7bEhcARwFaaS9YPbeC");
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

    // Remote token messenger for Ethereum (domain 0 for Ethereum/Sepolia)
    const ethereumDomain = 0;
    let label = "remote_token_messenger";
    const seeds = [Buffer.from(anchor.utils.bytes.utf8.encode(label))];
    seeds.push(Buffer.from(anchor.utils.bytes.utf8.encode(ethereumDomain.toString())));
    
    const [remoteTokenMessengerPda] = PublicKey.findProgramAddressSync(
      seeds,
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

    const [eventAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from("__event_authority")],
      tokenMessengerMinter
    );

    const [denylistAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("denylist_account"), user.publicKey.toBuffer()],
      tokenMessengerMinter
    );

    console.log("✅ Token Messenger PDA:", tokenMessengerPda.toString());
    console.log("✅ Token Minter PDA:", tokenMinterPda.toString());
    console.log("✅ Local Token PDA:", localTokenPda.toString());
    console.log("✅ Remote Token Messenger PDA:", remoteTokenMessengerPda.toString());
    console.log("✅ Message Transmitter PDA:", messageTransmitterPda.toString());
    console.log("✅ Sender Authority PDA:", senderAuthorityPda.toString());
    console.log("✅ Event Authority:", eventAuthority.toString());
    console.log("✅ Denylist Account:", denylistAccount.toString());

    // Diagnostic: Check if remote token messenger exists
    console.log("\n🔍 Checking Remote Token Messenger Configuration:");
    try {
      const remoteTokenMessengerInfo = await connection.getAccountInfo(remoteTokenMessengerPda);
      if (remoteTokenMessengerInfo) {
        console.log("✅ Remote Token Messenger account EXISTS");
        console.log("   Data length:", remoteTokenMessengerInfo.data.length, "bytes");
        
        // Try to read the stored domain and token messenger address
        if (remoteTokenMessengerInfo.data.length >= 36) { // 4 bytes domain + 32 bytes pubkey + discriminator
          const storedDomain = remoteTokenMessengerInfo.data.readUInt32LE(8); // Skip 8-byte discriminator
          const storedTokenMessenger = remoteTokenMessengerInfo.data.subarray(12, 44); // Next 32 bytes
          console.log("   Stored Domain:", storedDomain);
          console.log("   Stored Token Messenger:", Buffer.from(storedTokenMessenger).toString('hex'));
          console.log("   Expected Sepolia Address: 8fe6b999dc680ccfdd5bf7eb0974218be2542daa");
        }
      } else {
        console.log("❌ Remote Token Messenger account does NOT exist");
        console.log("💡 This means CCTP is not configured for Ethereum domain 0 on devnet");
        console.log("💡 You may need to:");
        console.log("   1. Use a different domain that's configured");
        console.log("   2. Test on mainnet instead of devnet");
        console.log("   3. Contact Circle to configure Ethereum domain on devnet");
        
        // Don't proceed with the transaction
        return;
      }
         } catch (error) {
       console.log("❌ Error checking remote token messenger:", error);
       return;
     }

    //  // Check what other domains are available
    //  console.log("\n🌐 Checking other available domains:");
    //  const otherDomains = [
    //    { name: "Avalanche", id: 1 },
    //    { name: "OP Mainnet", id: 2 },
    //    { name: "Arbitrum", id: 3 },
    //    { name: "Noble", id: 4 },
    //    { name: "Base", id: 6 }
    //  ];

    //  for (const domain of otherDomains) {
    //    const [otherRemoteTokenMessengerPda] = PublicKey.findProgramAddressSync(
    //      [Buffer.from("remote_token_messenger"), new anchor.BN(domain.id).toArrayLike(Buffer, 'le', 4)],
    //      tokenMessengerMinter
    //    );

    //    try {
    //      const accountInfo = await connection.getAccountInfo(otherRemoteTokenMessengerPda);
    //      if (accountInfo) {
    //        console.log(`✅ ${domain.name} (domain ${domain.id}): CONFIGURED`);
    //      } else {
    //        console.log(`❌ ${domain.name} (domain ${domain.id}): NOT CONFIGURED`);
    //      }
    //    } catch (error) {
    //      console.log(`❌ ${domain.name} (domain ${domain.id}): ERROR`);
    //    }
    //  }

     // Prepare CCTP parameters for Sepolia
    // Convert Ethereum recipient address to 32-byte format (required by CCTP)
    const ethereumRecipientAddress = "DFEA825Af7A181dc49Fd306bA43D96216CB2AF34";
    const paddedRecipientAddress = Buffer.alloc(32);
    Buffer.from(ethereumRecipientAddress.replace('0x', ''), 'hex').copy(paddedRecipientAddress, 12); // Copy to last 20 bytes
    
    // Convert the Sepolia remote token messenger address to 32-byte format
    const sepoliaRemoteTokenMessenger = "8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA";
    const paddedRemoteTokenMessenger = Buffer.alloc(32);
    Buffer.from(sepoliaRemoteTokenMessenger, 'hex').copy(paddedRemoteTokenMessenger, 12); // Copy to last 20 bytes
    
    const params = {
      amount: new anchor.BN(1000000), // 1 USDC (6 decimals)
      destinationDomain: ethereumDomain, // Ethereum domain (0)
      mintRecipient: new PublicKey(paddedRecipientAddress), // Ethereum recipient address (32-byte format)
      destinationCaller: new PublicKey(paddedRecipientAddress), // Ethereum caller address (32-byte format)  
      maxFee: new anchor.BN(100000), // 0.1 USDC max fee
      minFinalityThreshold: 1, // Minimum finality threshold
    };

    console.log("📋 CCTP Parameters:");
    console.log("  - Amount:", params.amount.toString(), "lamports (1 USDC)");
    console.log("  - Destination Domain:", params.destinationDomain, "(Ethereum)");
    console.log("  - Recipient Address:", `0x${ethereumRecipientAddress}`);
    console.log("  - Mint Recipient (32-byte):", params.mintRecipient.toString());
    console.log("  - Max Fee:", params.maxFee.toString(), "lamports (0.1 USDC)");
    console.log("  - Min Finality Threshold:", params.minFinalityThreshold);

         // Call the invoke_cctp_token_messenger_minter function
     console.log("🔥 Calling invoke_cctp_token_messenger_minter...");
     console.log("⚠️  This will burn 1 USDC on Solana and initiate a mint on Ethereum");
    
    try {
      const tx = await program.methods
        .invokeCctpTokenMessengerMinter(params)
                 .accounts({
           user: user.publicKey,
           userUsdc: userUsdcAccount,
           tokenMessengerMinter: tokenMessengerMinter,
           eventRentPayer: eventRentPayer.publicKey,
           senderAuthorityPda: senderAuthorityPda,
           messageTransmitter: messageTransmitterPda,
           tokenMessenger: tokenMessengerPda,
           remoteTokenMessenger: remoteTokenMessengerPda,
           tokenMinter: tokenMinterPda,
           localToken: localTokenPda,
           burnTokenMint: usdcMint,
           messageSentEventData: messageSentEventData.publicKey,
           messageTransmitterProgram: messageTransmitter,
           tokenMessengerMinterProgram: tokenMessengerMinter,
           systemProgram: systemProgram,
           eventAuthority: eventAuthority,
           program: tokenMessengerMinter,
           denylistAccount: denylistAccount,
         })
                 .signers([user, messageSentEventData])
        .rpc();
      
      console.log("✅ CCTP Token Messenger Minter transaction successful!");
      console.log("📝 Transaction signature:", tx);
      console.log("🔍 View transaction: https://explorer.solana.com/tx/" + tx + "?cluster=devnet");
      console.log("");
             console.log("🎉 Next steps:");
       console.log("1. Wait for the transaction to be finalized on Solana");
       console.log("2. Get the attestation from Circle's API using the transaction hash");
       console.log("3. Use the attestation to mint USDC on Ethereum at the recipient address");
       console.log(`4. Recipient address: 0x${ethereumRecipientAddress}`);
      
    } catch (error: any) {
      console.log("❌ CCTP Token Messenger Minter transaction failed:");
      console.log("💡 Error details:", error.message || error);
      
      // Check for specific error codes
      if (error.error?.errorCode?.code) {
        console.log("🔍 Error code:", error.error.errorCode.code);
      }
      
      if (error.logs) {
        console.log("📋 Transaction logs:");
        error.logs.forEach((log: string, index: number) => {
          console.log(`   ${index + 1}. ${log}`);
        });
      }
      
      // Common issues and solutions
      console.log("\n🔧 Possible solutions:");
      console.log("1. Ensure you have enough SOL for transaction fees (≥0.01 SOL)");
      console.log("2. Verify you have at least 1 USDC in your token account");
             console.log("3. Check that all CCTP programs are available on devnet");
       console.log("4. Make sure the recipient Ethereum address is valid");
       console.log("5. Verify the domain ID for Ethereum is correct (0)");
    }

  } catch (error: any) {
    console.error("❌ Error during CCTP test setup:");
    console.error(error);
    
    if (error.message) {
      console.log("\n💡 Error details:", error.message);
    }
    
    console.log("\n🔧 Common setup issues:");
    console.log("1. Make sure ANCHOR_WALLET environment variable is set");
    console.log("2. Ensure your wallet file exists and has the correct format");
    console.log("3. Check that you're connected to Solana devnet");
    console.log("4. Verify the program is built and deployed");
  }
}

// Run the test
testCctpTokenMessengerMinter()
  .then(() => {
    console.log("\n🎉 Test completed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Test failed with unhandled error:", error);
    process.exit(1);
  });
