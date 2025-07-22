const anchor = require("@coral-xyz/anchor");
const { Connection, Keypair, PublicKey, SystemProgram } = anchor.web3;
const fs = require("fs");

// Set provider to localnet
const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

// Load the IDL
const idl = JSON.parse(
  fs.readFileSync("./target/idl/hello_anchor.json", "utf8")
);

// Load the program ID (from target/deploy/hello_anchor-keypair.json)
// const programId = new PublicKey(
//   fs.readFileSync("target/deploy/cctpintegration-keypair.json", "utf8")
//     .match(/"pubkey": ?"([^"]+)"/)[1]
// );

const programId = new PublicKey("FZTigSHkQ8RZsrqbER8kKezA3rHjTHJ8nRwoViCYtJNT")
// Create a new keypair for the account
const baseAccount = Keypair.generate();

async function main() {
  const program = new anchor.Program(idl, programId, provider);

  console.log("🪪 Base account:", baseAccount.publicKey.toBase58());

  // Call initialize
  await program.methods
    .initialize("Hello Solana")
    .accounts({
      baseAccount: baseAccount.publicKey,
      user: provider.wallet.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .signers([baseAccount])
    .rpc();

  console.log("✅ Initialized");

  // Fetch and log the message
  let account = await program.account.baseAccount.fetch(baseAccount.publicKey);
  console.log("📩 Stored message:", account.message);

  // Call update
  await program.methods
    .update("Updated message!")
    .accounts({
      baseAccount: baseAccount.publicKey,
    })
    .rpc();

  account = await program.account.baseAccount.fetch(baseAccount.publicKey);
  console.log("📝 Updated message:", account.message);
}

main().catch(err => {
  console.error(err);
});

