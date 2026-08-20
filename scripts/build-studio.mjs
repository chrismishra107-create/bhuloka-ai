import 'dotenv/config';
import { build } from 'esbuild';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or public Supabase key in .env');
}

await build({
  entryPoints: ['src/web.tsx'],
  bundle: true,
  outfile: 'public/bundle.js',
  format: 'iife',
  platform: 'browser',
  define: {
    'process.env.NEXT_PUBLIC_SUPABASE_URL': JSON.stringify(supabaseUrl),
    'process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY': JSON.stringify(supabaseKey),
  },
});