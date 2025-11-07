-- Create project_role enum if not exists
DO $$ BEGIN
  CREATE TYPE project_role AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create invitation_status enum
CREATE TYPE invitation_status AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED');

-- Create project_invitations table
CREATE TABLE project_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role project_role NOT NULL DEFAULT 'MEMBER',
  status invitation_status NOT NULL DEFAULT 'PENDING',
  invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(project_id, user_id)
);

-- Create indexes
CREATE INDEX idx_project_invitations_user ON project_invitations(user_id);
CREATE INDEX idx_project_invitations_status ON project_invitations(status);
CREATE INDEX idx_project_invitations_expires ON project_invitations(expires_at);

-- Add notification type for project invites
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'PROJECT_INVITE';