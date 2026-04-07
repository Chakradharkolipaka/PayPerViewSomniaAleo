// video_access.aleo
// Role: Privacy entitlement layer.
// A ViewToken record proves the holder paid for exactly one view.
// The backend verifies the Aleo proof before releasing the decryption key.

program video_access.aleo;

record ViewToken {
    owner: address,       // buyer's Aleo address
    video_id: field,      // matches Somnia videoId (cast as field)
    token_id: u64,        // mirrors Somnia NFT tokenId for cross-chain linkage
    is_consumed: bool     // false at mint, consumed in-browser before view
}

// Transition: create a ViewToken for a paid view.
// Called in-browser after PayPerView.pay() confirms on Somnia.
// Inputs: viewer address, videoId, Somnia tokenId
transition grant_view(
    viewer: address,
    video_id: field,
    token_id: u64
) -> ViewToken {
    return ViewToken {
        owner: viewer,
        video_id: video_id,
        token_id: token_id,
        is_consumed: false
    };
}

// Transition: consume the token to unlock the view.
// Called once per view session. Produces a consumed record as proof.
transition consume_view(
    token: ViewToken
) -> ViewToken {
    // Enforce: only owner may consume
    assert_eq(token.owner, self.caller);
    // Enforce: not already consumed
    assert_eq(token.is_consumed, false);
    return ViewToken {
        owner: token.owner,
        video_id: token.video_id,
        token_id: token.token_id,
        is_consumed: true       // marks as spent
    };
}
