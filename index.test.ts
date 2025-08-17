import assert from 'node:assert/strict'
import { describe, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  type Command,
  type CommandPath,
  createCLI,
  findCommand,
  parseArgs,
  runCLI,
  showHelp,
} from './index.ts'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

const mockCommand: Command = {
  config: {
    description: 'Test command',
    flags: {
      verbose: {
        type: 'boolean',
        description: 'Verbose output',
        default: false,
      },
    },
    args: {
      name: {
        description: 'Name argument',
        required: true,
      },
    },
  },
  handler: async () => {},
}

const mockCommands: CommandPath[] = [
  {
    path: 'greet',
    command: mockCommand,
  },
  {
    path: 'blueprints',
    command: mockCommand,
  },
  {
    path: 'blueprints/inspect',
    command: mockCommand,
  },
  {
    path: 'functions/inspect',
    command: mockCommand,
  },
]

describe('shell-casing', () => {
  describe('findCommand', () => {
    test('should find command by exact path', () => {
      const result = findCommand(mockCommands, ['greet'])
      assert.ok(result)
      assert.strictEqual(result.config.description, 'Test command')
    })

    test('should find nested command by path', () => {
      const result = findCommand(mockCommands, ['blueprints', 'inspect'])
      assert.ok(result)
      assert.strictEqual(result.config.description, 'Test command')
    })

    test('should return null for non-existent command', () => {
      const result = findCommand(mockCommands, ['nonexistent'])
      assert.strictEqual(result, null)
    })

    test('should return null for empty path', () => {
      const result = findCommand(mockCommands, [])
      assert.strictEqual(result, null)
    })

    test('should return null for partial path', () => {
      const result = findCommand(mockCommands, ['blueprints'])
      assert.ok(result) // blueprints exists as a command
    })
  })

  describe('parseArgs', () => {
    test('should parse simple command', () => {
      const result = parseArgs(mockCommands, ['greet'])
      assert.deepStrictEqual(result.command, ['greet'])
      assert.deepStrictEqual(result.args, {})
      assert.deepStrictEqual(result.flags, {})
      assert.ok(result.target)
    })

    test('should parse nested command', () => {
      const result = parseArgs(mockCommands, ['blueprints', 'inspect'])
      assert.deepStrictEqual(result.command, ['blueprints', 'inspect'])
      assert.deepStrictEqual(result.args, {})
      assert.deepStrictEqual(result.flags, {})
      assert.ok(result.target)
    })

    test('should parse command with flags', () => {
      const result = parseArgs(mockCommands, [
        'greet',
        '--verbose',
        '--name=John',
      ])
      assert.deepStrictEqual(result.command, ['greet'])
      assert.deepStrictEqual(result.flags, { verbose: true, name: 'John' })
      assert.deepStrictEqual(result.args, {})
      assert.ok(result.target)
    })

    test('should parse command with arguments', () => {
      const result = parseArgs(mockCommands, ['greet', 'John', 'Doe'])
      assert.deepStrictEqual(result.command, ['greet'])
      assert.deepStrictEqual(result.args, { name: 'John' })
      assert.deepStrictEqual(result.flags, {})
      assert.ok(result.target)
    })

    test('should find longest matching command path', () => {
      const result = parseArgs(mockCommands, [
        'blueprints',
        'inspect',
        'my-blueprint',
      ])
      assert.deepStrictEqual(result.command, ['blueprints', 'inspect'])
      assert.deepStrictEqual(result.args, { name: 'my-blueprint' })
      assert.ok(result.target)
    })

    test('should handle empty argv', () => {
      const result = parseArgs(mockCommands, [])
      assert.deepStrictEqual(result.command, [])
      assert.deepStrictEqual(result.args, {})
      assert.deepStrictEqual(result.flags, {})
      assert.strictEqual(result.target, null)
    })

    test('should handle mixed flags and args', () => {
      const result = parseArgs(mockCommands, [
        'greet',
        '--verbose',
        'John',
        '--formal',
      ])
      assert.deepStrictEqual(result.command, ['greet'])
      assert.deepStrictEqual(result.flags, { verbose: 'John', formal: true })
      assert.deepStrictEqual(result.args, {})
      assert.ok(result.target)
    })
  })

  describe('showHelp', () => {
    test('should display commands with proper indentation', () => {
      // snipe console.log output
      const originalLog = console.log
      const logs: string[] = []
      console.log = (...args: string[]) => {
        logs.push(args.join(' '))
      }

      try {
        showHelp(mockCommands)

        assert.ok(logs.some((log) => log.includes('greet - Test command')))
        assert.ok(logs.some((log) => log.includes('blueprints - Test command')))
        assert.ok(
          logs.some((log) => log.includes('blueprints/inspect - Test command')),
        )
        assert.ok(
          logs.some((log) => log.includes('functions/inspect - Test command')),
        )

        const greetLog = logs.find((log) => log.includes('greet'))
        const blueprintsLog = logs.find((log) => log.includes('blueprints'))
        const inspectLog = logs.find((log) =>
          log.includes('blueprints/inspect'),
        )

        assert.ok(greetLog)
        assert.ok(blueprintsLog)
        assert.ok(inspectLog)

        // root commands should have no indentation
        assert.strictEqual(greetLog?.startsWith('greet'), true)
        assert.strictEqual(blueprintsLog?.startsWith('blueprints'), true)

        // nested commands should have indentation
        assert.strictEqual(inspectLog?.startsWith('  blueprints/inspect'), true)
      } finally {
        console.log = originalLog
      }
    })
  })

  describe('createCLI', () => {
    test('should load commands from directory', async () => {
      const commands = await createCLI({
        commandsDir: 'examples/rt-cli/commands',
        baseDir: __dirname,
      })

      assert.ok(Array.isArray(commands))
      assert.ok(commands.length > 0)

      for (const cmd of commands) {
        assert.ok(cmd.path)
        assert.ok(cmd.command.config)
        assert.ok(cmd.command.handler)
        assert.ok(typeof cmd.command.config.description === 'string')
      }
    })

    test('should handle non-existent directory gracefully', async () => {
      const commands = await createCLI({
        commandsDir: 'nonexistent',
        baseDir: __dirname,
      })

      assert.deepStrictEqual(commands, [])
    })
  })

  describe('runCLI', () => {
    test('should show help when no command provided', async () => {
      const logs: string[] = []
      const originalLog = console.log
      console.log = (...args: string[]) => {
        logs.push(args.join(' '))
      }

      try {
        await runCLI(mockCommands, [])

        assert.ok(logs.some((log) => log.includes('Available commands:')))
        assert.ok(logs.some((log) => log.includes('greet - Test command')))
      } finally {
        console.log = originalLog
      }
    })

    test('should execute valid command', async () => {
      let executed = false
      const testCommand: Command = {
        ...mockCommand,
        handler: async () => {
          executed = true
        },
      }

      const testCommands: CommandPath[] = [
        {
          path: 'test',
          command: testCommand,
        },
      ]

      await runCLI(testCommands, ['test'])
      assert.strictEqual(executed, true)
    })

    test('should show subcommands for directory paths', async () => {
      // commands where 'blueprints' is not a command, just a directory
      const directoryCommands: CommandPath[] = [
        { path: 'greet', command: mockCommand },
        { path: 'blueprints/inspect', command: mockCommand },
        { path: 'blueprints/create', command: mockCommand },
      ]

      const commandPath = 'blueprints'
      const subCommands = directoryCommands.filter((cmd) =>
        cmd.path.startsWith(`${commandPath}/`),
      )

      assert.strictEqual(subCommands.length, 2)
      assert.ok(subCommands.some((cmd) => cmd.path === 'blueprints/inspect'))
      assert.ok(subCommands.some((cmd) => cmd.path === 'blueprints/create'))
    })

    test('should throw error for invalid command', async () => {
      // 'nonexistent' is not a command and not a directory
      const testCommands: CommandPath[] = [
        { path: 'greet', command: mockCommand },
      ]

      try {
        await runCLI(testCommands, ['nonexistent'])
        assert.fail('Expected error to be thrown')
      } catch (error) {
        assert.ok(error instanceof Error)
        assert.ok(error.message.includes('Command not found: nonexistent'))
      }
    })

    test('should throw error when no commands available', async () => {
      await assert.rejects(async () => {
        await runCLI([], ['greet'])
      }, /No commands available/)
    })
  })

  describe('edge cases', () => {
    test('should handle commands with same name in different directories', () => {
      const duplicateCommands: CommandPath[] = [
        { path: 'inspect', command: mockCommand },
        { path: 'blueprints/inspect', command: mockCommand },
        { path: 'functions/inspect', command: mockCommand },
      ]

      // should find the longest matching path
      const result = parseArgs(duplicateCommands, ['blueprints', 'inspect'])
      assert.deepStrictEqual(result.command, ['blueprints', 'inspect'])
      assert.ok(result.target)
    })

    test('should handle flags with various types', () => {
      const result = parseArgs(mockCommands, [
        'greet',
        '--string=hello',
        '--number=42',
        '--boolean',
      ])
      assert.deepStrictEqual(result.flags, {
        string: 'hello',
        number: 42,
        boolean: true,
      })
    })

    test('should handle short flags', () => {
      const result = parseArgs(mockCommands, ['greet', '-v', '-n', 'John'])
      assert.deepStrictEqual(result.flags, { v: true, n: 'John' })
      assert.deepStrictEqual(result.args, {})
    })
  })
})
