import type { CommandConfig, ParsedArgs, ParsedFlags } from '../../../index.ts'

export const config: CommandConfig = {
  description: 'List available blueprints',
  flags: {
    json: {
      type: 'boolean',
      description: 'Output as JSON',
      default: false,
    },
  },
  args: {},
}

export async function handler({
  flags,
}: {
  flags: ParsedFlags
  args: ParsedArgs
}) {
  const blueprints = ['starter', 'blog', 'commerce']
  if (flags.json) {
    console.log(JSON.stringify(blueprints))
  } else {
    for (const name of blueprints) console.log(name)
  }
}
