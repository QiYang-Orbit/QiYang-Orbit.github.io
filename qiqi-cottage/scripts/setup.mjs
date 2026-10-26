import { randomBytes } from 'node:crypto';
import { writeFile, access } from 'node:fs/promises';
try{await access('.env');console.log('An .env file already exists; keeping it unchanged.');process.exit(0)}catch{}
const invite=randomBytes(12).toString('base64url'),owner=randomBytes(24).toString('base64url');
await writeFile('.env',`PORT=8788\nHOST=127.0.0.1\nSITE_ORIGIN=http://127.0.0.1:8788\nOWNER_USERNAME=qiqi\nINVITE_CODE=${invite}\nOWNER_SETUP_CODE=${owner}\n`,{mode:0o600});
console.log('Created a private .env file. Open it locally to retrieve your invitation and owner setup codes. Do not commit or share the owner setup code.');
