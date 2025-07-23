#![allow(warnings)]
use anchor_lang::prelude::*;
use anchor_lang::solana_program::{instruction::{Instruction, AccountMeta}, program::invoke};
use anchor_spl::token::{self, Token, TokenAccount, Transfer, transfer, Mint};
use token_messenger_minter_v2::token_messenger_v2::instructions::{DepositForBurnContext, DepositForBurnParams};
use message_transmitter_v2::instructions::{SendMessageContext, SendMessageParams};
// use token_messenger_minter_v2::cpi::accounts::DepositForBurn;
// // use token_messenger_minter_v2::instruction::DepositForBurn;
// use token_messenger_minter_v2::cpi::deposit_for_burn;
// use token_messenger_minter_v2::program::TokenMessengerMinterV2;

use token_messenger_minter_v2::cpi::deposit_for_burn;
use token_messenger_minter_v2::program::TokenMessengerMinterV2;


declare_id!("CABbkyFnKoZ9UpRnBu8YFaCBdBG1xMZPMuc6GmrnogbT");

#[program]
pub mod bridging_kit {
    use token_messenger_minter_v2::cpi::accounts::DepositForBurnContext;

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
        params: DepositForBurnParams,
    ) -> Result<()> {
        // Instruction discriminator for deposit_for_burn
        const DEPOSIT_FOR_BURN_DISCRIMINATOR: [u8; 8] = [215, 60, 61, 46, 114, 55, 128, 176];
        
        // Create instruction data for deposit_for_burn
        let mut data = Vec::new();
        data.extend_from_slice(&DEPOSIT_FOR_BURN_DISCRIMINATOR);
        data.extend_from_slice(&params.amount.to_le_bytes());
        data.extend_from_slice(&params.destination_domain.to_le_bytes());
        data.extend_from_slice(&params.mint_recipient.to_bytes());
        data.extend_from_slice(&params.destination_caller.to_bytes());
        data.extend_from_slice(&params.max_fee.to_le_bytes());
        data.extend_from_slice(&params.min_finality_threshold.to_le_bytes());
        
        // Create account metas for the deposit_for_burn instruction
        let account_metas = vec![
            AccountMeta::new(ctx.accounts.user.key(), true), // owner
            AccountMeta::new(ctx.accounts.event_rent_payer.key(), true), // event_rent_payer
            AccountMeta::new_readonly(ctx.accounts.sender_authority_pda.key(), false), // sender_authority_pda
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
        ];

        let instruction = Instruction {
            program_id: ctx.accounts.token_messenger_minter_program.key(),
            accounts: account_metas,
            data: data,
        };

        // Execute the CPI call
        invoke(&instruction, &account_infos)?;
        
        msg!("CCTP deposit_for_burn instruction executed successfully");
        Ok(())
    }

    pub fn invoke_cctp_token_messenger_minter(
        ctx: Context<CctpTransfer>,
        params: DepositForBurnParams,
    ) -> Result<()> {
        let cpi_accounts = DepositForBurnContext {
            owner: ctx.accounts.user.to_account_info(),
            event_rent_payer: ctx.accounts.event_rent_payer.to_account_info(),
            sender_authority_pda: ctx.accounts.sender_authority_pda.to_account_info(),
            burn_token_account: ctx.accounts.user_usdc.to_account_info(),
            denylist_account: ctx.accounts.denylist_account.to_account_info(),
            message_transmitter: ctx.accounts.message_transmitter.to_account_info(),
            token_messenger: ctx.accounts.token_messenger.to_account_info(),
            remote_token_messenger: ctx.accounts.remote_token_messenger.to_account_info(),
            token_minter: ctx.accounts.token_minter.to_account_info(),
            local_token: ctx.accounts.local_token.to_account_info(),
            burn_token_mint: ctx.accounts.burn_token_mint.to_account_info(),
            message_sent_event_data: ctx.accounts.message_sent_event_data.to_account_info(),
            message_transmitter_program: ctx.accounts.message_transmitter_program.to_account_info(),
            token_messenger_minter_program: ctx.accounts.token_messenger_minter_program.to_account_info(),
            token_program: ctx.accounts.token_program.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
            event_authority: ctx.accounts.event_authority.to_account_info(),
            program: ctx.accounts.program.to_account_info(),
        };
    
        let cpi_program = ctx.accounts.token_messenger_minter_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    
        let params = DepositForBurnParams {
            amount: params.amount,
            destination_domain: params.destination_domain,
            mint_recipient: params.mint_recipient,
            destination_caller: Pubkey::default(), // or your destination caller
            max_fee: params.max_fee,
            min_finality_threshold: params.min_finality_threshold,
        };
    
        deposit_for_burn(cpi_ctx, params)?;
        Ok(())
    }


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

    /// CHECK: Denylist account for CCTP
    pub denylist_account: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct MessageTransmitterSendContext<'info> {
    /// CHECK: Event rent payer for message transmitter events
    #[account(mut)]
    pub event_rent_payer: Signer<'info>,

    /// CHECK: Sender authority PDA for message transmitter
    pub sender_authority_pda: AccountInfo<'info>,

    /// CHECK: Message transmitter account
    #[account(mut)]
    pub message_transmitter: AccountInfo<'info>,

    /// CHECK: Message sent event data account
    #[account(mut)]
    pub message_sent_event_data: Signer<'info>,

    /// CHECK: Sender program (e.g., TokenMessenger)
    pub sender_program: AccountInfo<'info>,

    /// CHECK: System program
    pub system_program: AccountInfo<'info>,

    /// CHECK: Message transmitter program
    pub message_transmitter_program: AccountInfo<'info>,
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