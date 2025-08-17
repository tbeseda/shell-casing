> [!IMPORTANT]  
> This is experimental and likely to change drastically.

# shell-casing

A lightweight CLI framework for organizing commands into a file-based structure. Automatically discovers commands from your directory tree and provides a clean API for building CLIs.

## Installation

```bash
npm install shell-casing
```

## Quick Start

### 1. Create your command structure

```
commands/
  init.ts
  group-1.ts
  group-1/
    add.ts
    list.ts
  group-2/
    create.ts
    delete.ts
```

Enables...

```bash
$ my-cmd init
$ my-cmd group-1
$ my-cmd group-1 add
$ my-cmd group-2 create
$ my-cmd group-2 delete
```

### 2. Define your commands

Each command file should export a `config` and `handler`:

```typescript
// commands/greet.ts
export const config = {
  description: 'Greet someone by name',
  flags: {
    formal: {
      type: 'boolean',
      description: 'Use formal greeting',
      default: false,
    },
  },
  args: {
    name: {
      description: 'Name to greet',
      required: false,
    },
  },
}

export async function handler({ flags, args }) {
  const greeting = flags.formal ? `Good day, ${args.name}.` : `Hey ${args.name}!`
  console.log(greeting)
}
```

### 3. Use in your CLI

```typescript
#!/usr/bin/env node

import { createCLI, runCLI } from 'shell-casing'

async function main() {
  const commands = await createCLI({
    commandsDir: 'commands',
  })
  
  await runCLI(commands)
}

main().catch(console.error)
```

## API Reference

### Functions

#### `createCLI(options: ShellCasingOptions): Promise<CommandPath[]>`

Creates and loads commands from the specified directory.

**Options:**
- `commandsDir: string` - Path to your commands directory
- `baseDir?: string` - Base directory for resolving relative paths (defaults to current file location)

**Returns:** Promise that resolves to an array of discovered commands

#### `runCLI(commands: CommandPath[], argv?: string[]): Promise<void>`

Executes the CLI with the given commands and arguments.

**Parameters:**
- `commands: CommandPath[]` - Array of commands from `createCLI`
- `argv?: string[]` - Command line arguments (defaults to `process.argv.slice(2)`)

**Returns:** Promise that resolves when the CLI execution is complete
