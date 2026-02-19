import { Command } from 'commander';
import { ApiClient } from '../api-client.js';
import { t } from '../i18n.js';
import { saveSecret, getServicePath, validateSaveOptions, maskSecret } from '../file-save.js';

export const getCommand = new Command('get')
  .description(t('getDescription'))
  .argument('<id>', 'Secret ID')
  .option('--save <path>', t('saveOption'))
  .option('--service <name>', t('serviceOption'))
  .option('--env <varname>', t('envOption'))
  .addHelpText('after', `
Examples:
  ${t('getExample')}
  confidant get abc123 --save ~/.config/serpapi/api_key
  confidant get abc123 --service openai --env OPENAI_API_KEY
  `)
  .action(async (id, options) => {
    try {
      const validation = validateSaveOptions(options.save, options.service, options.env);
      if (!validation.valid) {
        console.error(JSON.stringify({ error: validation.error || 'Invalid save options' }));
        process.exit(1);
        return;
      }

      const program = getCommand.parent;
      const apiUrl = program?.opts().apiUrl || 'http://localhost:3000';

      const client = new ApiClient(apiUrl);
      const result = await client.getSecret(id);

      let saveResult;
      if (options.save || options.service) {
        const savePath = options.save || getServicePath(options.service);
        try {
          saveResult = await saveSecret(result.secret, { path: savePath, envVar: options.env });
        } catch (error) {
          console.error(JSON.stringify({ error: t('failedToSaveSecret').replace('%s', error instanceof Error ? error.message : String(error)) }));
          process.exit(1);
          return;
        }
      }

      const output: any = {
        secret: saveResult ? maskSecret(result.secret) : result.secret,
      };
      if (saveResult) {
        output.savedTo = saveResult.savedTo;
        output.permissions = saveResult.permissions;
        if (saveResult.envVar) {
          output.envVar = saveResult.envVar;
        }
      }

      console.log(JSON.stringify(output, null, 2));
    } catch (error) {
      if (error instanceof Error) {
        console.error(JSON.stringify({ error: error.message }));
      } else {
        console.error(JSON.stringify({ error: t('networkError') }));
      }
      process.exit(1);
    }
  });
