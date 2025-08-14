module 0x2f1c1fd6bfee09912c4f59306c98f3a23dfd555cb637c5c297a86b9e9c78ebe9::moodmap {
    use std::vector;
    use std::string::{Self, String};
    use aptos_framework::timestamp;
    use aptos_framework::event;

    // === Errors ===
    const E_NOT_INITIALIZED: u64 = 1;
    const E_INVALID_MOOD_VALUE: u64 = 2;
    const E_NO_MOOD_HISTORY: u64 = 3;

    // === Structs ===

    struct MoodEntry has store, drop, copy {
        user: address,
        mood: u8,
        message: String,
        timestamp: u64,
    }

    struct UserMood has key {
        last_mood: MoodEntry,
        history: vector<MoodEntry>,
    }

    struct MoodStats has key {
        mood_counts: vector<u64>,
        total_entries: u64,
        unique_users: vector<address>,
    }

    // === Events ===

    struct MoodUpdateEvent has drop, store {
        user: address,
        mood: u8,
        message: String,
        timestamp: u64,
    }

    // === Public Functions ===

    public entry fun init_module(sender: &signer) {
        let sender_addr = signer::address_of(sender);
        assert!(sender_addr == @0x2f1c1fd6bfee09912c4f59306c98f3a23dfd555cb637c5c297a86b9e9c78ebe9, 0); // Only deployer can init
        move_to(sender, MoodStats {
            mood_counts: vector[0, 0, 0, 0, 0],
            total_entries: 0,
            unique_users: vector::empty<address>(),
        });
    }

    public entry fun set_mood(sender: &signer, mood: u8, message_bytes: vector<u8>) {
        assert!(exists<MoodStats>(@0x2f1c1fd6bfee09912c4f59306c98f3a23dfd555cb637c5c297a86b9e9c78ebe9), E_NOT_INITIALIZED);
        assert!(mood < 5, E_INVALID_MOOD_VALUE);

        let user_addr = signer::address_of(sender);
        let stats = borrow_global_mut<MoodStats>(@0x2f1c1fd6bfee09912c4f59306c98f3a23dfd555cb637c5c297a86b9e9c78ebe9);
        let message = string::utf8(message_bytes);

        let new_entry = MoodEntry {
            user: user_addr,
            mood,
            message: copy message,
            timestamp: timestamp::now_seconds(),
        };

        // Update or create user's mood history
        if (exists<UserMood>(user_addr)) {
            let user_mood = borrow_global_mut<UserMood>(user_addr);
            let old_mood_value = user_mood.last_mood.mood;
            stats.mood_counts[old_mood_value] = stats.mood_counts[old_mood_value] - 1;
            vector::push_back(&mut user_mood.history, user_mood.last_mood);
            user_mood.last_mood = new_entry;
        } else {
            move_to(sender, UserMood {
                last_mood: new_entry,
                history: vector::empty<MoodEntry>(),
            });
            vector::push_back(&mut stats.unique_users, user_addr);
        };

        // Update stats
        stats.mood_counts[mood] = stats.mood_counts[mood] + 1;
        stats.total_entries = stats.total_entries + 1;

        // Emit event
        event::emit<MoodUpdateEvent>(MoodUpdateEvent {
            user: user_addr,
            mood,
            message,
            timestamp: new_entry.timestamp,
        });
    }

    // === View Functions ===

    #[view]
    public fun get_mood_counts(): vector<u64> {
        assert!(exists<MoodStats>(@0x2f1c1fd6bfee09912c4f59306c98f3a23dfd555cb637c5c297a86b9e9c78ebe9), E_NOT_INITIALIZED);
        borrow_global<MoodStats>(@0x2f1c1fd6bfee09912c4f59306c98f3a23dfd555cb637c5c297a86b9e9c78ebe9).mood_counts
    }

    #[view]
    public fun get_total_entries(): u64 {
        assert!(exists<MoodStats>(@0x2f1c1fd6bfee09912c4f59306c98f3a23dfd555cb637c5c297a86b9e9c78ebe9), E_NOT_INITIALIZED);
        borrow_global<MoodStats>(@0x2f1c1fd6bfee09912c4f59306c98f3a23dfd555cb637c5c297a86b9e9c78ebe9).total_entries
    }

    #[view]
    public fun get_user_mood(user: address): (u8, vector<u8>, u64) {
        assert!(exists<UserMood>(user), E_NO_MOOD_HISTORY);
        let user_mood = borrow_global<UserMood>(user);
        let last_mood = user_mood.last_mood;
        (last_mood.mood, string::bytes(&last_mood.message), last_mood.timestamp)
    }

    #[view]
    public fun get_user_mood_history(user: address): vector<(u8, vector<u8>, u64)> {
        assert!(exists<UserMood>(user), E_NO_MOOD_HISTORY);
        let user_mood = borrow_global<UserMood>(user);
        let history = &user_mood.history;
        let len = vector::length(history);
        let mut result = vector::empty<(u8, vector<u8>, u64)>();

        // Add last_mood first
        let last_mood = &user_mood.last_mood;
        vector::push_back(&mut result, (last_mood.mood, string::bytes(&last_mood.message), last_mood.timestamp));

        let mut i = 0;
        while (i < len) {
            let entry = vector::borrow(history, i);
            vector::push_back(&mut result, (entry.mood, string::bytes(&entry.message), entry.timestamp));
            i = i + 1;
        };
        result
    }
}