export const ERROR_MESSAGES = {
  // Task errors
  TASK_NOT_FOUND: 'Task not found',
  TASK_ACCESS_DENIED: 'Access denied to this task',

  // Project errors
  PROJECT_NOT_FOUND: 'Project not found',
  PROJECT_ACCESS_DENIED: 'Access denied to this project',
  PROJECT_NOT_MEMBER: 'You are not a member of this project',

  // Workspace errors
  WORKSPACE_NOT_FOUND: 'Workspace not found',
  WORKSPACE_NOT_MEMBER: 'User is not a member of the workspace',
  WORKSPACE_NOT_OWNER: 'User is not the owner of the workspace',

  // Permission errors
  INSUFFICIENT_PERMISSION: 'This action requires one of these roles',
  ONLY_CREATOR_OR_ASSIGNEE:
    'Members can only edit/delete tasks they created or are assigned to',
  ONLY_OWN_COMMENT: 'You can only edit your own comments',
  ONLY_OWN_ATTACHMENT: 'You can only delete your own attachments',

  // User errors
  USER_NOT_FOUND: 'User not found',
  USER_EMAIL_NOT_FOUND: (email: string) =>
    `User not found with email: ${email}`,

  // Event errors
  EVENT_NOT_FOUND: 'Event not found',
  EVENT_ACCESS_DENIED: 'Event does not belong to this project',
};
