create extension if not exists pgcrypto;

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  phone_number text unique,
  username text unique,
  display_name text not null,
  avatar_url text,
  about text,
  last_seen_at timestamptz,
  is_online boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('direct', 'group')),
  title text,
  avatar_url text,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists conversation_members (
  conversation_id uuid not null references conversations(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  muted_until timestamptz,
  archived_at timestamptz,
  pinned_at timestamptz,
  primary key (conversation_id, user_id)
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id uuid not null references users(id),
  type text not null check (type in ('text', 'image', 'audio', 'video', 'file', 'system')),
  body text,
  media_url text,
  reply_to_message_id uuid references messages(id),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);

create table if not exists message_status (
  message_id uuid not null references messages(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  status text not null check (status in ('sent', 'delivered', 'read', 'failed')),
  updated_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create table if not exists calls (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  caller_id uuid not null references users(id),
  type text not null check (type in ('audio', 'video')),
  status text not null check (status in ('ringing', 'accepted', 'rejected', 'missed', 'ended')),
  started_at timestamptz not null default now(),
  ended_at timestamptz
);

create table if not exists call_participants (
  call_id uuid not null references calls(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  status text not null check (status in ('ringing', 'accepted', 'rejected', 'missed', 'ended')),
  joined_at timestamptz,
  left_at timestamptz,
  primary key (call_id, user_id)
);

create table if not exists media_files (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references users(id),
  conversation_id uuid references conversations(id) on delete set null,
  message_id uuid references messages(id) on delete set null,
  type text not null check (type in ('image', 'audio', 'video', 'file', 'avatar')),
  url text not null,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

create index if not exists users_phone_number_idx on users(phone_number);
create index if not exists users_username_idx on users(username);
create index if not exists conversations_updated_at_idx on conversations(updated_at desc);
create index if not exists conversation_members_user_id_idx on conversation_members(user_id);
create index if not exists messages_conversation_created_at_idx on messages(conversation_id, created_at desc);
create index if not exists message_status_user_id_idx on message_status(user_id);
create index if not exists calls_conversation_started_at_idx on calls(conversation_id, started_at desc);
create index if not exists media_files_owner_id_idx on media_files(owner_id);

drop trigger if exists users_set_updated_at on users;
create trigger users_set_updated_at
before update on users
for each row execute function set_updated_at();

drop trigger if exists conversations_set_updated_at on conversations;
create trigger conversations_set_updated_at
before update on conversations
for each row execute function set_updated_at();
