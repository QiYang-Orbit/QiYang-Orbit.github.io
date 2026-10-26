import {mkdir,cp,rm,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const directory=resolve(root,'dist');await rm(directory,{recursive:true,force:true});await mkdir(directory,{recursive:true});await cp(resolve(root,'public'),directory,{recursive:true});
console.log('Static distribution built in dist/. No private records or credentials are included.');
