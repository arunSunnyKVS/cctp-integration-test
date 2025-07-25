/*
 * Copyright (c) 2025, Circle Internet Financial LTD All Rights Reserved.
 *
 * SPDX-License-Identifier: Apache-2.0
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

//! Initialize instruction handler

use {
    crate::{
        program,
        token_messenger_v2::{error::TokenMessengerError, state::TokenMessenger},
        token_minter_v2::{
            error::TokenMinterError, events::SetTokenController, state::TokenMinter,
        },
    },
    anchor_lang::prelude::*,
    message_transmitter_v2::utils,
};

// Instruction accounts
#[event_cpi]
#[derive(Accounts)]
pub struct InitializeContext<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account()]
    pub upgrade_authority: Signer<'info>,

    /// CHECK: empty PDA, used to check that sendMessage was called by TokenMessenger
    #[account(
        seeds = [b"sender_authority"],
        bump
    )]
    pub authority_pda: UncheckedAccount<'info>,

    // TokenMessenger state account
    #[account(
        init,
        payer = payer,
        space = utils::DISCRIMINATOR_SIZE + TokenMessenger::INIT_SPACE,
        seeds = [b"token_messenger"],
        bump
    )]
    pub token_messenger: Box<Account<'info, TokenMessenger>>,

    // TokenMinter state account
    #[account(
        init,
        payer = payer,
        space = utils::DISCRIMINATOR_SIZE + TokenMinter::INIT_SPACE,
        seeds = [b"token_minter"],
        bump
    )]
    pub token_minter: Box<Account<'info, TokenMinter>>,

    // Ensure only upgrade_authority can call initialize
    #[account(constraint = token_messenger_minter_program_data.upgrade_authority_address == Some(upgrade_authority.key()))]
    pub token_messenger_minter_program_data: Account<'info, ProgramData>,

    pub token_messenger_minter_program: Program<'info, program::TokenMessengerMinterV2>,

    pub system_program: Program<'info, System>,
}

// Instruction parameters
#[derive(AnchorSerialize, AnchorDeserialize, Copy, Clone)]
pub struct InitializeParams {
    pub token_controller: Pubkey,
    pub denylister: Pubkey,
    pub fee_recipient: Pubkey,
    pub min_fee_controller: Pubkey,
    pub min_fee: u32,
    pub message_body_version: u32,
}

// Instruction handler
pub fn initialize(ctx: Context<InitializeContext>, params: &InitializeParams) -> Result<()> {
    // Validate token_messenger_minter_program_data
    if let Some(programdata_address) = ctx
        .accounts
        .token_messenger_minter_program
        .programdata_address()?
    {
        require_keys_eq!(
            programdata_address,
            ctx.accounts.token_messenger_minter_program_data.key(),
            ErrorCode::InvalidProgramExecutable
        );
    }

    // record token_messenger state
    let authority = ctx.accounts.upgrade_authority.key();
    let token_messenger = ctx.accounts.token_messenger.as_mut();
    token_messenger.owner = authority;
    token_messenger.pending_owner = Pubkey::default();
    token_messenger.denylister = params.denylister;
    token_messenger.fee_recipient = params.fee_recipient;
    token_messenger.min_fee_controller = params.min_fee_controller;
    token_messenger.min_fee = params.min_fee;
    token_messenger.message_body_version = params.message_body_version;
    token_messenger.authority_bump = ctx.bumps.authority_pda;

    // validate the state
    require!(
        token_messenger.validate(),
        TokenMessengerError::InvalidTokenMessengerState
    );

    // record token_minter state
    let token_minter = ctx.accounts.token_minter.as_mut();
    token_minter.token_controller = params.token_controller;
    token_minter.pauser = authority;
    token_minter.paused = false;
    token_minter.bump = ctx.bumps.token_minter;

    // validate the state
    require!(
        token_minter.validate(),
        TokenMinterError::InvalidTokenMinterState
    );

    emit_cpi!(SetTokenController {
        token_controller: params.token_controller
    });

    Ok(())
}
