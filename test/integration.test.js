'use strict';
/**
 * ts-indexdb 集成测试
 *
 * 运行环境：Node.js 18+ 内置 node:test + node:assert
 * 测试对象：dist/ 编译产物
 * 依    赖：fake-indexeddb（node_modules/fake-indexeddb）
 *
 * 运行命令：
 *   node --test test/integration.test.js
 *   或通过 package.json：npm test
 *
 * 覆盖范围：
 *   1. 数据库生命周期（open / close / delete）
 *   2. 多数据库实例（initMany / getInstanceByName / getInstanceNames）
 *   3. 查询：queryAll / query / queryByPage / query_by_keyValue / query_by_primaryKey
 *   4. 统计：count（equal / gt / lt / between）
 *   5. 更新：update / update_by_primaryKey
 *   6. 插入：insert（单条 / 批量，事务完成后才 resolve）
 *   7. 删除：delete / delete_by_primaryKey / delete_by_primaryKeys / delete_table
 *   8. 事务批处理：transaction
 *   9. 错误处理：IndexDbError / 未初始化 / 非法参数
 *  10. 完整 CRUD 流程（insert → query → update → delete）
 */

const { describe, it, before, after, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');

// ─── fake-indexeddb polyfill ──────────────────────────────────────────────────

const fakeIdb = require('../node_modules/fake-indexeddb/build/cjs/index.js');

// ─── dist 产物（一次性加载，通过手动清理 _instances 实现测试隔离） ──────────────

const mod = require('../dist/index.js');
const { TsIndexDb, IndexDbError } = mod;

/**
 * 重置运行环境：
 * 1. 创建全新 IDBFactory（每次生成独立的内存数据库）
 * 2. 清空 TsIndexDb._instances（防止跨套件实例泄漏）
 */
function reset() {
  global.indexedDB   = new fakeIdb.IDBFactory();
  global.IDBKeyRange = fakeIdb.IDBKeyRange;
  global.window      = { indexedDB: global.indexedDB };
  // 直接访问私有静态成员（JS 编译后无访问限制）
  TsIndexDb._instances.clear();
}

// ─── 测试数据 ──────────────────────────────────────────────────────────────────

const TABLE = 'books';
const DB_NAME = 'integration-test-db';

const SEED_DATA = [
  { title: '深入理解计算机系统',    author: 'Bryant',  year: 2015, score: 95 },
  { title: 'JavaScript高级程序设计', author: 'Zakas',   year: 2020, score: 92 },
  { title: 'Clean Code',             author: 'Martin',  year: 2008, score: 88 },
  { title: '设计模式',               author: 'GoF',     year: 1994, score: 96 },
  { title: '重构',                   author: 'Fowler',  year: 2018, score: 90 },
];

const DB_CONFIG = {
  dbName: DB_NAME,
  version: 1,
  tables: [{
    tableName: TABLE,
    option: { keyPath: 'id', autoIncrement: true },
    indexs: [
      { key: 'title',  option: { unique: true } },
      { key: 'author' },
      { key: 'year'   },
      { key: 'score'  },
    ],
  }],
};

async function openAndSeed() {
  const db = await mod.init(DB_CONFIG);
  await db.insert({ tableName: TABLE, data: SEED_DATA });
  return db;
}

// ─── 安全关闭（忽略"已关闭"错误） ─────────────────────────────────────────────
async function safeClose(db) {
  try { await db.close_db(); } catch (_) {}
}

// ═════════════════════════════════════════════════════════════════════════════
// 1. 数据库生命周期
// ═════════════════════════════════════════════════════════════════════════════

describe('【1】数据库生命周期', () => {
  let db;
  before(() => reset());
  after(() => safeClose(db));

  it('init() 应成功打开数据库并返回 TsIndexDb 实例', async () => {
    db = await mod.init(DB_CONFIG);
    assert.equal(typeof db, 'object');
    assert.equal(db.constructor.name, 'TsIndexDb');
  });

  it('重复 init() 同一 dbName 应返回同一实例', async () => {
    const db2 = await mod.init(DB_CONFIG);
    assert.equal(db2, db);
  });

  it('getInstance() 单库场景应返回已打开的实例', () => {
    assert.equal(mod.getInstance(), db);
  });

  it('getInstanceNames() 应包含已初始化的数据库名', () => {
    assert.ok(mod.getInstanceNames().includes(DB_NAME));
  });

  it('close_db() 应正常关闭并从实例列表移除', async () => {
    await db.close_db();
    assert.ok(!mod.getInstanceNames().includes(DB_NAME));
  });

  it('close_db() 对已关闭的数据库应 reject IndexDbError', async () => {
    // 重新打开再关两次
    db = await mod.init(DB_CONFIG);
    await db.close_db();
    await assert.rejects(
      () => db.close_db(),
      (e) => { assert.equal(e.name, 'IndexDbError'); return true; }
    );
    db = null; // after 中 safeClose(null) 不执行
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 2. 插入操作
// ═════════════════════════════════════════════════════════════════════════════

describe('【2】插入操作 insert', () => {
  let db;
  before(async () => { reset(); db = await mod.init(DB_CONFIG); });
  after(() => safeClose(db));

  it('插入单条记录后 queryAll 应返回 1 条', async () => {
    await db.insert({ tableName: TABLE, data: SEED_DATA[0] });
    const rows = await db.queryAll({ tableName: TABLE });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].title, SEED_DATA[0].title);
    assert.equal(rows[0].id, 1);
  });

  it('批量插入 4 条后总数应为 5', async () => {
    await db.insert({ tableName: TABLE, data: SEED_DATA.slice(1) });
    const rows = await db.queryAll({ tableName: TABLE });
    assert.equal(rows.length, 5);
  });

  it('批量插入后立即查询，数据应完整（事务 oncomplete 后才 resolve）', async () => {
    const extra = [
      { title: '领域驱动设计', author: 'Evans',  year: 2003, score: 93 },
      { title: '微服务架构',   author: 'Newman', year: 2015, score: 87 },
    ];
    await db.insert({ tableName: TABLE, data: extra });
    const rows = await db.queryAll({ tableName: TABLE });
    assert.equal(rows.length, 7);
  });

  it('插入重复 unique 索引（title）应 reject', async () => {
    await assert.rejects(() => db.insert({ tableName: TABLE, data: SEED_DATA[0] }));
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 3. 查询操作
// ═════════════════════════════════════════════════════════════════════════════

describe('【3】查询操作', () => {
  let db;
  before(async () => { reset(); db = await openAndSeed(); });
  after(() => safeClose(db));

  describe('queryAll', () => {
    it('应返回全部 5 条记录', async () => {
      const rows = await db.queryAll({ tableName: TABLE });
      assert.equal(rows.length, SEED_DATA.length);
    });
    it('每条记录应带自增 id（1~5）', async () => {
      const rows = await db.queryAll({ tableName: TABLE });
      rows.forEach((row, i) => assert.equal(row.id, i + 1));
    });
  });

  describe('query（条件过滤）', () => {
    it('year >= 2015 应返回 3 条', async () => {
      const rows = await db.query({ tableName: TABLE, condition: r => r.year >= 2015 });
      assert.equal(rows.length, 3);
      rows.forEach(r => assert.ok(r.year >= 2015));
    });
    it('author === GoF 应返回 1 条（设计模式）', async () => {
      const rows = await db.query({ tableName: TABLE, condition: r => r.author === 'GoF' });
      assert.equal(rows.length, 1);
      assert.equal(rows[0].title, '设计模式');
    });
    it('条件永假应返回空数组', async () => {
      const rows = await db.query({ tableName: TABLE, condition: () => false });
      assert.equal(rows.length, 0);
    });
    it('条件永真等价 queryAll', async () => {
      const rows = await db.query({ tableName: TABLE, condition: () => true });
      assert.equal(rows.length, SEED_DATA.length);
    });
  });

  describe('queryByPage（分页查询）', () => {
    it('第1页 pageSize=2：2 条，hasMore=true', async () => {
      const r = await db.queryByPage({ tableName: TABLE, page: 1, pageSize: 2 });
      assert.equal(r.list.length, 2);
      assert.equal(r.hasMore, true);
      assert.equal(r.page, 1);
      assert.equal(r.pageSize, 2);
    });
    it('第3页 pageSize=2：1 条，hasMore=false', async () => {
      const r = await db.queryByPage({ tableName: TABLE, page: 3, pageSize: 2 });
      assert.equal(r.list.length, 1);
      assert.equal(r.hasMore, false);
    });
    it('三页合并与 queryAll 结果完全一致（无重复无遗漏）', async () => {
      const [p1, p2, p3, all] = await Promise.all([
        db.queryByPage({ tableName: TABLE, page: 1, pageSize: 2 }),
        db.queryByPage({ tableName: TABLE, page: 2, pageSize: 2 }),
        db.queryByPage({ tableName: TABLE, page: 3, pageSize: 2 }),
        db.queryAll({ tableName: TABLE }),
      ]);
      const pagedIds = [...p1.list, ...p2.list, ...p3.list].map(r => r.id).sort((a,b)=>a-b);
      const allIds   = all.map(r => r.id).sort((a,b)=>a-b);
      assert.deepEqual(pagedIds, allIds);
    });
    it('带 condition 的分页只在匹配项上分页', async () => {
      const r = await db.queryByPage({
        tableName: TABLE, page: 1, pageSize: 2, condition: r => r.year >= 2015,
      });
      assert.equal(r.list.length, 2);
      r.list.forEach(row => assert.ok(row.year >= 2015));
    });
    it('倒序（direction=prev）第1页从最大 id 开始', async () => {
      const r = await db.queryByPage({ tableName: TABLE, page: 1, pageSize: 2, direction: 'prev' });
      assert.equal(r.list.length, 2);
      assert.equal(r.list[0].id, SEED_DATA.length);
    });
    it('page=0 应 reject IndexDbError', async () => {
      await assert.rejects(
        () => db.queryByPage({ tableName: TABLE, page: 0, pageSize: 2 }),
        (e) => { assert.equal(e.name, 'IndexDbError'); return true; }
      );
    });
    it('pageSize=0 应 reject IndexDbError', async () => {
      await assert.rejects(
        () => db.queryByPage({ tableName: TABLE, page: 1, pageSize: 0 }),
        (e) => { assert.equal(e.name, 'IndexDbError'); return true; }
      );
    });
  });

  describe('query_by_keyValue（索引精确查询）', () => {
    it('按 author=Martin 应返回 Clean Code', async () => {
      const row = await db.query_by_keyValue({ tableName: TABLE, key: 'author', value: 'Martin' });
      assert.ok(row !== null);
      assert.equal(row.title, 'Clean Code');
    });
    it('不存在的值应返回 null', async () => {
      const row = await db.query_by_keyValue({ tableName: TABLE, key: 'author', value: 'Nobody' });
      assert.equal(row, null);
    });
  });

  describe('query_by_primaryKey（主键查询）', () => {
    it('主键 1 应返回第一条记录', async () => {
      const row = await db.query_by_primaryKey({ tableName: TABLE, value: 1 });
      assert.ok(row !== null);
      assert.equal(row.id, 1);
    });
    it('不存在的主键应返回 null', async () => {
      const row = await db.query_by_primaryKey({ tableName: TABLE, value: 9999 });
      assert.equal(row, null);
    });
  });

  describe('count（范围统计）', () => {
    it('equal：score = 95 应为 1', async () => {
      const n = await db.count({ tableName: TABLE, key: 'score', countCondition: { type: 'equal', rangeValue: [95] } });
      assert.equal(n, 1);
    });
    it('gt（≥）：year ≥ 2015 应为 3', async () => {
      const n = await db.count({ tableName: TABLE, key: 'year', countCondition: { type: 'gt', rangeValue: [2015] } });
      assert.equal(n, 3);
    });
    it('lt（≤）：year ≤ 2008 应为 2（2008、1994）', async () => {
      const n = await db.count({ tableName: TABLE, key: 'year', countCondition: { type: 'lt', rangeValue: [2008] } });
      assert.equal(n, 2);
    });
    it('between（≥x && ≤y）：year 2010~2020 应为 3', async () => {
      const n = await db.count({ tableName: TABLE, key: 'year', countCondition: { type: 'between', rangeValue: [2010, 2020] } });
      assert.equal(n, 3);
    });
    it('between exclusive（>2015 && <2020）应为 1（仅 2018）', async () => {
      const n = await db.count({ tableName: TABLE, key: 'year', countCondition: { type: 'between', rangeValue: [2015, 2020, true, true] } });
      assert.equal(n, 1);
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 4. 更新操作
// ═════════════════════════════════════════════════════════════════════════════

describe('【4】更新操作', () => {
  let db;
  before(async () => { reset(); db = await openAndSeed(); });
  after(() => safeClose(db));

  describe('update（条件批量更新）', () => {
    it('满足 year>=2018 的记录 score+5，返回 2 条已更新数组', async () => {
      const updated = await db.update({
        tableName: TABLE,
        condition: r => r.year >= 2018,
        handle: r => ({ ...r, score: r.score + 5 }),
      });
      assert.equal(updated.length, 2);
      updated.forEach(r => assert.ok(r.score >= 95));
    });
    it('更新应持久化：id=2（2020年）score 应为 97', async () => {
      const row = await db.query_by_primaryKey({ tableName: TABLE, value: 2 });
      assert.equal(row.score, 97);
    });
    it('条件永假：返回空数组，不改变任何数据', async () => {
      const before = (await db.queryAll({ tableName: TABLE })).map(r => r.score);
      const updated = await db.update({ tableName: TABLE, condition: () => false, handle: r => r });
      const after  = (await db.queryAll({ tableName: TABLE })).map(r => r.score);
      assert.equal(updated.length, 0);
      assert.deepEqual(after, before);
    });
  });

  describe('update_by_primaryKey（按主键更新）', () => {
    it('应更新目标并返回更新后的对象', async () => {
      const result = await db.update_by_primaryKey({
        tableName: TABLE, value: 1,
        handle: r => ({ ...r, title: '深入理解计算机系统（第3版）' }),
      });
      assert.ok(result !== null);
      assert.equal(result.title, '深入理解计算机系统（第3版）');
    });
    it('更新持久化：再查 id=1 可见变更', async () => {
      const row = await db.query_by_primaryKey({ tableName: TABLE, value: 1 });
      assert.equal(row.title, '深入理解计算机系统（第3版）');
    });
    it('主键不存在应返回 null', async () => {
      const result = await db.update_by_primaryKey({
        tableName: TABLE, value: 9999, handle: r => r,
      });
      assert.equal(result, null);
    });
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 5. 删除操作
// ═════════════════════════════════════════════════════════════════════════════

describe('【5】删除操作', () => {
  // 每个 it 用独立环境，因为每个都会改变数据
  beforeEach(async () => { reset(); });

  it('delete：按条件删除 year<2000，返回已删数组，库中减少对应条数', async () => {
    const db = await openAndSeed();
    const deleted = await db.delete({ tableName: TABLE, condition: r => r.year < 2000 });
    assert.equal(deleted.length, 1);
    assert.equal(deleted[0].title, '设计模式');
    const remaining = await db.queryAll({ tableName: TABLE });
    assert.equal(remaining.length, SEED_DATA.length - 1);
    remaining.forEach(r => assert.ok(r.year >= 2000));
    await safeClose(db);
  });

  it('delete_by_primaryKey：删除 id=1 后查询为 null，总数-1', async () => {
    const db = await openAndSeed();
    await db.delete_by_primaryKey({ tableName: TABLE, value: 1 });
    const row = await db.query_by_primaryKey({ tableName: TABLE, value: 1 });
    assert.equal(row, null);
    assert.equal((await db.queryAll({ tableName: TABLE })).length, SEED_DATA.length - 1);
    await safeClose(db);
  });

  it('delete_by_primaryKey：不存在的主键应正常 resolve，不影响数据', async () => {
    const db = await openAndSeed();
    await db.delete_by_primaryKey({ tableName: TABLE, value: 9999 });
    assert.equal((await db.queryAll({ tableName: TABLE })).length, SEED_DATA.length);
    await safeClose(db);
  });

  it('delete_by_primaryKeys：批量删除 [1,2,3]，剩余 2 条', async () => {
    const db = await openAndSeed();
    await db.delete_by_primaryKeys({ tableName: TABLE, values: [1, 2, 3] });
    const remaining = await db.queryAll({ tableName: TABLE });
    assert.equal(remaining.length, SEED_DATA.length - 3);
    const ids = remaining.map(r => r.id);
    [1, 2, 3].forEach(id => assert.ok(!ids.includes(id)));
    await safeClose(db);
  });

  it('delete_by_primaryKeys：空数组应正常 resolve，不影响数据', async () => {
    const db = await openAndSeed();
    await db.delete_by_primaryKeys({ tableName: TABLE, values: [] });
    assert.equal((await db.queryAll({ tableName: TABLE })).length, SEED_DATA.length);
    await safeClose(db);
  });

  it('delete_table：清空后 queryAll 返回空数组', async () => {
    const db = await openAndSeed();
    await db.delete_table(TABLE);
    assert.equal((await db.queryAll({ tableName: TABLE })).length, 0);
    await safeClose(db);
  });

  it('delete_table：清空后仍可插入新数据', async () => {
    const db = await openAndSeed();
    await db.delete_table(TABLE);
    await db.insert({ tableName: TABLE, data: { title: '新书', author: 'Me', year: 2026, score: 100 } });
    const rows = await db.queryAll({ tableName: TABLE });
    assert.equal(rows.length, 1);
    assert.equal(rows[0].title, '新书');
    await safeClose(db);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 6. 事务批处理
// ═════════════════════════════════════════════════════════════════════════════

describe('【6】事务批处理 transaction', () => {
  let db;
  before(async () => { reset(); db = await openAndSeed(); });
  after(() => safeClose(db));

  it('单事务批量 get 应返回正确记录', async () => {
    const results = await db.transaction(TABLE, 'readonly', store => [store.get(1), store.get(2)]);
    assert.equal(results[0].id, 1);
    assert.equal(results[1].id, 2);
  });

  it('单事务批量 put 后数据应持久化', async () => {
    await db.transaction(TABLE, 'readwrite', store => [
      store.put({ id: 1, title: '事务修改-1', author: 'Bryant', year: 2015, score: 99 }),
      store.put({ id: 2, title: '事务修改-2', author: 'Zakas',  year: 2020, score: 99 }),
    ]);
    const r1 = await db.query_by_primaryKey({ tableName: TABLE, value: 1 });
    const r2 = await db.query_by_primaryKey({ tableName: TABLE, value: 2 });
    assert.equal(r1.title, '事务修改-1');
    assert.equal(r2.title, '事务修改-2');
    assert.equal(r1.score, 99);
    assert.equal(r2.score, 99);
  });

  it('空操作列表应正常 resolve 并返回空数组', async () => {
    const results = await db.transaction(TABLE, 'readonly', () => []);
    assert.deepEqual(results, []);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 7. 多数据库实例
// ═════════════════════════════════════════════════════════════════════════════

describe('【7】多数据库实例 initMany', () => {
  let db1, db2;
  const T_USERS = 'users';
  const T_LOGS  = 'logs';

  before(async () => {
    reset();
    [db1, db2] = await mod.initMany([
      {
        dbName: 'userStore', version: 1,
        tables: [{ tableName: T_USERS, option: { keyPath: 'id', autoIncrement: true }, indexs: [{ key: 'name' }] }],
      },
      {
        dbName: 'logStore', version: 1,
        tables: [{ tableName: T_LOGS, option: { keyPath: 'id', autoIncrement: true }, indexs: [{ key: 'level' }] }],
      },
    ]);
  });

  after(async () => { await safeClose(db1); await safeClose(db2); });

  it('initMany 应返回两个不同的 TsIndexDb 实例', () => {
    assert.ok(db1 !== db2);
    assert.equal(db1.constructor.name, 'TsIndexDb');
    assert.equal(db2.constructor.name, 'TsIndexDb');
  });

  it('getInstanceNames 应同时包含 userStore 和 logStore', () => {
    const names = mod.getInstanceNames();
    assert.ok(names.includes('userStore'));
    assert.ok(names.includes('logStore'));
  });

  it('getInstanceByName 应返回对应的实例', () => {
    assert.equal(mod.getInstanceByName('userStore'), db1);
    assert.equal(mod.getInstanceByName('logStore'),  db2);
  });

  it('两个库的数据应完全隔离', async () => {
    await db1.insert({ tableName: T_USERS, data: { name: 'Alice', email: 'a@x.com' } });
    await db2.insert({ tableName: T_LOGS,  data: { level: 'info', msg: '启动' } });
    const users = await db1.queryAll({ tableName: T_USERS });
    const logs  = await db2.queryAll({ tableName: T_LOGS });
    assert.equal(users.length, 1);
    assert.equal(logs.length,  1);
    assert.equal(users[0].name,  'Alice');
    assert.equal(logs[0].level,  'info');
  });

  it('getInstance() 存在多库时不指定 dbName 应 throw', () => {
    assert.throws(() => mod.getInstance());
  });

  it('getInstance(dbName) 指定名称应正常工作', () => {
    assert.equal(mod.getInstance('userStore'), db1);
    assert.equal(mod.getInstance('logStore'),  db2);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 8. 错误处理 & 边界条件
// ═════════════════════════════════════════════════════════════════════════════

describe('【8】错误处理 & 边界条件', () => {
  before(() => reset());

  it('getInstance() 未初始化任何库时应 throw', () => {
    assert.throws(() => mod.getInstance());
  });

  it('getInstanceByName() 未知库名应 throw IndexDbError', () => {
    assert.throws(() => mod.getInstanceByName('nonexistent'), (e) => {
      assert.equal(e.name, 'IndexDbError');
      return true;
    });
  });

  it('IndexDbError 是 Error 子类，name=IndexDbError', () => {
    const e = new IndexDbError('测试');
    assert.ok(e instanceof Error);
    assert.equal(e.name, 'IndexDbError');
    assert.equal(e.message, '测试');
  });

  it('操作不存在的表名应 reject', async () => {
    reset();
    const db = await mod.init({
      dbName: 'edgeCaseDb', version: 1,
      tables: [{ tableName: 'existing', option: { keyPath: 'id' }, indexs: [] }],
    });
    await assert.rejects(() => db.queryAll({ tableName: 'no_such_table' }));
    await safeClose(db);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// 9. 完整 CRUD 流程（端对端）
// ═════════════════════════════════════════════════════════════════════════════

describe('【9】完整 CRUD 流程（端对端）', () => {
  let db;
  const T = 'items';
  let insertedId;

  before(async () => {
    reset();
    db = await mod.init({
      dbName: 'crudDb', version: 1,
      tables: [{
        tableName: T,
        option: { keyPath: 'id', autoIncrement: true },
        indexs: [{ key: 'name' }, { key: 'value' }],
      }],
    });
  });

  after(() => safeClose(db));

  it('Step1：插入一条记录后总数为 1，id 自动分配', async () => {
    await db.insert({ tableName: T, data: { name: 'item-A', value: 10 } });
    const rows = await db.queryAll({ tableName: T });
    assert.equal(rows.length, 1);
    insertedId = rows[0].id;
    assert.equal(typeof insertedId, 'number');
  });

  it('Step2：按主键查询，字段正确', async () => {
    const row = await db.query_by_primaryKey({ tableName: T, value: insertedId });
    assert.equal(row.name, 'item-A');
    assert.equal(row.value, 10);
  });

  it('Step3：按主键更新，字段变更并持久化', async () => {
    await db.update_by_primaryKey({
      tableName: T, value: insertedId,
      handle: r => ({ ...r, value: 99, name: 'item-A-updated' }),
    });
    const row = await db.query_by_primaryKey({ tableName: T, value: insertedId });
    assert.equal(row.value, 99);
    assert.equal(row.name, 'item-A-updated');
  });

  it('Step4：按主键删除后查询返回 null', async () => {
    await db.delete_by_primaryKey({ tableName: T, value: insertedId });
    const row = await db.query_by_primaryKey({ tableName: T, value: insertedId });
    assert.equal(row, null);
  });

  it('Step5：表应为空', async () => {
    assert.equal((await db.queryAll({ tableName: T })).length, 0);
  });
});
