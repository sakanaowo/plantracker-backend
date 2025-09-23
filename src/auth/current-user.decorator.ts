import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest<Request>();
    const user = req.user;
    
    if (data && user && typeof user === 'object') {
      // If user is an object and data is specified, try to extract that property
      if (data === 'id' && 'uid' in user) {
        return user.uid; // Extract uid when 'id' is requested
      }
      return (user as any)[data];
    }
    
    return user;
  },
);
