import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Configuration
const DEVNET_RPC_URL = 'https://api.devnet.solana.com';
const RECIPIENT_ADDRESS = '4GFegDV5aGpoMPc7fdNAQ8ncc5w5UmwicLNDeo4EH3GH';
const SOL_AMOUNT = 6; // Amount of SOL to send (you can modify this)

async function sendSol() {
    try {
        // Connect to devnet
        const connection = new Connection(DEVNET_RPC_URL, 'confirmed');
        
        // Load wallet from config
        const walletPath = path.join(os.homedir(), '.config', 'solana', 'id.json');
        
        if (!fs.existsSync(walletPath)) {
            throw new Error(`Wallet file not found at ${walletPath}. Please ensure you have a Solana CLI wallet configured.`);
        }
        
        const walletKeypair = Keypair.fromSecretKey(
            new Uint8Array(JSON.parse(fs.readFileSync(walletPath, 'utf-8')))
        );
        
        console.log(`Sender wallet: ${walletKeypair.publicKey.toString()}`);
        console.log(`Recipient: ${RECIPIENT_ADDRESS}`);
        console.log(`Amount: ${SOL_AMOUNT} SOL`);
        
        // Check sender balance
        const senderBalance = await connection.getBalance(walletKeypair.publicKey);
        const senderBalanceSOL = senderBalance / LAMPORTS_PER_SOL;
        
        console.log(`\nSender balance: ${senderBalanceSOL} SOL`);
        
        if (senderBalance < SOL_AMOUNT * LAMPORTS_PER_SOL) {
            throw new Error(`Insufficient balance. You have ${senderBalanceSOL} SOL but trying to send ${SOL_AMOUNT} SOL`);
        }
        
        // Create recipient public key
        const recipientPubkey = new PublicKey(RECIPIENT_ADDRESS);
        
        // Create transfer instruction
        const transferInstruction = SystemProgram.transfer({
            fromPubkey: walletKeypair.publicKey,
            toPubkey: recipientPubkey,
            lamports: SOL_AMOUNT * LAMPORTS_PER_SOL,
        });
        
        // Create transaction
        const transaction = new Transaction().add(transferInstruction);
        
        // Get recent blockhash
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = walletKeypair.publicKey;
        
        // Sign and send transaction
        console.log('\nSending transaction...');
        const signature = await connection.sendTransaction(transaction, [walletKeypair]);
        
        console.log(`Transaction signature: ${signature}`);
        console.log(`Explorer URL: https://explorer.solana.com/tx/${signature}?cluster=devnet`);
        
        // Wait for confirmation
        console.log('\nWaiting for confirmation...');
        const confirmation = await connection.confirmTransaction(signature, 'confirmed');
        
        if (confirmation.value.err) {
            throw new Error(`Transaction failed: ${confirmation.value.err}`);
        }
        
        console.log('✅ Transaction confirmed!');
        
        // Check final balances
        const finalSenderBalance = await connection.getBalance(walletKeypair.publicKey);
        const finalRecipientBalance = await connection.getBalance(recipientPubkey);
        
        console.log(`\nFinal balances:`);
        console.log(`Sender: ${finalSenderBalance / LAMPORTS_PER_SOL} SOL`);
        console.log(`Recipient: ${finalRecipientBalance / LAMPORTS_PER_SOL} SOL`);
        
    } catch (error) {
        console.error('❌ Error sending SOL:', error instanceof Error ? error.message : String(error));
        process.exit(1);
    }
}

// Handle command line arguments for custom amount
if (process.argv.length > 2) {
    const customAmount = parseFloat(process.argv[2]);
    if (isNaN(customAmount) || customAmount <= 0) {
        console.error('Invalid amount. Please provide a positive number.');
        process.exit(1);
    }
    // This would require modifying the SOL_AMOUNT constant, but for simplicity, we'll keep it as is
    console.log(`Note: To send a custom amount, modify the SOL_AMOUNT variable in the script.`);
}

sendSol(); 