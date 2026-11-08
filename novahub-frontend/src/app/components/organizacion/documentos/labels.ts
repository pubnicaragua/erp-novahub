import type { OrgDocAudience, OrgDocPermission } from '../../../services/org-documents.service';

export const AUDIENCE_LABEL: Record<OrgDocAudience, string> = { PRIVATE: 'Solo yo', USERS: 'Personas elegidas', DEPARTMENT: 'Un departamento', TEAM: 'Todo el equipo' };
export const PERMISSION_LABEL: Record<OrgDocPermission, string> = { VIEW: 'Solo ver', EDIT: 'Ver y editar' };
