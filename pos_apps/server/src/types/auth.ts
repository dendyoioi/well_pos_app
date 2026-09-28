import { Role } from '@prisma/client';

export interface AuthUserPayload {
  id: string;
  email: string | null;
  name: string;
  role: Role;
  outletId: string | null;
  tenantId?: string | null;
  userCode?: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUserPayload;
      tenantId?: string;
    }
  }
}
