import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {messages} from '../public/i18n.js';
const root=new URL('../',import.meta.url);
const menu=JSON.parse(readFileSync(new URL('public/menu.json',root)));
test('both languages cover the same complete interface',()=>{assert.deepEqual(Object.keys(messages.zh).sort(),Object.keys(messages.en).sort());const html=readFileSync(new URL('public/index.html',root),'utf8');for(const match of html.matchAll(/data-i18n="([^"]+)"/g))assert.ok(messages.zh[match[1]],match[1]);});
test('approved menu order, copy and artwork remain intact',()=>{assert.equal(menu.length,12);assert.deepEqual(menu.slice(0,3).map(f=>f.id),['drink-rice-milk','drink-soymilk','drink-nola']);assert.ok(!menu.some(f=>f.name.zh.includes('草莓牛奶')||f.name.zh.includes('提拉米苏')||f.name.zh.includes('牛腩')));for(const food of menu){assert.ok(food.name.zh&&food.name.en);assert.ok(existsSync(new URL('public/'+food.image,root)),food.image)}assert.ok(menu.find(f=>f.id==='dessert-cheesecake').description.zh.includes('力量！\nQiQi'));assert.equal(menu.find(f=>f.id==='meal-chicken-wings').description.zh,'好好吃！');});
