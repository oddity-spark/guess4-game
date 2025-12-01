# 🗄️ Database Setup

This directory contains all SQL files needed to set up your Supabase database.

## 📋 Setup Order

Run these files **in order** in your Supabase SQL Editor:

### Required Files (1-7)

| File | Description | Time |
|------|-------------|------|
| `setup-1-tables.sql` | Creates core tables (user_profiles, user_stats, game_invites) | ~1s |
| `setup-2-game-rooms-updates.sql` | Adds user tracking to game_rooms table | ~1s |
| `setup-3-indexes.sql` | Creates performance indexes | ~1s |
| `setup-4-rls.sql` | Enables Row Level Security | ~1s |
| `setup-5-policies-profiles.sql` | Security policies for user_profiles | ~1s |
| `setup-6-policies-stats.sql` | Security policies for user_stats | ~1s |
| `setup-7-policies-invites.sql` | Security policies for game_invites | ~1s |

### Important Files (8-10) ⭐

| File | Description | Why Important |
|------|-------------|---------------|
| `setup-8-trigger-function.sql` | Auto-creates user profiles on signup | **Without this, signups will fail!** |
| `setup-9-stats-function.sql` | Auto-updates stats when games end | **Without this, stats won't track!** |
| `setup-10-leaderboard-function.sql` | Provides leaderboard queries | Needed for stats page |

## 🚀 Quick Setup

### Option 1: Using Supabase Dashboard (Recommended)

1. Open **Supabase Dashboard** → **SQL Editor**
2. Click **New Query**
3. Copy the contents of `setup-1-tables.sql`
4. Paste and click **Run**
5. Wait for "Success" message
6. Repeat for files 2-10

**Total time: ~2-3 minutes**

### Option 2: Using Supabase CLI

```bash
# Install CLI
npm install -g supabase

# Login
supabase login

# Link project
supabase link --project-ref YOUR_PROJECT_REF

# Run all files
for file in database/setup/setup-*.sql; do
  supabase db push "$file"
done
```

## ✅ Verification

After running all files, verify in Supabase Dashboard:

### Tables Created
- [ ] `game_rooms` (with player1_id, player2_id columns)
- [ ] `user_profiles`
- [ ] `user_stats`
- [ ] `game_invites`

### Functions Created
- [ ] `handle_new_user()` - Creates profiles on signup
- [ ] `update_user_stats_after_game()` - Updates stats
- [ ] `get_leaderboard()` - Fetches top players

### Trigger Created
- [ ] `on_auth_user_created` on `auth.users` table

### RLS Enabled
- [ ] `user_profiles` has RLS enabled
- [ ] `user_stats` has RLS enabled
- [ ] `game_invites` has RLS enabled

## 🐛 Troubleshooting

### "Table already exists"
This is fine! The SQL uses `IF NOT EXISTS`. Just continue to the next file.

### "Column already exists"
This is fine! The SQL uses `IF NOT EXISTS`. Continue to the next file.

### "Policy already exists"
This is fine! The SQL drops old policies before creating new ones.

### "504 Gateway Timeout"
The file is too large for your connection. Wait 30 seconds and try again.

### Signup fails with "Database error"
- Make sure you ran `setup-8-trigger-function.sql`
- Check that the trigger exists in Database → Triggers

### Stats not updating
- Make sure you ran `setup-9-stats-function.sql`
- Check that the function exists in Database → Functions

## 🔐 Security Notes

### RLS Policies

The setup creates secure Row Level Security policies:

- **user_profiles**:
  - Anyone can SELECT (view profiles)
  - Anyone can INSERT (needed for signup trigger)
  - Users can only UPDATE their own profile

- **user_stats**:
  - Anyone can SELECT (needed for leaderboard)
  - Anyone can INSERT (needed for signup trigger)
  - Users can only UPDATE their own stats

- **game_invites**:
  - Users can only see invites they sent or received
  - Only sender can create invites
  - Only recipient can accept/decline

### Function Security

- `handle_new_user()` runs with `SECURITY DEFINER` to bypass RLS during signup
- `update_user_stats_after_game()` runs with `SECURITY DEFINER` to update any player's stats
- `get_leaderboard()` runs with `SECURITY DEFINER` to read all stats

## 📚 Database Schema

### game_rooms
```sql
- id (BIGSERIAL)
- room_code (TEXT, unique)
- player1_id (UUID, references user_profiles)
- player2_id (UUID, references user_profiles)
- player1_secret, player1_guesses, player1_ready
- player2_secret, player2_guesses, player2_ready
- current_turn, game_started, winner
- finished_at (TIMESTAMP)
- created_at (TIMESTAMP)
```

### user_profiles
```sql
- id (UUID, references auth.users)
- username (TEXT, unique)
- display_name (TEXT)
- avatar_url (TEXT)
- created_at, updated_at (TIMESTAMP)
```

### user_stats
```sql
- user_id (UUID, references user_profiles)
- total_games, games_won, games_lost, games_tied
- total_guesses, best_guess_count
- current_streak, longest_streak
- last_played_at, created_at, updated_at
```

### game_invites
```sql
- id (BIGSERIAL)
- room_code (TEXT, references game_rooms)
- from_user_id, to_user_id (UUID, references user_profiles)
- status (TEXT: 'pending', 'accepted', 'declined')
- created_at, expires_at (TIMESTAMP)
```

## 🔄 Updating Database

If you need to make changes:

1. **Modify the appropriate setup file**
2. **Re-run that file** in Supabase SQL Editor
3. The `IF EXISTS` and `IF NOT EXISTS` clauses prevent conflicts

## 📞 Need Help?

See main documentation:
- [Setup Instructions](../docs/SETUP_INSTRUCTIONS.md) - Detailed guide
- [Troubleshooting](../docs/TROUBLESHOOTING.md) - Common issues
- [README](../README.md) - Project overview
