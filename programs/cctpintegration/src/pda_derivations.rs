use anchor_lang::prelude::*;

pub fn derive_token_messenger_pda(program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"token_messenger"], program_id)
}

pub fn derive_token_minter_pda(program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"token_minter"], program_id)
}

pub fn derive_local_token_pda(program_id: &Pubkey, mint: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"local_token", mint.as_ref()], program_id)
}

pub fn derive_remote_token_messenger_pda(program_id: &Pubkey, domain: u32) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"remote_token_messenger", &domain.to_le_bytes()], program_id)
}

pub fn derive_sender_authority_pda(program_id: &Pubkey, authority_bump: u8) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"sender_authority"], program_id)
}

pub fn derive_message_transmitter_pda(program_id: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"message_transmitter"], program_id)
}