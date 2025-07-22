#![allow(warnings)]
use anchor_lang::prelude::*;
use anchor_lang::solana_program::{instruction::{Instruction, AccountMeta}, program::invoke, pubkey::Pubkey, system_program};
use anchor_spl::token::{self, Token, TokenAccount, Transfer, transfer, Mint};
use std::str::FromStr;
// use token_messenger_minter::cpi::accounts::DepositForBurn;
// Declare the pda_derivations module
pub mod pda_derivations;

declare_id!("CABbkyFnKoZ9UpRnBu8YFaCBdBG1xMZPMuc6GmrnogbT");

// CCTP Program IDs
pub const MESSAGE_TRANSMITTER: &str = "CCTPmbSD7gX1bxKPAmg77w8oFzNFpaQiQUWD43TKaecd";
pub const TOKEN_MESSENGER_MINTER: &str = "CCTPiPYPc6AsJuwueEnWgSgucamXDZwBd53dQ11YiKX3";

// SPL Token Program ID
pub const SPL_TOKEN_PROGRAM_ID: &str = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

// System Program ID
pub const SYSTEM_PROGRAM_ID: &str = "11111111111111111111111111111111";

const DEPOSIT_FOR_BURN_DISCRIMINATOR: [u8; 8] = [215, 60, 61, 46, 114, 55, 128, 176];
// CCTP Instruction Discriminators


#[program]
pub mod bridging_kit {
    use super::*;

    pub fn bridge(ctx: Context<BridgeContext>, amount: u64, fee: u64) -> Result<()> {
        require!(amount > fee, ErrorCode::InvalidFee);

        // Transfer fee to the fee recipient
        transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.user_usdc.to_account_info(),
                    to: ctx.accounts.fee_usdc.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            fee,
        )?;

        // Transfer remaining amount to the vault
        let bridge_amount = amount.checked_sub(fee).unwrap();   
        transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.user_usdc.to_account_info(),
                    to: ctx.accounts.vault_usdc.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            bridge_amount,
        )?;

        Ok(())
    }

    // New instruction to initiate cross-chain transfer via CCTP
    pub fn invoke_cctp_token_messenger(
        ctx: Context<CctpTransfer>,
        params: CctpMinterInvokeParams,
    ) -> Result<()> {
        // Convert string constants to Pubkeys
        let token_messenger_minter_program_id = Pubkey::from_str(TOKEN_MESSENGER_MINTER).unwrap();
        let message_transmitter_program_id = Pubkey::from_str(MESSAGE_TRANSMITTER).unwrap();
        let burn_token_mint = ctx.accounts.user_usdc.mint;

        // Derive CCTP PDAs
        let (token_messenger_pda, _) = pda_derivations::derive_token_messenger_pda(&token_messenger_minter_program_id);
        let (token_minter_pda, _) = pda_derivations::derive_token_minter_pda(&token_messenger_minter_program_id);
        let (local_token_pda, _) = pda_derivations::derive_local_token_pda(&token_messenger_minter_program_id, &burn_token_mint);
        let (remote_token_messenger_pda, _) = pda_derivations::derive_remote_token_messenger_pda(&token_messenger_minter_program_id, params.destination_domain);
        let (message_transmitter_pda, _) = pda_derivations::derive_message_transmitter_pda(&message_transmitter_program_id);
        let (sender_authority_pda, _) = pda_derivations::derive_sender_authority_pda(&token_messenger_minter_program_id, 0);
        
        // Log the derived PDAs for verification
        msg!("Token Messenger PDA: {}", token_messenger_pda);
        msg!("Token Minter PDA: {}", token_minter_pda);
        msg!("Local Token PDA: {}", local_token_pda);
        msg!("Remote Token Messenger PDA: {}", remote_token_messenger_pda);
        msg!("Message Transmitter PDA: {}", message_transmitter_pda);
        msg!("Sender Authority PDA: {}", sender_authority_pda);
        
        // Create account metas for the deposit_for_burn instruction
        let account_metas = vec![
            AccountMeta::new(ctx.accounts.user.key(), true), // owner
            AccountMeta::new(ctx.accounts.event_rent_payer.key(), true), // event_rent_payer
            AccountMeta::new_readonly(sender_authority_pda, false), // sender_authority_pda
            AccountMeta::new(ctx.accounts.user_usdc.key(), false), // burn_token_account
            AccountMeta::new_readonly(ctx.accounts.denylist_account.key(), false), // denylist_account
            AccountMeta::new(ctx.accounts.message_transmitter.key(), false), // message_transmitter
            AccountMeta::new_readonly(ctx.accounts.token_messenger.key(), false), // token_messenger
            AccountMeta::new_readonly(ctx.accounts.remote_token_messenger.key(), false), // remote_token_messenger
            AccountMeta::new_readonly(ctx.accounts.token_minter.key(), false), // token_minter
            AccountMeta::new(ctx.accounts.local_token.key(), false), // local_token
            AccountMeta::new(ctx.accounts.burn_token_mint.key(), false), // burn_token_mint
            AccountMeta::new(ctx.accounts.message_sent_event_data.key(), true), // message_sent_event_data
            AccountMeta::new_readonly(ctx.accounts.message_transmitter_program.key(), false), // message_transmitter_program
            AccountMeta::new_readonly(ctx.accounts.token_messenger_minter_program.key(), false), // token_messenger_minter_program
            AccountMeta::new_readonly(ctx.accounts.token_program.key(), false), // token_program
            AccountMeta::new_readonly(ctx.accounts.system_program.key(), false), // system_program
            AccountMeta::new_readonly(ctx.accounts.event_authority.key(), false), // event_authority
            AccountMeta::new_readonly(ctx.accounts.program.key(), false), // program
        ];

        // Create account infos for the CPI call
        let account_infos = vec![
            ctx.accounts.user.to_account_info(),
            ctx.accounts.event_rent_payer.to_account_info(),
            ctx.accounts.sender_authority_pda.to_account_info(),
            ctx.accounts.user_usdc.to_account_info(),
            ctx.accounts.denylist_account.to_account_info(),
            ctx.accounts.message_transmitter.to_account_info(),
            ctx.accounts.token_messenger.to_account_info(),
            ctx.accounts.remote_token_messenger.to_account_info(),
            ctx.accounts.token_minter.to_account_info(),
            ctx.accounts.local_token.to_account_info(),
            ctx.accounts.burn_token_mint.to_account_info(),
            ctx.accounts.message_sent_event_data.to_account_info(),
            ctx.accounts.message_transmitter_program.to_account_info(),
            ctx.accounts.token_messenger_minter_program.to_account_info(),
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
            ctx.accounts.event_authority.to_account_info(),
            ctx.accounts.program.to_account_info(),
        ];

        // Create instruction data for deposit_for_burn
        let mut data = Vec::new();
        data.extend_from_slice(&DEPOSIT_FOR_BURN_DISCRIMINATOR); // Instruction discriminator
        data.extend_from_slice(&params.amount.to_le_bytes());
        data.extend_from_slice(&params.destination_domain.to_le_bytes());
        data.extend_from_slice(&params.mint_recipient.to_bytes());
        data.extend_from_slice(&params.destination_caller.to_bytes());
        data.extend_from_slice(&params.max_fee.to_le_bytes());
        data.extend_from_slice(&params.min_finality_threshold.to_le_bytes());
        
        let instruction = Instruction {
            program_id: token_messenger_minter_program_id,
            accounts: account_metas,
            data: data,
        };

        // Execute the CPI call
        invoke(&instruction, &account_infos)?;
        
        msg!("CCTP deposit_for_burn instruction executed successfully");
        Ok(())
    }

    pub fn call_deposit_for_burn(ctx: Context<DepositForBurnContext>, params: DepositForBurnParams) -> Result<()> {

        let account_metas = vec![
            AccountMeta::new(ctx.accounts.user.to_account_info().key(), true),
            AccountMeta::new(ctx.accounts.token_messenger_minter.to_account_info().key(), true),
        ];

        let account_infos = vec![
    ctx.accounts.user.to_account_info(),
    ctx.accounts.token_messenger_minter.to_account_info(),
];

    let mut data = Vec::new();
    data.extend_from_slice(&params.amount.to_le_bytes());
    data.extend_from_slice(&params.destination_domain.to_le_bytes());
    data.extend_from_slice(&params.recipient);
        
        let instruction = Instruction {
            program_id: Pubkey::from_str(TOKEN_MESSENGER_MINTER).unwrap(),
            accounts: account_metas,
            data: data,
        };
        invoke(&instruction, &account_infos)?;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct DepositForBurnContext<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    /// CHECK: This is the CCTP Token Messenger Minter program account that we're calling via CPI
    #[account(mut)]
    pub token_messenger_minter: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct CctpTransfer<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut)]
    pub user_usdc: Account<'info, TokenAccount>,

    /// CHECK: This is the CCTP Token Messenger Minter program account that we're calling via CPI
    #[account(mut)]
    pub token_messenger_minter: AccountInfo<'info>,

    /// CHECK: Event rent payer for CCTP events
    #[account(mut)]
    pub event_rent_payer: Signer<'info>,

    /// CHECK: Sender authority PDA for CCTP
    pub sender_authority_pda: AccountInfo<'info>,

    /// CHECK: Denylist account for CCTP
    pub denylist_account: AccountInfo<'info>,

    /// CHECK: Message transmitter account for CCTP
    #[account(mut)]
    pub message_transmitter: AccountInfo<'info>,

    /// CHECK: Token messenger account for CCTP
    pub token_messenger: AccountInfo<'info>,

    /// CHECK: Remote token messenger account for CCTP
    pub remote_token_messenger: AccountInfo<'info>,

    /// CHECK: Token minter account for CCTP
    pub token_minter: AccountInfo<'info>,

    /// CHECK: Local token account for CCTP
    #[account(mut)]
    pub local_token: AccountInfo<'info>,

    /// CHECK: Burn token mint account
    #[account(mut)]
    pub burn_token_mint: AccountInfo<'info>,

    /// CHECK: Message sent event data account
    #[account(mut)]
    pub message_sent_event_data: Signer<'info>,

    /// CHECK: Message transmitter program
    pub message_transmitter_program: AccountInfo<'info>,

    /// CHECK: Token messenger minter program
    pub token_messenger_minter_program: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,

    /// CHECK: System program
    pub system_program: AccountInfo<'info>,

    /// CHECK: Event authority for CCTP
    pub event_authority: AccountInfo<'info>,

    /// CHECK: Program account
    pub program: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct BridgeContext<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut)]
    pub user_usdc: Account<'info, TokenAccount>,

    #[account(mut)]
    pub vault_usdc: Account<'info, TokenAccount>,

    #[account(mut)]
    pub fee_usdc: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}


#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct CctpMinterInvokeParams{
    pub amount: u64,
    pub destination_domain: u32,
    pub mint_recipient: Pubkey,
    pub destination_caller: Pubkey,
    pub max_fee: u64,
    pub min_finality_threshold: u32,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct DepositForBurnParams {
    pub amount: u64,
    pub destination_domain: u32,
    pub recipient: [u8; 32],
}

#[error_code]
pub enum ErrorCode {
    #[msg("Fee must be less than total amount")]
    InvalidFee,
    #[msg("Invalid destination domain")]
    InvalidDestinationDomain,
    #[msg("Invalid recipient address")]
    InvalidRecipient,
    #[msg("CCTP transfer failed")]
    CctpTransferFailed,
}