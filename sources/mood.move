module mood_addr::moodmap {
    use std::signer;
    use std::vector;
    use std::string::{Self, String};
    use aptos_framework::timestamp;
    use aptos_framework::event;

    // Error codes
    const E_INVALID_MOOD: u64 = 1;
    const E_MOODMAP_NOT_INITIALIZED: u64 = 2;

    // Mood values (0-4 for simplicity)
    const MOOD_TERRIBLE: u8 = 0;
    const MOOD_SAD: u8 = 1;
    const MOOD_NEUTRAL: u8 = 2;
    const MOOD_HAPPY: u8 = 3;
    const MOOD_ECSTATIC: u8 = 4;

    // Individual mood entry
    struct MoodEntry has copy, drop, store {
        user: address,
        mood: u8,
        timestamp: u64,
        message: String,
    }

    // Global mood tracker resource
    struct MoodMap has key {
        moods: vector<MoodEntry>,
        mood_count: vector<u64>, // Count for each mood type [terrible, sad, neutral, happy, ecstatic]
        total_entries: u64,
    }

    // Events
    #[event]
    struct MoodSetEvent has copy, drop, store {
        user: address,
        mood: u8,
        message: String,
        timestamp: u64,
    }

    #[event]
    struct MoodMapInitialized has copy, drop, store {
        initializer: address,
        timestamp: u64,
    }

    // Initialize the mood map (call this first)
    public entry fun initialize(admin: &signer) {
        let admin_addr = signer::address_of(admin);
        
        // Initialize mood count vector with zeros
        let mood_count = vector::empty<u64>();
        vector::push_back(&mut mood_count, 0); // terrible
        vector::push_back(&mut mood_count, 0); // sad
        vector::push_back(&mut mood_count, 0); // neutral
        vector::push_back(&mut mood_count, 0); // happy
        vector::push_back(&mut mood_count, 0); // ecstatic

        let mood_map = MoodMap {
            moods: vector::empty<MoodEntry>(),
            mood_count,
            total_entries: 0,
        };

        move_to(admin, mood_map);

        // Emit initialization event
        event::emit(MoodMapInitialized {
            initializer: admin_addr,
            timestamp: timestamp::now_seconds(),
        });
    }

    // Set user's mood
    public entry fun set_mood(
        user: &signer,
        mood: u8,
        message_bytes: vector<u8>
    ) acquires MoodMap {
        // Validate mood value
        assert!(mood <= MOOD_ECSTATIC, E_INVALID_MOOD);

        let user_addr = signer::address_of(user);
        let message = string::utf8(message_bytes);
        let current_time = timestamp::now_seconds();

        // Get the mood map (assuming it's stored at the module address)
        assert!(exists<MoodMap>(@mood_addr), E_MOODMAP_NOT_INITIALIZED);
        let mood_map = borrow_global_mut<MoodMap>(@mood_addr);

        // Create new mood entry
        let mood_entry = MoodEntry {
            user: user_addr,
            mood,
            timestamp: current_time,
            message,
        };

        // Check if user already has a mood entry, update or add
        let user_mood_index_opt = find_user_mood_index(&mood_map.moods, user_addr);
        
        if (vector::length(&user_mood_index_opt) > 0) {
            // User exists, update their mood
            let index = *vector::borrow(&user_mood_index_opt, 0);
            let old_mood_entry = vector::borrow(&mood_map.moods, index);
            let old_mood = old_mood_entry.mood;
            
            // Decrease count for old mood
            let old_count = vector::borrow_mut(&mut mood_map.mood_count, (old_mood as u64));
            *old_count = *old_count - 1;
            
            // Update the mood entry
            *vector::borrow_mut(&mut mood_map.moods, index) = mood_entry;
        } else {
            // New user, add new entry
            vector::push_back(&mut mood_map.moods, mood_entry);
            mood_map.total_entries = mood_map.total_entries + 1;
        };

        // Increase count for new mood
        let new_count = vector::borrow_mut(&mut mood_map.mood_count, (mood as u64));
        *new_count = *new_count + 1;

        // Emit mood set event
        event::emit(MoodSetEvent {
            user: user_addr,
            mood,
            message,
            timestamp: current_time,
        });
    }

    // Helper function to find user's mood index
    fun find_user_mood_index(moods: &vector<MoodEntry>, user_addr: address): vector<u64> {
        let result = vector::empty<u64>();
        let len = vector::length(moods);
        let i = 0;
        
        while (i < len) {
            let mood_entry = vector::borrow(moods, i);
            if (mood_entry.user == user_addr) {
                vector::push_back(&mut result, i);
                break
            };
            i = i + 1;
        };
        
        result
    }

    // View functions for frontend

    #[view]
    public fun get_mood_counts(): vector<u64> acquires MoodMap {
        assert!(exists<MoodMap>(@mood_addr), E_MOODMAP_NOT_INITIALIZED);
        let mood_map = borrow_global<MoodMap>(@mood_addr);
        mood_map.mood_count
    }

    #[view]
    public fun get_total_entries(): u64 acquires MoodMap {
        assert!(exists<MoodMap>(@mood_addr), E_MOODMAP_NOT_INITIALIZED);
        let mood_map = borrow_global<MoodMap>(@mood_addr);
        mood_map.total_entries
    }

    #[view]
    public fun get_user_mood(user_addr: address): (u8, String, u64) acquires MoodMap {
        assert!(exists<MoodMap>(@mood_addr), E_MOODMAP_NOT_INITIALIZED);
        let mood_map = borrow_global<MoodMap>(@mood_addr);
        
        let user_mood_index_opt = find_user_mood_index(&mood_map.moods, user_addr);
        if (vector::length(&user_mood_index_opt) > 0) {
            let index = *vector::borrow(&user_mood_index_opt, 0);
            let mood_entry = vector::borrow(&mood_map.moods, index);
            (mood_entry.mood, mood_entry.message, mood_entry.timestamp)
        } else {
            // Return default values if user hasn't set mood
            (MOOD_NEUTRAL, string::utf8(b"No mood set"), 0)
        }
    }

    #[view]
    public fun get_recent_moods(limit: u64): vector<MoodEntry> acquires MoodMap {
        assert!(exists<MoodMap>(@mood_addr), E_MOODMAP_NOT_INITIALIZED);
        let mood_map = borrow_global<MoodMap>(@mood_addr);
        
        let result = vector::empty<MoodEntry>();
        let len = vector::length(&mood_map.moods);
        let start_index = if (len > limit) { len - limit } else { 0 };
        
        let i = start_index;
        while (i < len) {
            let mood_entry = *vector::borrow(&mood_map.moods, i);
            vector::push_back(&mut result, mood_entry);
            i = i + 1;
        };
        
        result
    }

    #[view]
    public fun get_mood_percentage(mood: u8): u64 acquires MoodMap {
        assert!(mood <= MOOD_ECSTATIC, E_INVALID_MOOD);
        assert!(exists<MoodMap>(@mood_addr), E_MOODMAP_NOT_INITIALIZED);
        
        let mood_map = borrow_global<MoodMap>(@mood_addr);
        
        if (mood_map.total_entries == 0) {
            return 0
        };
        
        let mood_count = *vector::borrow(&mood_map.mood_count, (mood as u64));
        (mood_count * 100) / mood_map.total_entries
    }

    // Utility function to get mood name as string
    #[view]
    public fun get_mood_name(mood: u8): String {
        if (mood == MOOD_TERRIBLE) {
            string::utf8(b"Terrible")
        } else if (mood == MOOD_SAD) {
            string::utf8(b"Sad")
        } else if (mood == MOOD_NEUTRAL) {
            string::utf8(b"Neutral")
        } else if (mood == MOOD_HAPPY) {
            string::utf8(b"Happy")
        } else if (mood == MOOD_ECSTATIC) {
            string::utf8(b"Ecstatic")
        } else {
            string::utf8(b"Unknown")
        }
    }
}