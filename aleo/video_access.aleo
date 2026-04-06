program video_access.aleo;

// Replace with your deployed admin address before testnet deployment.
const PROGRAM_ADMIN: address = aleo1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqd9h8a;

record VideoAccess {
    owner: address,
    video_id: field,
    encrypted_url: [u128; 4],
    expires_at: u32,
}

transition grant_access(public video_id: field, encrypted_url: [u128; 4], recipient: address) -> VideoAccess {
    let expires_at: u32 = block.height + 43200u32;

    return VideoAccess {
        owner: recipient,
        video_id: video_id,
        encrypted_url: encrypted_url,
        expires_at: expires_at,
    };
}

transition revoke_access(access: VideoAccess) {
    assert_eq(self.caller, PROGRAM_ADMIN);
    // Consuming the record revokes access permanently for this record instance.
    let _burned_owner = access.owner;
}
