import { Role } from '@prisma/client';

export interface AuthUserPayload {
  id: string;
  email: string;
  name: string;
  role: Role;
  outletId: string | null;
  tenantId?: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUserPayload;
      tenantId?: string;
    }
  }
}
