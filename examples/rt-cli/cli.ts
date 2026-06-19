#!/usr/bin/env node
import { createCLI, runCLI } from '../../index.ts'

const commands = await createCLI({
  commandsDir: 'commands',
  baseDir: import.meta.dirname,
})

await runCLI(commands)
