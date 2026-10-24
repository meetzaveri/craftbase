import { config as loadEnv } from 'dotenv'
import type { CodegenConfig } from '@graphql-codegen/cli'

// Match Vite's env loading: .env.local overrides .env. Load .local first so
// already-set keys win, then .env fills in the rest.
loadEnv({ path: '.env.local' })
loadEnv({ path: '.env' })

const endpoint = process.env.VITE_GRAPHQL_ENDPOINT
const adminSecret = process.env.VITE_HASURA_ADMIN_SECRET

if (!endpoint) {
    throw new Error(
        'VITE_GRAPHQL_ENDPOINT is required for codegen. Set it in .env.local.'
    )
}
if (!adminSecret) {
    throw new Error(
        'VITE_HASURA_ADMIN_SECRET is required for codegen. Set it in .env.local.'
    )
}

const config: CodegenConfig = {
    overwrite: true,
    schema: [
        {
            [endpoint]: {
                headers: {
                    'x-hasura-admin-secret': adminSecret,
                },
            },
        },
    ],
    documents: ['src/**/*.{ts,tsx,js,jsx}'],
    generates: {
        'src/schema/generated.ts': {
            // typescript-operations v6 emits the input/enum types its
            // operations need, so the standalone `typescript` plugin would
            // only duplicate them.
            plugins: ['typescript-operations', 'typed-document-node'],
            config: {
                useTypeImports: true,
                skipTypename: false,
                avoidOptionals: false,
                enumsAsTypes: true,
                scalars: {
                    uuid: 'string',
                    bigint: 'number',
                    jsonb: 'unknown',
                    timestamptz: 'string',
                    timestamp: 'string',
                    date: 'string',
                    numeric: 'number',
                },
            },
        },
    },
    ignoreNoDocuments: true,
}

export default config
