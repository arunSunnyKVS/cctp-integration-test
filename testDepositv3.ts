import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { BridgingKit } from "./target/types/bridging_kit";
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAccount } from "@solana/spl-token";
import { SystemProgram } from "@solana/web3.js";

async function testDepositForBurn() {
  console.log("🚀 Starting Deposit for Burn Test...");

  // Configure the client to use the local cluster
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.BridgingKit as Program<BridgingKit>;
  const connection = anchor.getProvider().connection;

  try {
    // Read wallet from config
    const user = anchor.web3.Keypair.fromSecretKey(
      Buffer.from(JSON.parse(require('fs').readFileSync(process.env.ANCHOR_WALLET || '~/.config/solana/id.json', 'utf-8')))
    );
    console.log("👤 Using wallet:", user.publicKey.toString());
    console.log("💰 Current SOL balance:", await connection.getBalance(user.publicKey) / LAMPORTS_PER_SOL, "SOL");

    // USDC mint on devnet
    const usdcMint = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
    console.log("🪙 USDC mint:", usdcMint.toString());

    // Get user's USDC account
    const userUsdcAccount = await anchor.utils.token.associatedAddress({
      mint: usdcMint,
      owner: user.publicKey
    });
    console.log("🏦 USDC account:", userUsdcAccount.toString());

    // Check USDC balance
    try {
      const userAccount = await getAccount(connection, userUsdcAccount);
      const balance = Number(userAccount.amount) / 1000000;
      console.log("💰 USDC balance:", balance, "USDC");
      
      if (balance < 1) {
        console.log("❌ Insufficient USDC balance. Need at least 1 USDC");
        return;
      }
    } catch (error) {
      console.log("❌ No USDC account found or insufficient balance");
      return;
    }

    // Create signers for CCTP
    const eventRentPayer = Keypair.generate();
    const messageSentEventData = Keypair.generate();

    // CCTP Program IDs (Devnet)
    const tokenMessengerMinter = new PublicKey("CCTPV2vPZJS2u2BBsUoscuikbYjnpFmbFsvVuJdgUMQe");
    const messageTransmitter = new PublicKey("CCTPV2Sm4AdWt5296sk4P66VBZ7bEhcARwFaaS9YPbeC");

    // Derive CCTP PDAs
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

    const [eventAuthority] = PublicKey.findProgramAddressSync(
      [Buffer.from("__event_authority")],
      tokenMessengerMinter
    );

    const [denylistAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("denylist_account"), user.publicKey.toBuffer()],
      tokenMessengerMinter
    );

    // Prepare deposit for burn parameters
    const ethereumAddress = "DFEA825Af7A181dc49Fd306bA43D96216CB2AF34";
    const paddedAddress = Buffer.alloc(32);
    Buffer.from(ethereumAddress.replace('0x', ''), 'hex').copy(paddedAddress, 12);
    
    const params = {
      amount: new anchor.BN(1000000), // 1 USDC
      destinationDomain: 0, // Ethereum mainnet
      mintRecipient: new PublicKey(paddedAddress),
      destinationCaller: new PublicKey(paddedAddress),
      maxFee: new anchor.BN(100000), // 0.1 USDC max fee
      minFinalityThreshold: 1,
    };

    console.log("📋 Deposit for burn parameters:");
    console.log("  - Amount: 1 USDC");
    console.log("  - Destination: Sepolia testnet");
    console.log("  - Recipient:", ethereumAddress);

    // Call deposit for burn
    console.log("🔥 Calling deposit for burn...");
    
    const tx = await program.methods
      .invokeCctpTokenMessenger(params)
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
        systemProgram: SystemProgram.programId,
        eventAuthority: eventAuthority,
        program: tokenMessengerMinter,
        denylistAccount: denylistAccount,
      })
      .signers([user, eventRentPayer, messageSentEventData])
      .rpc();
    
    console.log("✅ Deposit for burn successful!");
    console.log("📝 Transaction:", tx);
    console.log("🔍 Explorer: https://explorer.solana.com/tx/" + tx + "?cluster=devnet");

  } catch (error: any) {
    console.error("❌ Error:", error.message || error);
  }
}

// Run the test
testDepositForBurn()
  .then(() => {
    console.log("\n🎉 Test completed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Test failed:", error);
    process.exit(1);
  });
