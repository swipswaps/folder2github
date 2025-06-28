import { z } from 'zod';
import { stat, access } from 'fs/promises';
import { constants } from 'fs';

export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export const RepositoryNameSchema = z.string()
  .min(1, 'Repository name is required')
  .max(100, 'Repository name must be less than 100 characters')
  .regex(/^[a-zA-Z0-9._-]+$/, 'Repository name can only contain letters, numbers, dots, hyphens, and underscores')
  .refine(name => !name.startsWith('.'), 'Repository name cannot start with a dot')
  .refine(name => !name.endsWith('.'), 'Repository name cannot end with a dot');

export const DescriptionSchema = z.string()
  .min(1, 'Description is required')
  .max(350, 'Description must be less than 350 characters');

export async function validateSourcePath(sourcePath: string): Promise<void> {
  try {
    await access(sourcePath, constants.R_OK);
    const stats = await stat(sourcePath);
    
    if (!stats.isDirectory()) {
      throw new ValidationError('Source path must be a directory', 'sourcePath');
    }
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new ValidationError(`Cannot access source path: ${sourcePath}`, 'sourcePath');
  }
}

export function validateRepositoryName(name: string): void {
  try {
    RepositoryNameSchema.parse(name);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(error.errors[0].message, 'repositoryName');
    }
    throw error;
  }
}

export function validateDescription(description: string): void {
  try {
    DescriptionSchema.parse(description);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError(error.errors[0].message, 'description');
    }
    throw error;
  }
}

export function sanitizeRepositoryName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/^[-._]+|[-._]+$/g, '')
    .replace(/[-._]{2,}/g, '-');
}