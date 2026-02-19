import { Command } from 'commander';
import chalk from 'chalk';
import { ApiClient } from '../api-client.js';
import { t } from '../i18n.js';

const HASH_REGEX = /^[a-f0-9]{64}$/i;

/**
 * Extract hash and base URL from input
 * @param input URL or hash string
 * @returns Object with hash and optional baseUrl
 */
function extractHashFromUrl(input: string): { hash: string; baseUrl: string | null } {
  // Try to parse as URL first
  try {
    const url = new URL(input);
    const match = url.pathname.match(/\/requests\/([a-f0-9]{64})$/i);
    if (match) {
      return {
        hash: match[1],
        baseUrl: `${url.protocol}//${url.host}`
      };
    }
  } catch {
    // Input might be just the hash
  }

  // Check if input is a raw hash
  if (HASH_REGEX.test(input)) {
    return { hash: input, baseUrl: null };
  }

  throw new Error(t('invalidUrlOrHash'));
}

/**
 * Read secret from stdin
 * @returns Promise resolving to the secret string
 */
async function readFromStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => { resolve(data.trim()); });
  });
}

export const fillCommand = new Command('fill')
  .description(t('fillDescription'))
  .argument('<url-or-hash>', t('fillUrlArgument'))
  .option('--secret <value>', t('fillSecretOption'))
  .option('--json', 'Output JSON')
  .addHelpText('after', `
Examples:
  # Submit secret via URL (recommended)
  confidant fill "http://localhost:3000/requests/abc123..." --secret "sk-xxxx"

  # Submit secret via hash (requires --api-url)
  confidant fill abc123... --secret "sk-xxxx" --api-url "http://192.168.1.100:3000"

  # Read secret from stdin (safer for sensitive data)
  echo "my-secret" | confidant fill <url> --secret -
  cat secret.txt | confidant fill <url> --secret -

  # JSON output for scripting
  confidant fill <url> --secret "xxx" --json

Agent-to-Agent Flow:
  # Agent A (Host 1) creates request
  confidant request --label "API Key"
  → http://192.168.1.100:3000/requests/abc123...

  # Agent B (Host 2) submits secret
  confidant fill "http://192.168.1.100:3000/requests/abc123..." --secret "sk-xxxx"
  `)
  .action(async (urlOrHash: string, options: { secret?: string; json?: boolean }) => {
    try {
      // Get API URL from parent command options
      const program = fillCommand.parent;
      const globalApiUrl = program?.opts().apiUrl || 'http://localhost:3000';

      // Extract hash and base URL from input
      const { hash, baseUrl } = extractHashFromUrl(urlOrHash);

      // Determine which API URL to use
      const apiUrl = baseUrl || globalApiUrl;

      // Get the secret value
      let secretValue: string;

      if (!options.secret) {
        throw new Error(t('secretRequired'));
      }

      if (options.secret === '-') {
        // Read from stdin
        secretValue = await readFromStdin();
      } else {
        secretValue = options.secret;
      }

      // Validate secret is not empty
      if (!secretValue || secretValue.trim() === '') {
        throw new Error(t('secretCannotBeEmptyFill'));
      }

      // Create API client and submit secret
      const client = new ApiClient(apiUrl);
      await client.submitSecret(hash, secretValue);

      // Output success
      if (options.json) {
        console.log(JSON.stringify({ success: true, message: 'Secret submitted successfully' }));
      } else {
        console.log(chalk.green(`✓ ${t('secretSubmitted')}`));
      }

      process.exit(0);
    } catch (error) {
      if (error instanceof Error) {
        // Map API error messages to localized messages
        let errorMessage = error.message;

        if (error.message.includes('Request not found')) {
          errorMessage = t('requestNotFound');
        } else if (error.message.includes('already been submitted')) {
          errorMessage = t('secretAlreadySubmitted');
        } else if (error.message.includes('expired')) {
          errorMessage = t('requestExpired');
        } else if (error.message.includes('ECONNREFUSED') || error.message.includes('request to') && error.message.includes('failed')) {
          errorMessage = t('connectionFailed');
        }

        if (options.json) {
          console.log(JSON.stringify({ success: false, error: errorMessage }));
        } else {
          console.error(chalk.red(`Error: ${errorMessage}`));
        }
      } else {
        if (options.json) {
          console.log(JSON.stringify({ success: false, error: 'Unknown error' }));
        } else {
          console.error(chalk.red('Unknown error'));
        }
      }
      process.exit(1);
    }
  });
