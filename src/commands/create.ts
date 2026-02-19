import { Command } from 'commander';
import chalk from 'chalk';
import { ApiClient } from '../api-client.js';
import { t } from '../i18n.js';

export const createCommand = new Command('create')
  .description(t('createDescription'))
  .option('--secret <value>', t('secretOption'))
  .option('--ttl <milliseconds>', t('ttlOption'))
  .option('--max-access-count <number>', t('maxAccessCountOption'))
  .addHelpText('after', `\n${t('createExample')}`)
  .action(async (options) => {
    try {
      // Validate required parameters
      if (!options.secret) {
        console.error(JSON.stringify({ error: t('secretCannotBeEmpty') }));
        process.exit(1);
      }

      // Validate secret is not empty
      if (options.secret.trim() === '') {
        console.error(JSON.stringify({ error: t('secretCannotBeEmpty') }));
        process.exit(1);
      }

      // Validate TTL
      if (options.ttl !== undefined && options.ttl <= 0) {
        console.error(JSON.stringify({ error: t('ttlMustBePositive') }));
        process.exit(1);
      }

      // Validate max access count
      if (options.maxAccessCount !== undefined && options.maxAccessCount <= 0) {
        console.error(JSON.stringify({ error: t('maxAccessCountMustBePositive') }));
        process.exit(1);
      }

      // Get API URL from parent command options
      const program = createCommand.parent;
      const apiUrl = program?.opts().apiUrl || 'http://localhost:3000';

      // Create API client and call API
      const client = new ApiClient(apiUrl);
      const result = await client.createSecret(
        options.secret,
        options.ttl ? parseInt(options.ttl) : undefined,
        options.maxAccessCount ? parseInt(options.maxAccessCount) : undefined
      );

      // Output JSON response
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      if (error instanceof Error) {
        console.error(JSON.stringify({ error: error.message }));
      } else {
        console.error(JSON.stringify({ error: t('networkError') }));
      }
      process.exit(1);
    }
  });
