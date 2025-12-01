# Friends Feature Setup

This guide explains how to set up the friends feature in your Guess the Number game.

## Database Setup

Run the following SQL scripts in your Supabase SQL Editor in order:

### 1. Create Friends Tables (setup-10-friends-tables.sql)

This creates the `friend_requests` and `friendships` tables, along with indexes and triggers.

```bash
# Copy and run the contents of:
database/setup/setup-10-friends-tables.sql
```

### 2. Set Up RLS Policies (setup-11-friends-policies.sql)

This sets up Row Level Security policies for the friends tables.

```bash
# Copy and run the contents of:
database/setup/setup-11-friends-policies.sql
```

## Features Included

### 1. **Friends List**
- View all your friends
- Invite friends directly to a game
- Remove friends (unfriend)

### 2. **Friend Requests**
- Send friend requests by searching usernames
- View incoming friend requests
- Accept or reject friend requests
- Cancel sent friend requests
- View sent requests (pending)

### 3. **User Search**
- Search for users by username
- Add friends by sending requests

### 4. **Game Invites**
- Invite friends directly to games from the Friends page
- Creates a game room and sends an invite
- Friend receives notification in their Invites page

## How to Use

1. **Access Friends Page**: Click on your profile menu → "Friends"

2. **Add Friends**:
   - Go to "Add Friends" tab
   - Search for a username
   - Click "Add Friend" to send a request

3. **Manage Requests**:
   - Go to "Requests" tab
   - Accept or reject incoming requests
   - Cancel sent requests

4. **Play with Friends**:
   - Go to "Friends" tab
   - Click "Invite to Game" next to a friend's name
   - You'll be redirected to the game room
   - Your friend receives the invite in their Invites page

## Database Schema

### friend_requests
```sql
id              BIGSERIAL PRIMARY KEY
from_user_id    UUID (references auth.users)
to_user_id      UUID (references auth.users)
status          TEXT ('pending', 'accepted', 'rejected')
created_at      TIMESTAMP
updated_at      TIMESTAMP
```

### friendships
```sql
id              BIGSERIAL PRIMARY KEY
user_id         UUID (references auth.users)
friend_id       UUID (references auth.users)
created_at      TIMESTAMP
```

## Notes

- Friendships are bidirectional (stored twice for query efficiency)
- When a friend request is accepted, friendships are automatically created via trigger
- Removing a friend deletes both sides of the friendship
- Friend requests prevent duplicates (unique constraint)
