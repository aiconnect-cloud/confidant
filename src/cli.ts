#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { createRequire } from 'module';
import { t } from './i18n.js';
import { startServer, getServerUrls } from './server.js';
import { createCommand } from './commands/create.js';
import { getCommand } from './commands/get.js';
import { getRequestCommand } from './commands/get-request.js';
import { deleteCommand } from './commands/delete.js';
import { statusCommand } from './commands/status.js';
import { requestCommand } from './commands/request.js';
import { serveRequestCommand } from './commands/serve-request.js';
import { fillCommand } from './commands/fill.js';

// Read version from package.json
const require = createRequire(import.meta.url);
const packageJson = require('../package.json');

const program = new Command();

program
  .name('confidant')
  .description(t('programDescription'))
  .version(packageJson.version)
  .option('--api-url <url>', t('apiUrlOption'), process.env.CONFIDANT_API_URL || 'http://localhost:3000')
  .addCommand(createCommand)
  .addCommand(getCommand)
  .addCommand(getRequestCommand)
  .addCommand(deleteCommand)
  .addCommand(statusCommand)
  .addCommand(requestCommand)
  .addCommand(serveRequestCommand)
  .addCommand(fillCommand);

// Serve command
program
  .command('serve')
  .description(t('serveDescription'))
  .option('-p, --port <number>', t('portOption'), (value) => parseInt(value, 10), parseInt(process.env.CONFIDANT_PORT || '3000', 10))
  .option('-h, --host <string>', t('hostOption'), '0.0.0.0')
  .action(async (options) => {
    const { port, host } = options;
    
    console.log(t('serverStarting'));
    
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
      // Start the server
      cleanup = await startServer({ port, host });
      
      // Display available URLs
      const urls = getServerUrls(port, host);
      console.log(t('serverRunning'));
      console.log(t('localhostUrl').replace('%s', urls.localhost));
      if (urls.networkUrls && urls.networkUrls.length > 0) {
        for (const networkUrl of urls.networkUrls) {
          console.log(t('networkUrl').replace('%s', networkUrl));
        }
      }
      console.log();
      console.log(t('pressCtrlCToStop'));
      
    } catch (error) {
      console.error(chalk.red(`Failed to start server: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse(process.argv);

// If no command is provided, show help
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
