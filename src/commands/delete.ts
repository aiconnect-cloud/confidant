import { Command } from 'commander';
import { ApiClient } from '../api-client.js';
import { t } from '../i18n.js';

export const deleteCommand = new Command('delete')
  .description(t('deleteDescription'))
  .argument('<id>', 'Secret ID')
  .addHelpText('after', `\n${t('deleteExample')}`)
  .action(async (id) => {
    try {
      // Get API URL from parent command options
      const program = deleteCommand.parent;
      const apiUrl = program?.opts().apiUrl || 'http://localhost:3000';

      // Create API client and call API
      const client = new ApiClient(apiUrl);
      const result = await client.deleteSecret(id);

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
