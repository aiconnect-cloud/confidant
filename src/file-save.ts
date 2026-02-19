import { mkdir, writeFile, chmod, access, constants } from 'fs/promises';
import { homedir } from 'os';
import { resolve, dirname } from 'path';
import readline from 'readline';

export interface SaveOptions {
  path: string;
  envVar?: string;
  service?: string;
  quiet?: boolean;
}

export interface SaveResult {
  savedTo: string;
  permissions: string;
  envVar?: string;
  service?: string;
}

export async function saveSecret(secret: string, options: SaveOptions): Promise<SaveResult> {
  const fullPath = resolvePath(options.path);

  await mkdir(dirname(fullPath), { recursive: true });

  const fileExists = await checkFileExists(fullPath);
  if (fileExists && !options.quiet) {
    const confirmed = await promptOverwrite(fullPath);
    if (!confirmed) {
      throw new Error('File save cancelled by user');
    }
  }

  let content = secret;
  if (options.service) {
    // Convention mode: api_key file always contains raw secret only
    content = secret;
  } else if (options.envVar) {
    content = formatAsEnvVar(options.envVar, secret);
  }

  await writeFile(fullPath, content, 'utf8');

  try {
    await chmod(fullPath, 0o600);
  } catch {
  }

  if (options.envVar) {
    process.env[options.envVar] = secret;
  }

  return {
    savedTo: fullPath,
    permissions: '600',
    envVar: options.envVar,
    service: options.service,
  };
}

export async function checkFileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function promptOverwrite(filePath: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const promise = new Promise<boolean>((resolve) => {
    rl.question(`File "${filePath}" already exists. Overwrite? (y/N): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });

  return promise;
}

export function formatServiceComment(serviceName: string): string {
  return `# Service: ${serviceName}`;
}

export function formatAsEnvVar(envVarName: string, secret: string): string {
  return `${envVarName}=${secret}`;
}

export function resolvePath(path: string): string {
  if (path.startsWith('~')) {
    return resolve(homedir(), path.slice(2));
  }
  return resolve(path);
}

export function validateServiceName(serviceName: string): { valid: boolean; error?: string } {
  if (!serviceName || serviceName === '') {
    return { valid: false, error: 'Service name cannot be empty' };
  }
  if (serviceName.length > 200) {
    return { valid: false, error: 'Service name must not exceed 200 characters' };
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(serviceName)) {
    return { valid: false, error: 'Service name must contain only letters, numbers, hyphens, and underscores' };
  }
  return { valid: true };
}

export function getServicePath(serviceName: string): string {
  return `~/.config/${serviceName}/api_key`;
}

export function maskSecret(secret: string): string {
  if (secret.length <= 8) return '****';
  return `${secret.slice(0, 4)}${'*'.repeat(Math.min(secret.length - 8, 12))}${secret.slice(-4)}`;
}

export function validateEnvVarName(envVarName: string): { valid: boolean; error?: string } {
  if (!envVarName || envVarName === '') {
    return { valid: false, error: 'Environment variable name cannot be empty' };
  }
  if (!/^[A-Z_][A-Z0-9_]*$/.test(envVarName)) {
    return { valid: false, error: 'Environment variable name must contain only uppercase letters, numbers, and underscores, and must start with a letter or underscore' };
  }
  return { valid: true };
}

export function validateSaveOptions(savePath: string | undefined, serviceName: string | undefined, envVar: string | undefined): { valid: boolean; error?: string } {
  if (savePath && serviceName) {
    return { valid: false, error: '--save and --service are mutually exclusive' };
  }

  if (serviceName !== undefined) {
    const serviceValidation = validateServiceName(serviceName);
    if (!serviceValidation.valid) {
      return serviceValidation;
    }
  }

  if (envVar !== undefined) {
    const envValidation = validateEnvVarName(envVar);
    if (!envValidation.valid) {
      return envValidation;
    }
  }

  if (envVar !== undefined && !savePath && !serviceName) {
    return { valid: false, error: '--env requires --save or --service' };
  }

  return { valid: true };
}
