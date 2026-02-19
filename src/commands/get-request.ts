import { Command } from 'commander';
import chalk from 'chalk';
import { ApiClient } from '../api-client.js';
import { t } from '../i18n.js';

export const getRequestCommand = new Command('get-request')
  .description('Retrieve a request secret by ID')
  .argument('<id>', 'Request ID')
  .option('--json', 'Output JSON')
  .option('--wait', 'Wait until the secret is submitted')
  .option('--timeout <seconds>', 'Timeout in seconds (used with --wait)', '300')
  .addHelpText('after', `
Examples:
  confidant get-request abc123              # Fetch request secret
  confidant get-request abc123 --json       # Output JSON
  confidant get-request abc123 --wait       # Wait for submission
  `)
  .action(async (id, options) => {
    try {
      // Get API URL from parent command options
      const program = getRequestCommand.parent;
      const apiUrl = program?.opts().apiUrl || 'http://localhost:3000';

      const response = await fetch(`${apiUrl}/requests/${id}/poll`);
      
      if (!response.ok) {
        if (response.status === 404) {
          console.error(JSON.stringify({ error: t('requestNotFound') }));
          process.exit(1);
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json() as {
        id: string;
        status: string;
        secret: string | null;
        label?: string;
      };

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log('');
        console.log(chalk.bold('Request Details:'));
        console.log(`  ID:      ${chalk.yellow(result.id)}`);
        console.log(`  Status:  ${result.status === 'retrieved' ? chalk.green(result.status) : chalk.yellow(result.status)}`);
        if (result.label) {
          console.log(`  Label:   ${result.label}`);
        }
        console.log('');
        
        if (result.secret) {
          console.log(chalk.green('✓ Secret received:'));
          console.log('');
          console.log(chalk.cyan(result.secret));
          console.log('');
        } else {
          console.log(chalk.yellow('⏳ Secret not submitted yet'));
          if (!options.wait) {
            console.log(chalk.dim('Use --wait to keep polling'));
          }
        }
      }

      // If --wait and no secret yet, poll until we get it
      if (options.wait && !result.secret) {
        const timeout = parseInt(options.timeout) * 1000;
        const startTime = Date.now();
        const pollInterval = 2000;

        console.log(chalk.dim(`Waiting for submission (timeout: ${options.timeout}s)...`));

        while (Date.now() - startTime < timeout) {
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          
          const pollResponse = await fetch(`${apiUrl}/requests/${id}/poll`);
          if (!pollResponse.ok) continue;
          
          const pollResult = await pollResponse.json() as {
            id: string;
            status: string;
            secret: string | null;
            label?: string;
          };

          if (pollResult.secret) {
            console.log('');
            console.log(chalk.green('✓ Secret received:'));
            console.log('');
            console.log(chalk.cyan(pollResult.secret));
            console.log('');
            process.exit(0);
          }
        }

        console.log(chalk.red('✗ Timeout - secret was not submitted'));
        process.exit(1);
      }

    } catch (error) {
      if (error instanceof Error) {
        console.error(JSON.stringify({ error: error.message }));
      } else {
        console.error(JSON.stringify({ error: t('connectionFailed') }));
      }
      process.exit(1);
    }
  });
