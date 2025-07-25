use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer, transfer};
use token_messenger_minter_v2::token_messenger_v2::instructions::DepositForBurnParams;
use token_messenger_minter_v2::cpi::accounts::DepositForBurnContext;
use token_messenger_minter_v2::cpi::deposit_for_burn;

declare_id!("CABbkyFnKoZ9UpRnBu8YFaCBdBG1xMZPMuc6GmrnogbT");

#[program]
pub mod cctpintegration {
    use super::*;

    /// Transfer tokens with fee deduction to vault and fee recipient
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

    /// Initiate cross-chain transfer via CCTP using proper CPI
    pub fn deposit_for_burn_cctp(
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
    
        deposit_for_burn(cpi_ctx, params)?;
        
        msg!("CCTP deposit_for_burn executed successfully");
        Ok(())
    }
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

#[derive(Accounts)]
pub struct CctpTransfer<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut)]
    pub user_usdc: Account<'info, TokenAccount>,

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