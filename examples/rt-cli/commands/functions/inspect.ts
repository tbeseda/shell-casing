import type {
  CommandConfig,
  ParsedArgs,
  ParsedFlags,
} from '../../../../index.ts'

export const config: CommandConfig = {
  description: 'Inspect a function by name',
  flags: {
    verbose: {
      type: 'boolean',
      description: 'Show full details',
      default: false,
    },
  },
  args: {
    name: {
      description: 'Function to inspect',
      required: true,
    },
  },
}

export async function handler({
  flags,
  args,
}: {
  flags: ParsedFlags
  args: ParsedArgs
}) {
  console.log(`Function: ${args.name}`)
  if (flags.verbose) console.log('  (verbose details would go here)')
}
