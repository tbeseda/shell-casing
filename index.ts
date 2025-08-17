import { readdir } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from '@bomb.sh/args'

export type FlagType = 'string' | 'number' | 'boolean'

export interface FlagDefinition {
  type: FlagType
  description: string
  default?: string | number | boolean
  required?: boolean
}

export interface ArgDefinition {
  description: string
  required: boolean
  default?: string
}

export interface CommandConfig {
  description: string
  flags: Record<string, FlagDefinition>
  args: Record<string, ArgDefinition>
}

export interface ParsedFlags {
  [key: string]: string | number | boolean
}

export interface ParsedArgs {
  [key: string]: string
}

export interface Command {
  config: CommandConfig
  handler: (params: { flags: ParsedFlags; args: ParsedArgs }) => Promise<void>
}

export interface CommandPath {
  path: string
  command: Command
}

export interface ParsedCommand {
  command: string[]
  flags: ParsedFlags
  args: ParsedArgs
  target: Command | null
}

export interface ShellCasingOptions {
  commandsDir: string
  baseDir?: string
}

const pathCache = new Map<
  string,
  { parts: string[]; depth: number; name: string }
>()

function getPathInfo(path: string) {
  if (!pathCache.has(path)) {
    const parts = path.split('/')
    pathCache.set(path, {
      parts,
      depth: parts.length - 1,
      name: parts[parts.length - 1] || path,
    })
  }
  const cached = pathCache.get(path)
  if (!cached) {
    throw new Error(`Failed to get path info for: ${path}`)
  }
  return cached
}

export async function loadCommands(
  dir: string,
  basePath: string = '',
): Promise<CommandPath[]> {
  const commands: CommandPath[] = []

  try {
    const entries = await readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = join(dir, entry.name)

      if (entry.isDirectory()) {
        // For directories, we need to track the full path from root
        const newBasePath = basePath ? `${basePath}/${entry.name}` : entry.name
        const subCommands = await loadCommands(fullPath, newBasePath)
        commands.push(...subCommands)
      } else if (
        entry.isFile() &&
        (extname(entry.name) === '.ts' || entry.name === '.js')
      ) {
        const commandName = entry.name.replace(/\.(ts|js)$/, '')
        const commandModule = await import(fullPath)

        if (commandModule.config && commandModule.handler) {
          // The command path should include the full directory structure
          const commandPath = basePath
            ? `${basePath}/${commandName}`
            : commandName
          commands.push({
            path: commandPath,
            command: {
              config: commandModule.config,
              handler: commandModule.handler,
            },
          })
        }
      }
    }
  } catch {
    // carry on
  }

  return commands
}

export function findCommand(
  commands: CommandPath[],
  path: string[],
): Command | null {
  if (path.length === 0) return null

  const commandPath = path.join('/')
  return commands.find((cmd) => cmd.path === commandPath)?.command || null
}

export function parseArgs(
  commands: CommandPath[],
  argv: string[],
): ParsedCommand {
  const { _: allArgs, ...rawFlags } = parse(argv)
  const stringArgs = allArgs.map(String)

  // find the longest valid command path
  let command: string[] = []
  let rawArgs: string[] = []
  let target: Command | null = null

  // start from the end to find the longest matching command path
  for (let i = stringArgs.length; i >= 0; i--) {
    const potentialCommand = stringArgs.slice(0, i)

    const foundTarget = findCommand(commands, potentialCommand)

    if (foundTarget) {
      // We found a valid command
      command = stringArgs.slice(0, i)
      rawArgs = stringArgs.slice(i)
      target = foundTarget
      break
    }
  }

  if (command.length === 0 && stringArgs.length > 0) {
    // no command was found, set command to the full stringArgs
    command = stringArgs
  }

  // narrow flags to desired types
  const flags: ParsedFlags = {}
  for (const [key, value] of Object.entries(rawFlags)) {
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean'
    ) {
      flags[key] = value
    }
  }

  // convert args array to object based on command's expected args
  const args: ParsedArgs = {}
  if (target) {
    const argNames = Object.keys(target.config.args)
    rawArgs.forEach((arg, index) => {
      if (index < argNames.length) {
        const argName = argNames[index]
        if (typeof argName === 'string') {
          args[argName] = arg
        }
      }
    })
  }

  return {
    command,
    flags,
    args,
    target,
  }
}

export function showHelp(commands: CommandPath[]) {
  for (const cmd of commands) {
    const { depth } = getPathInfo(cmd.path)
    const indent = '  '.repeat(depth)
    console.log(`${indent}${cmd.path} - ${cmd.command.config.description}`)
  }
}

export async function createCLI(
  options: ShellCasingOptions,
): Promise<CommandPath[]> {
  const baseDir =
    options.baseDir || fileURLToPath(new URL('.', import.meta.url))
  return await loadCommands(join(baseDir, options.commandsDir))
}

export async function runCLI(
  commands: CommandPath[],
  argv: string[] = process.argv.slice(2),
): Promise<void> {
  if (!commands.length) {
    throw new Error('No commands available. Make sure to call createCLI first.')
  }

  const { command, flags, args, target } = parseArgs(commands, argv)

  if (command.length === 0) {
    console.log('Available commands:')
    showHelp(commands)
    return
  }

  if (target) {
    // do the thing
    try {
      await target.handler({ flags, args })
    } catch (error) {
      console.error('Error executing command:', error)
      throw error
    }
  } else {
    // check if this is a directory path and show subcommands
    const commandPath = command.join('/')

    const subCommands = commands.filter((cmd) =>
      cmd.path.startsWith(`${commandPath}/`),
    )

    if (subCommands.length > 0) {
      console.log(`Available ${command.join(' ')} commands:`)
      showHelp(subCommands)
    } else {
      console.error(`Command not found: ${command.join(' ')}`)
      console.log('\nAvailable commands:')
      showHelp(commands)
      throw new Error(`Command not found: ${command.join(' ')}`)
    }
  }
}
