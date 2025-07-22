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

    // // New instruction to initiate cross-chain transfer via CCTP
    // pub fn invoke_cctp_token_messenger(
    //     ctx: Context<CctpTransfer>,
    //     params: CctpMinterInvokeParams,
    // ) -> Result<()> {
    //     // Convert string constants to Pubkeys
    //     let token_messenger_minter_program_id = Pubkey::from_str(TOKEN_MESSENGER_MINTER).unwrap();
    //     let message_transmitter_program_id = Pubkey::from_str(MESSAGE_TRANSMITTER).unwrap();
    //     let burn_token_mint = ctx.accounts.user_usdc.mint;

    //     // Derive CCTP PDAs
    //     let (token_messenger_pda, _) = pda_derivations::derive_token_messenger_pda(&token_messenger_minter_program_id);
    //     let (token_minter_pda, _) = pda_derivations::derive_token_minter_pda(&token_messenger_minter_program_id);
    //     let (local_token_pda, _) = pda_derivations::derive_local_token_pda(&token_messenger_minter_program_id, &burn_token_mint);
    //     let (remote_token_messenger_pda, _) = pda_derivations::derive_remote_token_messenger_pda(&token_messenger_minter_program_id, params.destination_domain);
    //     let (message_transmitter_pda, _) = pda_derivations::derive_message_transmitter_pda(&message_transmitter_program_id);
        
    //     // Log the derived PDAs for verification
    //     msg!("Token Messenger PDA: {}", token_messenger_pda);
    //     msg!("Token Minter PDA: {}", token_minter_pda);
    //     msg!("Local Token PDA: {}", local_token_pda);
    //     msg!("Remote Token Messenger PDA: {}", remote_token_messenger_pda);
    //     msg!("Message Transmitter PDA: {}", message_transmitter_pda);
        
    //     // TODO: Implement actual CCTP deposit_for_burn instruction call
    //     // This requires proper CCTP CPI implementation
        
    //     Ok(())
    // }

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

    pub token_program: Program<'info, Token>,
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
    pub recipient: [u8; 32],
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