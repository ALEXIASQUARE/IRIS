import { createParamDecorator, ExecutionContext } from "@nestjs/common";

// Injecte l'utilisateur authentifié (posé par JwtAuthGuard) dans un handler.
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
