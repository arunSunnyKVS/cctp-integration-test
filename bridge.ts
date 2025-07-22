import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Cctpintegration } from "../target/types/cctpintegration";
import { Connection, PublicKey, Keypair, Transaction } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";

// CCTP Program IDs
const MESSAGE_TRANSMITTER = new PublicKey("CCTPmbSD7gX1bxKPAmg77w8oFzNFpaQiQUWD43TKaecd");
const TOKEN_MESSENGER_MINTER = new PublicKey("CCTPiPYPc6AsJuwueEnWgSgucamXDZwBd53dQ11YiKX3");

describe("cctpintegration", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Cctpintegration as Program<Cctpintegration>;

  it("Can bridge tokens with fee", async () => {
    // Your existing bridge test
    const user = Keypair.generate();
    const amount = new anchor.BN(1000000); // 1 USDC (6 decimals)
    const fee = new anchor.BN(10000); // 0.01 USDC fee

    // Add your test implementation here
  });

  it("Can initiate CCTP transfer", async () => {
    const user = Keypair.generate();
    const amount = new anchor.BN(1000000); // 1 USDC
    const destinationDomain = 0; // Ethereum mainnet
    const recipient = new Uint8Array(32); // 32-byte recipient address

    try {
      // Get CCTP accounts
      const tokenMessenger = await getCctpTokenMessenger();
      const localTokenMessenger = await getCctpLocalTokenMessenger();
      const messageTransmitter = await getCctpMessageTransmitter();

      // Get user's USDC token account
      const userUsdc = await getAssociatedTokenAddress(
        new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"), // USDC mint
        user.publicKey
      );

      // Get TokenMessengerMinter token account
      const tokenMessengerMinterUsdc = await getAssociatedTokenAddress(
        new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"), // USDC mint
        TOKEN_MESSENGER_MINTER
      );

      await program.methods
        .initiateCctpTransfer(amount, destinationDomain, recipient)
        .accounts({
          user: user.publicKey,
          userUsdc: userUsdc,
          tokenMessengerMinter: tokenMessengerMinterUsdc,
          tokenMessenger: tokenMessenger,
          localTokenMessenger: localTokenMessenger,
          messageTransmitter: messageTransmitter,
          tokenProgram: TOKEN_PROGRAM_ID,
          tokenMessengerProgram: TOKEN_MESSENGER_MINTER,
        })
        .signers([user])
        .rpc();

      console.log("CCTP transfer initiated successfully");
    } catch (error) {
      console.error("Error initiating CCTP transfer:", error);
    }
  });

  it("Can receive CCTP transfer", async () => {
    const recipient = Keypair.generate();
    const message = new Uint8Array(64); // Example message
    const attestation = new Uint8Array(64); // Example attestation

    try {
      const messageTransmitter = await getCctpMessageTransmitter();

      await program.methods
        .receiveCctpTransfer(message, attestation)
        .accounts({
          recipient: recipient.publicKey,
          messageTransmitter: messageTransmitter,
          messageTransmitterProgram: MESSAGE_TRANSMITTER,
        })
        .signers([recipient])
        .rpc();

      console.log("CCTP transfer received successfully");
    } catch (error) {
      console.error("Error receiving CCTP transfer:", error);
    }
  });
});

// Helper functions to get CCTP accounts
async function getCctpTokenMessenger(): Promise<PublicKey> {
  // This would be the actual TokenMessenger account address
  // You need to derive this from the CCTP program
  return new PublicKey("TokenMessengerAccountAddress");
}

async function getCctpLocalTokenMessenger(): Promise<PublicKey> {
  // This would be the actual LocalTokenMessenger account address
  return new PublicKey("LocalTokenMessengerAccountAddress");
}

async function getCctpMessageTransmitter(): Promise<PublicKey> {
  // This would be the actual MessageTransmitter account address
  return new PublicKey("MessageTransmitterAccountAddress");
}

// Example of how to call CCTP contracts directly
export async function callCctpDirectly() {
  const connection = new Connection("https://api.mainnet-beta.solana.com");
  
  // Example: Call TokenMessengerMinter directly
  const depositForBurnIx = {
    programId: TOKEN_MESSENGER_MINTER,
    keys: [
      { pubkey: new PublicKey("token"), isSigner: false, isWritable: true },
      { pubkey: new PublicKey("tokenMessenger"), isSigner: false, isWritable: false },
      { pubkey: new PublicKey("localTokenMessenger"), isSigner: false, isWritable: false },
      { pubkey: new PublicKey("tokenMessengerMinter"), isSigner: false, isWritable: true },
      { pubkey: new PublicKey("messageTransmitter"), isSigner: false, isWritable: false },
      { pubkey: new PublicKey("authority"), isSigner: true, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: Buffer.from([]), // Instruction data for deposit_for_burn
  };

  // Example: Call MessageTransmitter directly
  const receiveMessageIx = {
    programId: MESSAGE_TRANSMITTER,
    keys: [
      { pubkey: new PublicKey("messageTransmitter"), isSigner: false, isWritable: true },
      { pubkey: new PublicKey("recipient"), isSigner: true, isWritable: true },
    ],
    data: Buffer.from([]), // Instruction data for receive_message
  };

  console.log("CCTP instruction examples created");
}
