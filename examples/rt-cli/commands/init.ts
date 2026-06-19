import type { CommandConfig, ParsedArgs, ParsedFlags } from '../../../index.ts'

export const config: CommandConfig = {
  description: 'Initialize a new project in the current directory',
  flags: {
    force: {
      type: 'boolean',
      description: 'Overwrite existing files',
      default: false,
    },
  },
  args: {
    name: {
      description: 'Project name',
      required: false,
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
  const name = args.name ?? 'my-project'
  console.log(`Initializing ${name}${flags.force ? ' (force)' : ''}`)
}
