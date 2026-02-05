import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
  }

  toJSON(): Record<string, unknown> {
    return {
      error: this.message,
      code: this.code,
    };
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('Error:', err.name, err.message);

  // Zod validation error
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Validation error',
      code: 'VALIDATION_ERROR',
      details: err.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
        code: e.code,
      })),
    });
    return;
  }

  // Custom app error with toJSON method
  if (err instanceof AppError) {
    if ('toJSON' in err && typeof err.toJSON === 'function') {
      res.status(err.statusCode).json(err.toJSON());
    } else {
      res.status(err.statusCode).json({
        error: err.message,
        code: err.code,
      });
    }
    return;
  }

  // Prisma errors
  if (err.name === 'PrismaClientKnownRequestError') {
    const prismaError = err as Error & { code: string; meta?: { target?: string[] } };

    if (prismaError.code === 'P2002') {
      const field = prismaError.meta?.target?.[0] || 'field';
      res.status(409).json({
        error: `A record with this ${field} already exists`,
        code: 'DUPLICATE_ENTRY',
        field,
      });
      return;
    }

    if (prismaError.code === 'P2025') {
      res.status(404).json({
        error: 'Record not found',
        code: 'NOT_FOUND',
      });
      return;
    }

    if (prismaError.code === 'P2003') {
      res.status(400).json({
        error: 'Foreign key constraint failed',
        code: 'FOREIGN_KEY_ERROR',
      });
      return;
    }
  }

  // Prisma validation error
  if (err.name === 'PrismaClientValidationError') {
    res.status(400).json({
      error: 'Invalid data provided',
      code: 'VALIDATION_ERROR',
    });
    return;
  }

  // Default error
  const isDev = process.env.NODE_ENV === 'development';
  res.status(500).json({
    error: isDev ? err.message : 'Internal server error',
    code: 'INTERNAL_ERROR',
    ...(isDev && { stack: err.stack }),
  });
}
