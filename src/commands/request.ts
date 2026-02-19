import { Command } from 'commander';
import chalk from 'chalk';
import { ApiClient } from '../api-client.js';
import { generateAllUrls } from '../url-helper.js';
import { detectAllLocalIps } from '../network-detection.js';
import { saveSecret, getServicePath, validateSaveOptions, maskSecret } from '../file-save.js';
import { t } from '../i18n.js';

export const requestCommand = new Command('request')
  .description('Create a secret request and poll for the secret')
  .option('--expires-in <seconds>', 'Request expiration time in seconds (60-86400)', '86400')
  .option('--poll-interval <seconds>', 'Polling interval in seconds (1-60)', '2')
  .option('--poll <id>', 'Manually poll for an existing request by ID')
  .option('--label <text>', 'Optional label to describe what secret is being requested (max 200 characters)')
  .option('--save <path>', t('saveOption'))
  .option('--service <name>', t('serviceOption'))
  .option('--env <varname>', t('envOption'))
  .option('--json', 'Output in JSON format')
  .option('--quiet', 'Minimal output (only URLs and secret)')
  .option('--verbose', 'Verbose output with detailed logging')
  .addHelpText('after', `
Examples:
  confidant request                          # Create request with default settings
  confidant request --expires-in 3600        # Create request with 1-hour expiration
  confidant request --poll-interval 5         # Poll every 5 seconds
  confidant request --poll abc123            # Manually poll for existing request
  confidant request --label "API Key"       # Create request with a label
  confidant request --save ~/.config/serpapi/api_key   # Save secret to file
  confidant request --service serpapi --env SERPAPI_API_KEY   # Save to config and set env var
  confidant request --json                   # Output in JSON format
  confidant request --quiet                   # Minimal output
  confidant request --verbose                 # Show detailed information including network detection

URL Options:
  When you create a request, multiple URLs are displayed for different scenarios:

  • Localhost URL: Use when both CLI and user are on the same machine
    Example: http://localhost:3000/request/abc123

  • Local Network IP URL: Automatically displayed when detected, for cross-device access
    Example: http://192.168.1.100:3000/request/abc123
    Use when: CLI on Mac Mini, user on iPhone; or CLI in Docker, user on host

  • Tunneling Services: Use when running in containers/VMs or need external access
    Popular services:
      - ngrok: https://ngrok.com (quick setup, free tier available)
      - Tailscale: https://tailscale.com (mesh VPN, secure)
      - Cloudflare Tunnel: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/
      - localtunnel: https://localtunnel.github.io/www/ (simple, no signup)

  Choose the appropriate URL based on your deployment scenario.
  `)
  .action(async (options) => {
    try {
      const validation = validateSaveOptions(options.save, options.service, options.env);
      if (!validation.valid) {
        throw new Error(validation.error || 'Invalid save options');
      }

      const program = requestCommand.parent;
      const apiUrl = program?.opts().apiUrl || 'http://localhost:3000';

      const client = new ApiClient(apiUrl);

      await runRequestFlow(client, options, { exitOnInterrupt: true });

      process.exit(0);
    } catch (error) {
      if (error instanceof Error) {
        if (options.json) {
          console.error(JSON.stringify({ error: error.message }));
        } else {
          console.error(chalk.red(`Error: ${error.message}`));
        }
      } else {
        console.error(chalk.red('An unknown error occurred'));
      }
      process.exit(1);
    }
  });

interface RequestRuntimeOptions {
  exitOnInterrupt?: boolean;
  onInterrupt?: () => void;
}

export async function runRequestFlow(
  client: ApiClient,
  options: any,
  runtime: RequestRuntimeOptions = {}
): Promise<void> {
  // Manual polling mode
  if (options.poll) {
    await manualPoll(client, options.poll, options, runtime);
    return;
  }

  // Create request mode
  await createAndPoll(client, options, runtime);
}

  /**
 * Create a request and poll for the secret
 */
async function createAndPoll(
  client: ApiClient,
  options: any,
  runtime: RequestRuntimeOptions
): Promise<void> {
  // Validate options
  const expiresIn = parseInt(options.expiresIn);
  if (isNaN(expiresIn) || expiresIn < 60 || expiresIn > 86400) {
    throw new Error('expires-in must be a number between 60 and 86400');
  }

  const pollInterval = parseInt(options.pollInterval);
  if (isNaN(pollInterval) || pollInterval < 1 || pollInterval > 60) {
    throw new Error('poll-interval must be a number between 1 and 60');
  }

  // Validate label if provided
  if (options.label !== undefined) {
    if (options.label === '') {
      throw new Error('label cannot be empty');
    }
    if (options.label.length > 200) {
      throw new Error('label must not exceed 200 characters');
    }
  }

  // Detect all local IPs
  const localIps = detectAllLocalIps();

  // Verbose mode: show network interface detection results
  if (options.verbose && !options.json) {
    console.log('');
    console.log(chalk.gray('Network Interface Detection:'));
    if (localIps.length > 0) {
      console.log(chalk.gray(`  Detected ${localIps.length} local IP(s):`));
      for (const ip of localIps) {
        console.log(chalk.gray(`    - ${ip}`));
      }
    } else {
      console.log(chalk.gray('  No local IP detected (only localhost available)'));
    }
    console.log('');
  }

  // Create the request
  if (!options.quiet && !options.json) {
    console.log(chalk.cyan('Creating secret request...'));
  }

  const result = await client.createSecretRequest(expiresIn, options.label);

  // Generate URLs for display
  const urls = generateAllUrls(client.apiUrl, result.hash, localIps);

  // Tunneling service suggestions
  const tunnelingSuggestions = [
    'ngrok',
    'Tailscale',
    'Cloudflare Tunnel',
    'localtunnel'
  ];

  // Output the result
  if (options.json) {
    console.log(JSON.stringify({
      ...result,
      localhostUrl: urls.localhost,
      networkUrls: urls.networkUrls,
      // Keep backward compatibility
      localIpUrl: urls.networkUrls.length > 0 ? urls.networkUrls[0] : null,
      tunnelingSuggestions: tunnelingSuggestions
    }, null, 2));
  } else {
    if (!options.quiet) {
      console.log('');
      console.log(chalk.green('✓ Request created successfully'));
      console.log('');
      console.log(chalk.bold('Request Details:'));
      console.log(`  ID:        ${chalk.yellow(result.id)}`);
      console.log(`  Expires:   ${chalk.gray(result.expiresAt)}`);
      console.log(`  Status:    ${chalk.yellow(result.status)}`);
      if (result.label) {
        console.log(`  Label:     ${chalk.magenta(result.label)}`);
      }
      console.log('');
      console.log(chalk.bold('Access URLs:'));
      console.log('');

      // Localhost URL (always shown as primary)
      console.log(chalk.cyan('Localhost (primary):'));
      console.log(chalk.gray('  Use when both CLI and user are on the same machine'));
      console.log(`  ${chalk.cyan(urls.localhost)}`);
      console.log('');

      // All Local IP URLs (conditional)
      if (urls.networkUrls.length > 0) {
        console.log(chalk.cyan(`Local Network IPs (${urls.networkUrls.length} available):`));
        console.log(chalk.gray('  Use for cross-device access on the same network'));
        for (const networkUrl of urls.networkUrls) {
          console.log(`  ${chalk.cyan(networkUrl)}`);
        }
        console.log('');
      }

      // Tunneling suggestions (always shown)
      console.log(chalk.cyan('Tunneling Services (for external access):'));
      console.log(chalk.gray('  Use when running in containers/VMs or need external access'));
      console.log(chalk.gray('  Recommended services:'));
      for (const service of tunnelingSuggestions) {
        console.log(chalk.gray(`    • ${service}`));
      }
      console.log('');

      console.log(chalk.bold('Sharing Instructions:'));
      console.log('  1. Choose the appropriate URL based on your situation');
      console.log('  2. Copy the URL');
      console.log('  3. Share it with the person who has the secret');
      console.log('  4. They will open the URL and submit the secret');
      console.log('  5. The secret will be displayed below when submitted');
      console.log('');
    } else {
      // Quiet mode - output all available URLs
      console.log(urls.localhost);
      for (const networkUrl of urls.networkUrls) {
        console.log(networkUrl);
      }
    }
  }

  // Start polling
  if (!options.json) {
    console.log(chalk.gray('Waiting for secret submission...'));
  }

  await pollForSecret(client, result.id, pollInterval, options, runtime);
}

/**
 * Manually poll for an existing request
 */
async function manualPoll(
  client: ApiClient,
  requestId: string,
  options: any,
  runtime: RequestRuntimeOptions
): Promise<void> {
  if (!options.quiet && !options.json) {
    console.log(chalk.cyan(`Polling for request: ${requestId}`));
  }

  const pollInterval = parseInt(options.pollInterval) || 2;
  await pollForSecret(client, requestId, pollInterval, options, runtime);
}

/**
 * Poll for the secret
 */
async function pollForSecret(
  client: ApiClient,
  requestId: string,
  pollInterval: number,
  options: any,
  runtime: RequestRuntimeOptions
): Promise<void> {
  let pollCount = 0;
  let backoff = pollInterval * 1000;
  let interrupted = false;

  const handleShutdown = () => {
    if (!options.quiet && !options.json) {
      console.log('');
      console.log(chalk.yellow('Polling interrupted'));
      console.log('');
      console.log(chalk.bold('To resume polling, run:'));
      console.log(chalk.cyan(`confidant request --poll ${requestId}`));
    }
    interrupted = true;
    if (runtime.onInterrupt) {
      runtime.onInterrupt();
    }
    if (runtime.exitOnInterrupt) {
      process.exit(130);
    }
  };

  process.on('SIGINT', handleShutdown);
  process.on('SIGTERM', handleShutdown);

  try {
    while (true) {
      if (interrupted) {
        throw new Error('Polling interrupted');
      }
      pollCount++;

      if (options.verbose && !options.json) {
        console.log(chalk.gray(`Polling... (attempt ${pollCount})`));
      }

      try {
        const result = await client.pollSecretRequest(requestId);

        if (result.status === 'completed' || result.status === 'retrieved') {
          if (!options.quiet && !options.json) {
            console.log('');
            console.log(chalk.green('✓ Secret received!'));
            console.log('');
          }

          let saveResult;
          const secret = result.secret || '';
          if (options.save || options.service) {
            const savePath = options.save || getServicePath(options.service);
            try {
              saveResult = await saveSecret(secret, { path: savePath, envVar: options.env });
            } catch (error) {
              throw new Error(t('failedToSaveSecret').replace('%s', error instanceof Error ? error.message : String(error)));
            }
          }

          if (options.json) {
            const output: any = {
              secret: saveResult ? maskSecret(secret) : secret,
            };
            if (saveResult) {
              output.savedTo = saveResult.savedTo;
              output.permissions = saveResult.permissions;
              if (saveResult.envVar) {
                output.envVar = saveResult.envVar;
              }
            }
            console.log(JSON.stringify(output, null, 2));
          } else {
            console.log(chalk.bold('Secret:'));
            console.log(chalk.cyan(saveResult ? maskSecret(secret) : secret));
            console.log('');

            if (saveResult) {
              if (saveResult.envVar) {
                console.log(chalk.green(`✓ ${t('saveAndEnvVarSuccess').replace('%s', saveResult.savedTo).replace('%s', saveResult.permissions).replace('%s', saveResult.envVar)}`));
              } else {
                console.log(chalk.green(`✓ ${t('secretSaved').replace('%s', saveResult.savedTo).replace('%s', saveResult.permissions)}`));
              }
              console.log('');
            }

            console.log(chalk.gray('The secret has been deleted from the server.'));
          }

          return;
        } else if (result.status === 'expired') {
          throw new Error('Request has expired');
        } else if (result.status === 'pending') {
          // Continue polling
          if (options.verbose && !options.json) {
            console.log(chalk.gray('Still waiting...'));
          }
        }
      } catch (error) {
        if (error instanceof Error) {
          const message = error.message.toLowerCase();
          
          if (message.includes('expired')) {
            throw error;
          } else if (message.includes('not found')) {
            throw new Error('Request not found or already retrieved');
          } else {
            // Network or other error - implement exponential backoff
            if (options.verbose && !options.json) {
              console.log(chalk.yellow(`Error: ${error.message}`));
              console.log(chalk.gray(`Retrying in ${backoff / 1000} seconds...`));
            }
            backoff = Math.min(backoff * 2, 60000); // Max 60 seconds
          }
        }
      }

      // Wait before next poll
      await sleep(backoff);
    }
  } finally {
    process.removeListener('SIGINT', handleShutdown);
    process.removeListener('SIGTERM', handleShutdown);
  }
}

/**
 * Sleep for a specified number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
