import { Command } from 'commander';
import chalk from 'chalk';
import { t } from '../i18n.js';
import { startServer, getServerUrls } from '../server.js';
import { ApiClient } from '../api-client.js';
import { runRequestFlow } from './request.js';
import { saveSecret, getServicePath, validateSaveOptions, maskSecret } from '../file-save.js';
import { generateAllUrls } from '../url-helper.js';
import { detectAllLocalIps } from '../network-detection.js';

export const serveRequestCommand = new Command('serve-request')
  .description(t('serveRequestDescription'))
  .option('-p, --port <number>', t('portOption'), (value) => parseInt(value, 10), parseInt(process.env.CONFIDANT_PORT || '3000', 10))
  .option('-h, --host <string>', t('hostOption'), '0.0.0.0')
  .option('--expires-in <seconds>', 'Request expiration time in seconds (60-86400)', '86400')
  .option('--poll-interval <seconds>', 'Polling interval in seconds (1-60)', '2')
  .option('--label <text>', 'Optional label to describe what secret is being requested (max 200 characters)')
  .option('--save <filepath>', t('serveRequestSaveOption'))
  .option('--service <name>', t('serveRequestServiceOption'))
  .option('--env <name>', t('serveRequestEnvOption'))
  .option('--json', 'Output in JSON format')
  .option('--quiet', 'Minimal output (only URLs and secret)')
  .option('--verbose', 'Verbose output with detailed logging')
  .addHelpText('after', `
Examples:
  confidant serve-request                                    # Start server and request a secret
  confidant serve-request --label "API Key"                   # Start server and request with a label
  confidant serve-request --port 4000                        # Start server on port 4000
  confidant serve-request --json                             # JSON output
  confidant serve-request --save ~/.config/myapp/secret       # Save secret to file
  confidant serve-request --env API_KEY                       # Display secret as API_KEY=value
  confidant serve-request --service "My API"                 # Add service metadata to output
  confidant serve-request --save .env --env DATABASE_URL     # Save as env variable to .env file
  confidant serve-request --save secret.txt --service "MyAPI"   # Save with service comment
  `)
  .action(async (options) => {
    const { port, host } = options;

    const validation = validateSaveOptions(options.save, options.service, options.env);
    if (!validation.valid) {
      console.error(chalk.red(`Error: ${validation.error}`));
      process.exit(1);
    }

    let cleanup: (() => Promise<void>) | null = null;

    // Handle graceful shutdown
    const shutdown = async (signal: string) => {
      console.log(`\n${t('serverShutdown')} (${signal})`);
      if (cleanup) {
        await cleanup();
      }
      console.log(t('serverStopped'));
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

    try {
      console.log(t('serverStarting'));

      // Start the server
      cleanup = await startServer({ port, host });

      // Display available URLs
      const urls = getServerUrls(port, host);
      if (!options.json && !options.quiet) {
        console.log(t('serverRunning'));
        console.log(t('localhostUrl').replace('%s', urls.localhost));
        if (urls.networkUrls && urls.networkUrls.length > 0) {
          for (const networkUrl of urls.networkUrls) {
            console.log(t('networkUrl').replace('%s', networkUrl));
          }
        }
        console.log();
      }

      const apiHostForClient = host === '0.0.0.0' || host === '::' ? 'localhost' : host;
      const apiUrl = `http://${apiHostForClient}:${port}`;
      const client = new ApiClient(apiUrl);

      await runServeRequestFlow(client, options, {
        exitOnInterrupt: false,
        onInterrupt: async () => {
          if (cleanup) {
            await cleanup();
          }
        }
      });

      // Clean up server and exit after secret is received
      if (cleanup) {
        await cleanup();
      }
      process.exit(0);
    } catch (error) {
      if (cleanup) {
        await cleanup();
      }

      if (error instanceof Error) {
        if (error.message.toLowerCase().includes('polling interrupted')) {
          process.exit(130);
        }

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

interface ServeRequestRuntimeOptions {
  exitOnInterrupt?: boolean;
  onInterrupt?: () => void;
}

async function runServeRequestFlow(
  client: ApiClient,
  options: any,
  runtime: ServeRequestRuntimeOptions = {}
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

  await pollForSecretInServe(client, result.id, pollInterval, options, runtime);
}

async function pollForSecretInServe(
  client: ApiClient,
  requestId: string,
  pollInterval: number,
  options: any,
  runtime: ServeRequestRuntimeOptions
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

          const secret = result.secret || '';

          // Handle file saving after secret is received
          let saveResult;
          if (options.save || options.service) {
            const savePath = options.save || getServicePath(options.service);
            try {
              saveResult = await saveSecret(secret, {
                path: savePath,
                envVar: options.env,
                service: options.service,
                quiet: options.quiet
              });
            } catch (error) {
              throw new Error(t('failedToSaveSecret').replace('%s', error instanceof Error ? error.message : String(error)));
            }
          }

          // Prepare output
          let outputSecret = secret;
          if (options.env) {
            outputSecret = `${options.env}=${secret}`;
          }

          if (options.json) {
            const output: any = {
              secret: outputSecret,
            };
            if (saveResult) {
              output.savedPath = saveResult.savedTo;
            }
            if (options.service) {
              output.service = options.service;
            }
            console.log(JSON.stringify(output, null, 2));
          } else {
            // Display service name if provided
            if (options.service && !options.quiet) {
              console.log(chalk.bold('Service:'));
              console.log(chalk.magenta(options.service));
              console.log('');
            }

            console.log(chalk.bold('Secret:'));
            console.log(chalk.cyan(outputSecret));
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

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}