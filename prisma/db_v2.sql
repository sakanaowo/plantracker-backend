-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS btree_gist; -- cho exclusion constraint (không overlap time)

-- -------------------------------------------
-- Helper: auto-update updated_at
-- -------------------------------------------
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- -------------------------------------------
-- Enums (idempotent)
-- -------------------------------------------
DO $$ BEGIN
  CREATE TYPE role AS ENUM ('OWNER','ADMIN','MEMBER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE priority AS ENUM ('LOW','MEDIUM','HIGH');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE provider AS ENUM ('GOOGLE_CALENDAR','OUTLOOK','ZOOM','SLACK');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE participant_status AS ENUM ('INVITED','ACCEPTED','DECLINED','TENTATIVE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE email_status AS ENUM ('QUEUED','SENT','FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE token_status AS ENUM ('ACTIVE','REVOKED','EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM ('TASK_ASSIGNED','TASK_MOVED','TIME_REMINDER','EVENT_INVITE','EVENT_UPDATED','MEETING_REMINDER','SYSTEM');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE notification_channel AS ENUM ('PUSH','IN_APP','EMAIL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE notification_status AS ENUM ('QUEUED','SENT','DELIVERED','READ','FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE platform AS ENUM ('ANDROID','IOS','WEB');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE notification_priority AS ENUM ('LOW','NORMAL','HIGH');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE workspace_type AS ENUM ('PERSONAL','TEAM');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Jira-min (dùng cho team, mobile có thể chưa dùng ngay)
DO $$ BEGIN
  CREATE TYPE issue_status AS ENUM ('TO_DO','IN_PROGRESS','IN_REVIEW','DONE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE issue_type AS ENUM ('TASK','STORY','BUG','EPIC','SUBTASK');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE issue_link_type AS ENUM ('BLOCKS','IS_BLOCKED_BY','RELATES','DUPLICATES','IS_DUPLICATED_BY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ===========================================
-- Core
-- ===========================================

-- USERS
CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          text NOT NULL,
  email         text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  avatar_url    text,
  created_at    timestamptz NOT NULL DEFAULT NOW(),
  updated_at    timestamptz NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE users IS 'Người dùng hệ thống';
COMMENT ON COLUMN users.email IS 'Duy nhất cho đăng nhập';
COMMENT ON COLUMN users.password_hash IS 'Băm mật khẩu (BCrypt/Argon2)';

CREATE OR REPLACE TRIGGER set_timestamp_users
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- WORKSPACES
CREATE TABLE IF NOT EXISTS workspaces (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       text NOT NULL,
  owner_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       workspace_type NOT NULL DEFAULT 'TEAM', -- PERSONAL/TEAM
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE workspaces IS 'Không gian làm việc (personal/team)';

CREATE OR REPLACE TRIGGER set_timestamp_workspaces
BEFORE UPDATE ON workspaces
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- MEMBERSHIPS
CREATE TABLE IF NOT EXISTS memberships (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  role          role NOT NULL,
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id  uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_at    timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, workspace_id)
);
COMMENT ON TABLE memberships IS 'Thành viên thuộc workspace với vai trò';

-- PROJECTS
CREATE TABLE IF NOT EXISTS projects (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name         text NOT NULL,
  description  text,
  key          varchar(10),                 -- ví dụ 'PT' cho issue_key
  issue_seq    int NOT NULL DEFAULT 0,      -- counter sinh issue_key
  board_type   varchar(10) NOT NULL DEFAULT 'KANBAN', -- 'KANBAN' | 'SCRUM'
  created_at   timestamptz NOT NULL DEFAULT NOW(),
  updated_at   timestamptz NOT NULL DEFAULT NOW()
);
COMMENT ON COLUMN projects.key IS 'Project key cho issue_key (vd PT-123)';

-- (tuỳ chọn) UNIQUE trong workspace: key
-- CREATE UNIQUE INDEX IF NOT EXISTS ux_projects_workspace_key ON projects(workspace_id, key);

CREATE OR REPLACE TRIGGER set_timestamp_projects
BEFORE UPDATE ON projects
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- BOARDS (Kanban columns)
CREATE TABLE IF NOT EXISTS boards (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name       text NOT NULL,
  "order"    int  NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE boards IS 'Cột Kanban (To Do / Doing / Done)';
CREATE INDEX IF NOT EXISTS idx_boards_project_order ON boards(project_id, "order");

CREATE OR REPLACE TRIGGER set_timestamp_boards
BEFORE UPDATE ON boards
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- TASKS (Kanban card / Jira-like issue tối thiểu)
CREATE TABLE IF NOT EXISTS tasks (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id   uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  board_id     uuid NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  title        text NOT NULL,
  description  text,
  assignee_id  uuid REFERENCES users(id) ON DELETE SET NULL,
  created_by   uuid REFERENCES users(id) ON DELETE SET NULL,
  due_at       timestamptz,
  start_at     timestamptz,
  priority     priority,
  position     numeric(10,3) NOT NULL DEFAULT 0, -- drag & drop mượt
  -- Jira-min (tuỳ dùng):
  issue_key    varchar(32),
  type         issue_type,
  status       issue_status DEFAULT 'TO_DO',
  sprint_id    uuid,
  epic_id      uuid,
  parent_task_id uuid,
  story_points int,
  original_estimate_sec int,
  remaining_estimate_sec int,
  created_at   timestamptz NOT NULL DEFAULT NOW(),
  updated_at   timestamptz NOT NULL DEFAULT NOW(),
  deleted_at   timestamptz
);
COMMENT ON TABLE tasks IS 'Thẻ công việc (Kanban) / Issue (Jira-min)';
COMMENT ON COLUMN tasks.position IS 'Thứ tự trong cột';
CREATE UNIQUE INDEX IF NOT EXISTS ux_tasks_issue_key ON tasks(issue_key);
CREATE INDEX IF NOT EXISTS idx_tasks_board_position ON tasks(board_id, position);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_at);

-- self-reference FK (epic/subtask)
DO $$
BEGIN
  ALTER TABLE tasks
    ADD CONSTRAINT fk_tasks_epic
    FOREIGN KEY (epic_id) REFERENCES tasks(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE tasks
    ADD CONSTRAINT fk_tasks_parent
    FOREIGN KEY (parent_task_id) REFERENCES tasks(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE TRIGGER set_timestamp_tasks
BEFORE UPDATE ON tasks
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- SPRINTS (tuỳ chọn, cho Scrum)
CREATE TABLE IF NOT EXISTS sprints (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name       text NOT NULL,
  goal       text,
  start_at   timestamptz,
  end_at     timestamptz,
  state      varchar(10) NOT NULL DEFAULT 'PLANNED', -- PLANNED/ACTIVE/CLOSED
  created_at timestamptz NOT NULL DEFAULT NOW()
);
DO $$
BEGIN
  ALTER TABLE tasks
    ADD CONSTRAINT fk_tasks_sprint
    FOREIGN KEY (sprint_id) REFERENCES sprints(id) ON DELETE SET NULL;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ISSUE LINKS (tuỳ chọn)
CREATE TABLE IF NOT EXISTS issue_links (
  source_task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  target_task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  link_type      issue_link_type NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (source_task_id, target_task_id, link_type)
);

-- WATCHERS (tuỳ chọn)
CREATE TABLE IF NOT EXISTS watchers (
  task_id  uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (task_id, user_id)
);

-- LABELS
CREATE TABLE IF NOT EXISTS labels (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name         text NOT NULL,
  color        text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT NOW(),
  updated_at   timestamptz NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE labels IS 'Nhãn dùng chung trong workspace';

CREATE OR REPLACE TRIGGER set_timestamp_labels
BEFORE UPDATE ON labels
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- TASK_LABELS (many-to-many)
CREATE TABLE IF NOT EXISTS task_labels (
  task_id  uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  label_id uuid NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, label_id)
);
COMMENT ON TABLE task_labels IS 'Gán nhãn cho task';

-- TIME_ENTRIES (timer như Clockify)
CREATE TABLE IF NOT EXISTS time_entries (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id      uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_at     timestamptz NOT NULL,
  end_at       timestamptz,
  duration_sec int,
  note         text,
  created_at   timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_time_entries_interval
    CHECK (end_at IS NULL OR end_at > start_at)
);
COMMENT ON TABLE time_entries IS 'Bản ghi thời gian làm việc (start/stop)';
CREATE INDEX IF NOT EXISTS idx_time_entries_user_start ON time_entries(user_id, start_at);

-- Chỉ cho phép 1 entry đang chạy / user
CREATE UNIQUE INDEX IF NOT EXISTS ux_time_running
ON time_entries(user_id)
WHERE end_at IS NULL;

-- Cấm overlap entries của cùng user (DB-level)
DO $$
BEGIN
  ALTER TABLE time_entries
    ADD CONSTRAINT ex_time_entries_no_overlap
    EXCLUDE USING GIST (
      user_id WITH =,
      tstzrange(start_at, COALESCE(end_at, 'infinity'::timestamptz), '[]') WITH &&
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- EVENTS (meetings)
CREATE TABLE IF NOT EXISTS events (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title       text NOT NULL,
  start_at    timestamptz NOT NULL,
  end_at      timestamptz NOT NULL,
  location    text,
  meet_link   text,
  created_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT NOW(),
  updated_at  timestamptz NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE events IS 'Sự kiện/lịch họp thuộc một project';

CREATE OR REPLACE TRIGGER set_timestamp_events
BEFORE UPDATE ON events
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- PARTICIPANTS
CREATE TABLE IF NOT EXISTS participants (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id   uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id    uuid REFERENCES users(id) ON DELETE SET NULL,
  email      text NOT NULL,
  status     participant_status,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, email)
);
COMMENT ON TABLE participants IS 'Người tham dự (nội bộ hoặc khách qua email)';

-- INTEGRATION_TOKENS (OAuth)
CREATE TABLE IF NOT EXISTS integration_tokens (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider         provider NOT NULL,
  account_email    text,
  external_user_id text,
  access_token     text NOT NULL, -- LƯU Ý: mã hoá/tối thiểu là at-rest encryption
  refresh_token    text,
  scope            text,
  token_type       text,
  expires_at       timestamptz,
  status           token_status NOT NULL,
  metadata         jsonb,
  created_at       timestamptz NOT NULL DEFAULT NOW(),
  updated_at       timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_integration_user_provider ON integration_tokens(user_id, provider);
COMMENT ON COLUMN integration_tokens.access_token IS 'Không log; nên mã hoá';

CREATE OR REPLACE TRIGGER set_timestamp_integration_tokens
BEFORE UPDATE ON integration_tokens
FOR EACH ROW EXECUTE FUNCTION trigger_set_timestamp();

-- EXTERNAL_EVENT_MAP (Google Calendar mapping)
CREATE TABLE IF NOT EXISTS external_event_map (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id          uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  provider          provider NOT NULL,
  provider_event_id text NOT NULL,
  html_link         text,
  etag              text,
  last_synced_at    timestamptz,
  UNIQUE (provider, provider_event_id)
);
CREATE INDEX IF NOT EXISTS idx_external_event_event ON external_event_map(event_id);
COMMENT ON TABLE external_event_map IS 'Ánh xạ event nội bộ ↔ sự kiện ngoài (Calendar)';

-- EMAIL_QUEUE
CREATE TABLE IF NOT EXISTS email_queue (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  to_email     text NOT NULL,
  subject      text NOT NULL,
  body         text NOT NULL,
  status       email_status NOT NULL,
  retry_count  int NOT NULL DEFAULT 0,
  last_error   text,
  scheduled_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_email_queue_sched ON email_queue(status, scheduled_at);
COMMENT ON TABLE email_queue IS 'Hàng đợi email (mời họp, thông báo)';

-- NOTIFICATIONS (push/in-app/email)
CREATE TABLE IF NOT EXISTS notifications (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type         notification_type NOT NULL,
  title        text NOT NULL,
  body         text,
  data         jsonb,
  channel      notification_channel NOT NULL,
  priority     notification_priority,
  status       notification_status NOT NULL,
  scheduled_at timestamptz,
  sent_at      timestamptz,
  delivered_at timestamptz,
  read_at      timestamptz,
  ttl_sec      int,
  deeplink     text,
  retry_count  int NOT NULL DEFAULT 0,
  last_error   text,
  created_at   timestamptz NOT NULL DEFAULT NOW(),
  created_by   uuid
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_sched ON notifications(user_id, status, scheduled_at);
COMMENT ON COLUMN notifications.data IS 'Payload JSON: {"task_id":"...","event_id":"...","deep_link":"app://..."}';

-- USER_DEVICES (FCM)
CREATE TABLE IF NOT EXISTS user_devices (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fcm_token     text NOT NULL UNIQUE,
  platform      platform NOT NULL DEFAULT 'ANDROID',
  device_model  text,
  app_version   text,
  locale        text,
  timezone      text,
  is_active     boolean NOT NULL DEFAULT TRUE,
  last_active_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_user_devices_user_active ON user_devices(user_id, is_active);
COMMENT ON TABLE user_devices IS 'Thiết bị người dùng để gửi push';

-- ===========================================
-- Optional Trello goodies (đã hỗ trợ trong thiết kế)
-- ===========================================

-- TASK_COMMENTS
CREATE TABLE IF NOT EXISTS task_comments (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id    uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_task_comments_task ON task_comments(task_id, created_at);
COMMENT ON TABLE task_comments IS 'Bình luận trong task';

-- CHECKLISTS
CREATE TABLE IF NOT EXISTS checklists (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id    uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title      text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE checklists IS 'Checklist thuộc task';

-- CHECKLIST_ITEMS
CREATE TABLE IF NOT EXISTS checklist_items (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  checklist_id uuid NOT NULL REFERENCES checklists(id) ON DELETE CASCADE,
  content      text NOT NULL,
  is_done      boolean NOT NULL DEFAULT FALSE,
  position     numeric(10,3) NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_checklist_items_order ON checklist_items(checklist_id, position);
COMMENT ON TABLE checklist_items IS 'Mục con trong checklist';

-- ATTACHMENTS
CREATE TABLE IF NOT EXISTS attachments (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_id     uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  url         text NOT NULL,
  mime_type   text,
  size        int,
  uploaded_by uuid,
  created_at  timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_attachments_task ON attachments(task_id, created_at);
COMMENT ON TABLE attachments IS 'Tệp đính kèm của task';

-- ===========================================
-- Notes cho ERD/triển khai
-- - PERSONAL workspace: chỉ owner có quyền; TEAM workspace dùng memberships.
-- - Mobile MVP (Board-only) chỉ cần: boards, tasks (board_id, position), labels, task_labels.
-- - Timer: API start/stop/continue + manual add/edit, rely on constraints để tránh overlap.
-- - Issue_key/sprint/status/type/links/watchers: phục vụ Jira-like (team), mobile có thể ẩn.
-- ===========================================

