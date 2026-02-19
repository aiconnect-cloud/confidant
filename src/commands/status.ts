import { Command } from 'commander';
import { ApiClient } from '../api-client.js';
import { t } from '../i18n.js';
import { generateUrls } from '../url-helper.js';
import { detectLocalIp } from '../network-detection.js';

export const statusCommand = new Command('status')
  .description(t('statusDescription'))
  .argument('<id>', 'Secret ID')
  .addHelpText('after', `\n${t('statusExample')}`)
  .action(async (id) => {
    try {
      // Get API URL from parent command options
      const program = statusCommand.parent;
      const apiUrl = program?.opts().apiUrl || 'http://localhost:3000';

      // Create API client and call API
      const client = new ApiClient(apiUrl);
      const result = await client.getSecretStatus(id);

      // Detect local IP for network URL
      const localIp = detectLocalIp();
      const urls = generateUrls(client.apiUrl, id, localIp);

      // Output JSON response with URLs
      console.log(JSON.stringify({
        ...result,
        urls: {
          localhost: urls.localhost,
          network: urls.network
        }
      }, null, 2));
    } catch (error) {
      if (error instanceof Error) {
        console.error(JSON.stringify({ error: error.message }));
      } else {
        console.error(JSON.stringify({ error: t('networkError') }));
      }
      process.exit(1);
    }
  });
